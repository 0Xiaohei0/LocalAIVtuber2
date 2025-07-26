from huggingface_hub import hf_hub_download
from .configs.config import Config
from .pipeline import Pipeline
from .infer_pack.models import (
    SynthesizerTrnMs256NSFsid,
    SynthesizerTrnMs256NSFsid_nono,
    SynthesizerTrnMs768NSFsid,
    SynthesizerTrnMs768NSFsid_nono,
)
import soundfile
from fairseq import checkpoint_utils
import faiss
import torchaudio
import torch
import numpy as np
import logging
import os

logger = logging.getLogger(__name__)


_cpu = torch.device('cpu')
_gpu = torch.device('cuda:0')
_devgp = dev = _gpu if torch.cuda.is_available() else _cpu


def download_models():
    hf_hub_download('lj1995/VoiceConversionWebUI', 'hubert_base.pt')
    hf_hub_download('lj1995/VoiceConversionWebUI', 'rmvpe.pt')


def load_hubert(config):
    fl = hf_hub_download('lj1995/VoiceConversionWebUI', 'hubert_base.pt')
    models, _, _ = checkpoint_utils.load_model_ensemble_and_task(
        [fl],
        suffix="",
    )
    hubert_model = models[0]
    hubert_model = hubert_model.to(config.device)
    if config.is_half:
        hubert_model = hubert_model.half()
    else:
        hubert_model = hubert_model.float()
    return hubert_model.eval()


class _ResampleCache(dict):

    device = _devgp

    def __getitem__(self, item) -> torchaudio.transforms.Resample:
        if item not in self:
            self[item] = torchaudio.transforms.Resample(
                *item, lowpass_filter_width=32).to(_devgp, non_blocking=True)
        return super().__getitem__(item)

    def resample(self, fromto: tuple, audio: torch.Tensor, deviceto: str = _devgp) -> torch.Tensor:
        if fromto[0] == fromto[1]:
            return audio.to(deviceto, non_blocking=True)
        out = self[fromto](audio.to(_devgp, non_blocking=True)).to(
            deviceto, non_blocking=True)
        out.frequency = fromto[1]
        return out


ResampleCache = _ResampleCache()


def _try_int(s):
    try:
        return int(s)
    except:
        return None


class RVC:

    # bootleg singletons
    _hubert_model = None
    _pipeline = None
    # going to assume these are small enough kernels to be neglible memory hogs.
    _LOUD16K = torchaudio.transforms.Loudness(
        16000).to(_devgp, non_blocking=True)
    # so changeable but should probably change it for the specific instance only.
    outputfreq = _try_int(os.getenv('RVC_OUTPUTFREQ', '44100'))
    _LOUDOUTPUT = torchaudio.transforms.Loudness(
        outputfreq).to(_devgp, non_blocking=True)
    returnblocking = bool(os.getenv('RVC_RETURNBLOCKING', 'True'))
    MATCH_ORIGINAL = 1
    NO_CHANGE = 2

    def __init__(self, model: str, index: str = None, config=None):
        """Load up the specific RVC model, and initializes generic models as singletons. call rvc.run(audio) to run the model."""
        self.n_spk = None
        self.tgt_sr = None  # model's sample rate
        self.net_g = None
        self.cpt = None
        self.version = None
        self.if_f0 = None
        self.index = None

        self.config = Config() if config is None else config
        # I want to know if model is a direct and absolute reference to a .pth file if yes then override MODELDIR and that becomes self.model_path
        # if no to absolute then join MODELDIR with model.
        # then if no to .pth then check is self.model_path a dir, if not then add .pth file, if it is a dir then os.listdir select first .pth in the dir. join with self.model_path and finish.
        # next within the is dir part of self.model_path is dir, if index is None then index = first index found in this dir, else it's = fpth.replace .pth with .index.
        misab, mispath = os.path.isabs(model), len(
            model) > 4 and model[-4:] == '.pth'
        self.model_path = model
        _pid = None
        if not misab:
            self.model_path = os.path.join(os.getenv("RVC_MODELDIR"), model)
        if not mispath:
            if os.path.isdir(self.model_path):
                tl = os.listdir(self.model_path)
                fpth = next((item for item in tl if len(item)
                            > 4 and item[-4:] == '.pth'), None)
                self.model_path = os.path.join(
                    self.model_path, fpth) if fpth is not None else self.model_path+'.pth'
                _pid = next((item for item in tl if len(item) >
                            6 and item[-6:] == '.index'), None)
            else:
                self.model_path += '.pth'

        # nindx=os.getenv('RVC_INDEXDIR',None) is None
        index = index if index is not None else _pid if _pid is not None else os.path.basename(
            self.model_path).replace('.pth', '.index')
        iisab, iisidx = os.path.isabs(index), len(
            index) > 6 and index[-6:] == '.index'
        self.index_path = index
        pdr = os.path.dirname(self.model_path)
        if not iisab:
            self.index_path = os.path.join(os.getenv('RVC_INDEXDIR', os.getenv(
                "RVC_MODELDIR", pdr)) if self.index_path is not None else pdr, index)
        if not iisidx:
            if os.path.isdir(self.index_path):
                tl = os.listdir(self.index_path)
                fpth = next((item for item in tl if len(item) >
                            6 and item[-6:] == '.index'), None)
                self.index_path = os.path.join(
                    self.index_path, fpth) if fpth is not None else self.index_path + '.index'
            else:
                self.index_path += '.index'
        self.name = f"Model: {os.path.basename(self.model_path).split('.')[0]}, Index: {os.path.basename(self.index_path).split('.')[0]}"
        self._load()

    @property
    def hubert_model(self):
        if RVC._hubert_model is None:
            RVC._hubert_model = load_hubert(self.config)
        return RVC._hubert_model

    @property
    def pipeline(self):
        if RVC._pipeline is None:
            RVC._pipeline = Pipeline(self.tgt_sr, self.config)
        elif RVC._pipeline.sr != self.tgt_sr:
            # this should be the only change necessary when an RVC has a different sr, no need to refresh pipeline init. This does mean execution has to be sequential, so change if problem somehow.
            RVC._pipeline.t_pad_tgt = self.tgt_sr*self._pipeline.x_pad
        return RVC._pipeline

    @classmethod
    def free_generic_memory(cls):
        del cls._hubert_model
        cls._hubert_model = None
        del cls._pipeline
        cls._pipeline = None
        ResampleCache.clear()

    # I think deletes will be handled correctly already for references to the model on gpu and cpu.
    # def __del__(self):
    #     logger.info("Get sid: " + sid)
    #
    #     to_return_protect0 = {
    #         "visible": self.if_f0 != 0,
    #         "value": to_return_protect[0]
    #         if self.if_f0 != 0 and to_return_protect
    #         else 0.5,
    #         "__type__": "update",
    #     }
    #     to_return_protect1 = {
    #         "visible": self.if_f0 != 0,
    #         "value": to_return_protect[1]
    #         if self.if_f0 != 0 and to_return_protect
    #         else 0.33,
    #         "__type__": "update",
    #     }
    #
    #     # move all of this to a __delete__
    #     if sid == "" or sid == []:
    #         if self.hubert_model is not None:  # 考虑到轮询, 需要加个判断看是否 sid 是由有模型切换到无模型的
    #             logger.info("Clean model cache")
    #             del (self.net_g, self.n_spk, self.hubert_model, self.tgt_sr)  # ,cpt
    #             self.hubert_model = (
    #                 self.net_g
    #             ) = self.n_spk = self.hubert_model = self.tgt_sr = None
    #             if torch.cuda.is_available():
    #                 torch.cuda.empty_cache()
    #             ###楼下不这么折腾清理不干净
    #             self.if_f0 = self.cpt.get("f0", 1)
    #             self.version = self.cpt.get("version", "v1")
    #             if self.version == "v1":
    #                 if self.if_f0 == 1:
    #                     self.net_g = SynthesizerTrnMs256NSFsid(
    #                         *self.cpt["config"], is_half=self.config.is_half
    #                     )
    #                 else:
    #                     self.net_g = SynthesizerTrnMs256NSFsid_nono(*self.cpt["config"])
    #             elif self.version == "v2":
    #                 if self.if_f0 == 1:
    #                     self.net_g = SynthesizerTrnMs768NSFsid(
    #                         *self.cpt["config"], is_half=self.config.is_half
    #                     )
    #                 else:
    #                     self.net_g = SynthesizerTrnMs768NSFsid_nono(*self.cpt["config"])
    #             del self.net_g, self.cpt
    #             if torch.cuda.is_available():
    #                 torch.cuda.empty_cache()
    #         return (
    #             {"visible": False, "__type__": "update"},
    #             {
    #                 "visible": True,
    #                 "value": to_return_protect0,
    #                 "__type__": "update",
    #             },
    #             {
    #                 "visible": True,
    #                 "value": to_return_protect1,
    #                 "__type__": "update",
    #             },
    #             "",
    #             "",
    #         )
    #     del super #Hmm
    #     del self

    def _load(self, model_path=None, index_path=None):
        model_path, index_path = self.model_path if model_path is None else model_path, self.index_path if index_path is None else index_path
        # logger.info(f"Loading: {model_path}")

        self.cpt = torch.load(model_path, map_location="cpu")
        self.tgt_sr = self.cpt["config"][-1]
        self.cpt["config"][-3] = self.cpt["weight"]["emb_g.weight"].shape[0]  # n_spk
        self.if_f0 = self.cpt.get("f0", 1)
        self.version = self.cpt.get("version", "v1")

        synthesizer_class = {
            ("v1", 1): SynthesizerTrnMs256NSFsid,
            ("v1", 0): SynthesizerTrnMs256NSFsid_nono,
            ("v2", 1): SynthesizerTrnMs768NSFsid,
            ("v2", 0): SynthesizerTrnMs768NSFsid_nono,
        }

        self.model = synthesizer_class.get(
            (self.version, self.if_f0), SynthesizerTrnMs256NSFsid
        )(*self.cpt["config"], is_half=self.config.is_half)

        del self.model.enc_q

        self.model.load_state_dict(self.cpt["weight"], strict=False)
        self.model.eval().to(self.config.device)
        if self.config.is_half:
            self.model = self.model.half()
        else:
            self.model = self.model.float()

        # logger.info("Selecting index: " + index_path)
        mindex = faiss.read_index(index_path)
        big_npy = mindex.reconstruct_n(0, mindex.ntotal)
        self.index = (mindex, big_npy)
        # also add a torch transforms resampler here or none if tgt_sr == output rate.

        # return (
        #     (
        #         {"visible": True, "maximum": n_spk, "__type__": "update"},
        #         to_return_protect0,
        #         to_return_protect1,
        #         index,
        #         index,
        #     )
        #     if to_return_protect
        #     else {"visible": True, "maximum": n_spk, "__type__": "update"}
        # )

    def __call__(self,
                 audio: str | torch.Tensor,
                 f0_up_key=0.,  # 12 semitones per octave
                 f0_method='rmvpe',
                 index_rate=.7,
                 filter_radius=3,
                 protect=.5,
                 output_device=None,
                 output_volume=1,  # RVC.MATCH_ORIGINAL
                 f0_spec: str | np.ndarray | None = None):
        """
        Apply the RVC model to the audio.

        Parameters:
        - audio (str | torch.Tensor): The input audio file path or audio tensor.
        - f0_up_key (float, optional): The base pitch shift in semitones (12 per octave). Defaults to 0.
        - f0_method (str, optional): Method for pitch extraction. Defaults to 'rmvpe'.
        - index_rate (float, optional):Increases the influence of the RVCs speech inflections, results may vary, good idea to experiment with this. Can also use indexes from different models.
        - filter_radius (int, optional): Radius for smoothing pitch contours, not used by 'rmvpe'. Defaults to 3.
        - protect (float, optional): Threshold for protecting against artifacts and pitch glitches, seems to rarely help much or be an issue. >=.5 is disabled.
        - output_device (str, optional): The device for output, like 'cpu' or 'cuda:#'. Defaults to the model's device.
        - output_volume (float, optional): Adjusts the output volume. Can be set to RVC.MATCH_ORIGINAL|RVC.NO_CHANGE|float. Defaults to RVC.MATCH_ORIGINAL.
        - f0_spec (str | np.ndarray | None, optional): Custom f0 pitch contour as an array or a file path. Defaults to None.

        Returns:
        - torch.Tensor: The processed audio tensor.
        """

        return self.run(audio, f0_up_key, f0_method, index_rate, filter_radius, protect, output_device, output_volume, f0_spec)

    def run(
        self,
        audio: str | torch.Tensor,
        # The base pitch shift, 12 semitones per octave. Try to match the pitch range the RVC was trained on.
        f0_up_key=0.,
        f0_method='rmvpe',  # The pitch method.
        # Increases the influence of the RVCs speech inflections, results may vary, good idea to experiment with this. Can also use indexes from different models.
        index_rate=.7,
        # Helps smooth other pitch contours, not used by rmvpe.
        filter_radius=3,
        protect=.5,  # protect artifacts and rapid pitch glitches, seems to be almost never be an issue >=.5 is disabled
        output_device=None,  # like 'cpu' or 'cuda:#'
        output_volume=1,  # RVC.MATCH_ORIGINAL
        # custom f0 pitch contour, as array or path.
        f0_spec: str | np.ndarray | None = None
    ):
        """
        Apply the RVC model to the audio.

        Parameters:
        - audio (str | torch.Tensor): The input audio file path or audio tensor.
        - f0_up_key (float, optional): The base pitch shift in semitones (12 per octave). Defaults to 0.
        - f0_method (str, optional): Method for pitch extraction. Defaults to 'rmvpe'.
        - index_rate (float, optional):Increases the influence of the RVCs speech inflections, results may vary, good idea to experiment with this. Can also use indexes from different models.
        - filter_radius (int, optional): Radius for smoothing pitch contours, not used by 'rmvpe'. Defaults to 3.
        - protect (float, optional): Threshold for protecting against artifacts and pitch glitches, seems to rarely help much or be an issue. >=.5 is disabled.
        - output_device (str, optional): The device for output, like 'cpu' or 'cuda:#'. Defaults to the model's device.
        - output_volume (float, optional): Adjusts the output volume. Can be set to RVC.MATCH_ORIGINAL|RVC.NO_CHANGE|float. Defaults to RVC.MATCH_ORIGINAL.
        - f0_spec (str | np.ndarray | None, optional): Custom f0 pitch contour as an array or a file path. Defaults to None.

        Returns:
        - torch.Tensor: The processed audio tensor.
        """

        if isinstance(audio, str):

            audio, freq = load_torchaudio(audio, dtype='float32')
            # audio=audio.to(self.config.device,non_blocking=True)
            audio = ResampleCache.resample((freq, 16000), audio.to(
                self.config.device, non_blocking=True), self.config.device)
            # print('Audio resampled to 16k')
            am = audio.abs().max()
            if am > 1.1:
                audio /= am
        # It's possible to add new attributes to a tensor, in my own code base I use `frequency:int` to define the sample rate of the audio.
        aif = audio.__dict__.get('frequency', None)
        if aif is not None:
            audio = ResampleCache.resample((aif, 16000), audio.to(
                self.config.device, non_blocking=True), self.config.device)
            am = audio.abs().max()
            if am > 1.1:
                audio /= am
        if len(audio.shape) == 1:
            audio = audio.unsqueeze(0)
        # else assume audio is already 16k
        if output_volume is RVC.MATCH_ORIGINAL:
            lufsorig = self._LOUD16K(audio)

        f0_up_key = int(f0_up_key)  # does it need to be tho?
        times = [0, 0, 0]
        audio_opt = self.pipeline.pipeline(
            self.hubert_model,
            self.model,
            0,  # seems irrelevant to the output but not sure, infer_cli.py from the main repo uses 0
            audio,
            times,
            f0_up_key,
            f0_method,
            self.index,
            index_rate,
            self.if_f0,
            filter_radius,
            self.version,
            protect,
            f0_spec
        )
        del audio
        if self.outputfreq is not None:
            audio_opt = ResampleCache.resample(
                (self.tgt_sr, self.outputfreq), audio_opt.float(), self.config.device)
        if output_volume is RVC.MATCH_ORIGINAL:
            lufsout = self._LOUDOUTPUT(audio_opt.unsqueeze(0))
            audio_opt *= 10 ** ((lufsorig - lufsout) / 20)
        elif output_volume is not RVC.NO_CHANGE:  # then it's a negative float lufs target
            lufsout = self._LOUDOUTPUT(audio_opt.unsqueeze(0))
            audio_opt *= 10 ** ((output_volume-lufsout) / 20)
        # note to self, referencing the memory block of a tensor without synchronizing, will cause generic compiled code like numpy to
        # start working prematurely unless you call cuda/cpu .synchronize() before running numpy/numba code on the tensor.
        nout = audio_opt.to(output_device, non_blocking=not self.returnblocking) if output_device is not None else audio_opt.to(
            self.config.device, non_blocking=not self.returnblocking)
        del audio_opt
        return nout


_SUBTYPE2DTYPE = {
    "PCM_S8": "int8",
    "PCM_U8": "uint8",
    "PCM_16": "int16",
    "PCM_32": "int32",
    "FLOAT": "float32",
    "DOUBLE": "float64",
}
# modified torchaudio soundfile backend, dtype is now an optional arg


def load_torchaudio(
    filepath: str,
    frame_offset: int = 0,
    num_frames: int = -1,
    normalize: bool = True,
    channels_first: bool = True,
    dtype=None,
) -> tuple[torch.Tensor, int]:

    with soundfile.SoundFile(filepath, "r") as file_:
        if dtype is None:
            if file_.format != "WAV" or normalize:
                dtype = "float32"
            elif file_.subtype not in _SUBTYPE2DTYPE:
                raise ValueError(f"Unsupported subtype: {file_.subtype}")
            else:
                dtype = _SUBTYPE2DTYPE[file_.subtype]

        frames = file_._prepare_read(frame_offset, None, num_frames)
        waveform = file_.read(frames, dtype, always_2d=True)
        sample_rate = file_.samplerate

    waveform = torch.from_numpy(waveform)
    if channels_first:
        waveform = waveform.t()
    waveform.frequency = sample_rate
    return waveform, sample_rate
