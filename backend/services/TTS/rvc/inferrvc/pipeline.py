from huggingface_hub import hf_hub_download
from scipy import signal
import torchcrepe
import torch.nn.functional as F
import torch
import pyworld
import parselmouth
import numpy as np
from time import time as ttime
from functools import lru_cache
import logging
import os
import sys
import traceback

import torchaudio.functional

logger = logging.getLogger(__name__)


now_dir = os.getcwd()
sys.path.append(now_dir)

_cpu = torch.device("cpu")
_gpu = torch.device("cuda:0")
_devgp = dev = _gpu if torch.cuda.is_available() else _cpu

bh, ah = signal.butter(N=5, Wn=48, btype="high", fs=16000)
bh, ah = torch.from_numpy(bh).to(_devgp, non_blocking=True), torch.from_numpy(
    ah).to(_devgp, non_blocking=True)


@lru_cache  # torch.Tensor should be serializable
def cache_harvest_f0(audio: torch.Tensor, fs, f0max, f0min, frame_period):
    acast = audio.numpy().astype(np.double)
    f0, t = pyworld.harvest(
        acast,
        fs=fs,
        f0_ceil=f0max,
        f0_floor=f0min,
        frame_period=frame_period,
    )
    f0 = pyworld.stonemask(acast, f0, t, fs)
    return f0


enable_butterfilter = False


class Pipeline(object):
    def __init__(self, tgt_sr, config):
        self.x_pad, self.x_query, self.x_center, self.x_max, self.is_half = (
            config.x_pad,
            config.x_query,
            config.x_center,
            config.x_max,
            config.is_half,
        )
        self.sr = 16000  # hubert输入采样率
        self.window = 160  # 每帧点数
        self.t_pad = self.sr * self.x_pad  # 每条前后pad时间
        self.t_pad_tgt = tgt_sr * self.x_pad
        self.t_pad2 = self.t_pad * 2
        self.t_query = self.sr * self.x_query  # 查询切点前后查询时间
        self.t_center = self.sr * self.x_center  # 查询切点位置
        self.t_max = self.sr * self.x_max  # 免查询时长阈值
        self.device = config.device

    def get_f0(
        self,
        audio: torch.Tensor,
        p_len,
        f0_up_key,
        f0_method,
        filter_radius,
        inp_f0=None,
    ):
        time_step = self.window / self.sr * 1000
        f0_min = 50
        f0_max = 1100
        f0_mel_min = 1127 * np.log(1 + f0_min / 700)
        f0_mel_max = 1127 * np.log(1 + f0_max / 700)
        if f0_method == "pm":
            f0 = (
                parselmouth.Sound(audio.numpy(), self.sr)
                .to_pitch_ac(
                    time_step=time_step / 1000,
                    voicing_threshold=0.6,
                    pitch_floor=f0_min,
                    pitch_ceiling=f0_max,
                )
                .selected_array["frequency"]
            )
            pad_size = (p_len - len(f0) + 1) // 2
            if pad_size > 0 or p_len - len(f0) - pad_size > 0:
                f0 = np.pad(
                    f0, [[pad_size, p_len - len(f0) - pad_size]], mode="constant"
                )
        elif f0_method == "harvest":
            f0 = cache_harvest_f0(audio, self.sr, f0_max, f0_min, 10)
            if filter_radius > 2:
                f0 = signal.medfilt(f0, 3)
        elif f0_method == "crepe":
            model = "full"
            # Pick a batch size that doesn't cause memory errors on your gpu
            batch_size = 512
            # Compute pitch using first gpu, probably don't need to copy.
            # audio = torch.tensor(np.copy(x))[None].float()
            f0, pd = torchcrepe.predict(
                audio,
                self.sr,
                self.window,
                f0_min,
                f0_max,
                model,
                batch_size=batch_size,
                device=self.device,
                return_periodicity=True,
            )
            pd = torchcrepe.filter.median(pd, 3)
            f0 = torchcrepe.filter.mean(f0, 3)
            f0[pd < 0.1] = 0
            f0 = f0[0].cpu().numpy()
        elif f0_method == "rmvpe":
            if not hasattr(self, "model_rmvpe"):
                from .rmvpe import RMVPE

                logger.info(
                    "Loading rmvpe model,%s" % hf_hub_download(
                        'lj1995/VoiceConversionWebUI', 'rmvpe.pt'),
                )
                self.model_rmvpe = RMVPE(
                    hf_hub_download('lj1995/VoiceConversionWebUI', 'rmvpe.pt'),
                    is_half=self.is_half,
                    device=self.device,
                )
            f0 = self.model_rmvpe.infer_from_audio(audio, thred=0.03)

            if "privateuseone" in str(self.device):  # clean ortruntime memory
                del self.model_rmvpe.model
                del self.model_rmvpe
                logger.info("Cleaning ortruntime memory")
        f0 *= pow(2, f0_up_key / 12)
        # with open("test.txt","w")as f:f.write("\n".join([str(i)for i in f0.tolist()]))
        tf0 = self.sr // self.window  # 每秒f0点数
        if inp_f0 is not None:
            delta_t = np.round(
                (inp_f0[:, 0].max() - inp_f0[:, 0].min()) * tf0 + 1
            ).astype("int16")
            replace_f0 = np.interp(
                list(range(delta_t)), inp_f0[:, 0] * 100, inp_f0[:, 1]
            )
            shape = f0[self.x_pad * tf0: self.x_pad *
                       tf0 + len(replace_f0)].shape[0]
            f0[self.x_pad * tf0: self.x_pad * tf0 + len(replace_f0)] = replace_f0[
                :shape
            ]
        # with open("test_opt.txt","w")as f:f.write("\n".join([str(i)for i in f0.tolist()]))
        f0bak = f0.copy()
        f0_mel = 1127 * np.log(1 + f0 / 700)
        f0_mel[f0_mel > 0] = (f0_mel[f0_mel > 0] - f0_mel_min) * 254 / (
            f0_mel_max - f0_mel_min
        ) + 1
        f0_mel[f0_mel <= 1] = 1
        f0_mel[f0_mel > 255] = 255
        f0_coarse = np.rint(f0_mel).astype(np.int32)
        return f0_coarse, f0bak  # 1-0

    def vc(
        self,
        model,
        net_g,
        sid,
        audio0: torch.Tensor,
        pitch,
        pitchf,
        times,
        index,
        big_npy,
        index_rate,
        version,
        protect,
    ):  # ,file_index,file_big_npy
        feats = audio0[0]
        if self.is_half:
            feats = feats.half()
        else:
            feats = feats.float()  # redundant after filtfilt
        if feats.dim() == 2:  # double channels
            feats = feats.mean(-1)
        assert feats.dim() == 1, feats.dim()
        feats = feats.view(1, -1)
        padding_mask = torch.BoolTensor(feats.shape).to(
            self.device, non_blocking=True).fill_(False)
        inputs = {
            "source": feats.to(self.device, non_blocking=True),
            "padding_mask": padding_mask,
            "output_layer": 9 if version == "v1" else 12,
        }
        t0 = ttime()
        with torch.no_grad():
            logits = model.extract_features(**inputs)
            feats = model.final_proj(
                logits[0]) if version == "v1" else logits[0]
        if protect < 0.5 and pitch is not None and pitchf is not None:
            feats0 = feats.clone()
        if (
            not isinstance(index, type(None))
            and not isinstance(big_npy, type(None))
            and index_rate != 0
        ):
            if self.is_half:
                npy = feats[0].to(_cpu, dtype=torch.float32,
                                  non_blocking=False).numpy()
            else:
                npy = feats[0].to(_cpu, non_blocking=False).numpy()

            # _, I = index.search(npy, 1)
            # npy = big_npy[I.squeeze()]

            score, ix = index.search(npy, k=8)
            weight = np.square(1 / score)
            weight /= weight.sum(axis=1, keepdims=True)
            npy = np.sum(big_npy[ix] * np.expand_dims(weight, axis=2), axis=1)
            if self.is_half:
                feats = (
                    torch.from_numpy(npy).unsqueeze(0).to(
                        self.device, dtype=torch.float16, non_blocking=True) * index_rate
                    + (1 - index_rate) * feats
                )
            else:
                feats = (
                    torch.from_numpy(npy).unsqueeze(0).to(
                        self.device, non_blocking=True) * index_rate
                    + (1 - index_rate) * feats
                )

        feats = F.interpolate(feats.permute(0, 2, 1),
                              scale_factor=2).permute(0, 2, 1)
        if protect < 0.5 and pitch is not None and pitchf is not None:
            feats0 = F.interpolate(feats0.permute(0, 2, 1), scale_factor=2).permute(
                0, 2, 1
            )
        t1 = ttime()
        p_len = audio0.shape[1] // self.window
        if feats.shape[1] < p_len:
            p_len = feats.shape[1]
            if pitch is not None and pitchf is not None:
                pitch = pitch[:, :p_len]
                pitchf = pitchf[:, :p_len]

        if protect < 0.5 and pitch is not None and pitchf is not None:
            pitchff = pitchf.clone()
            pitchff[pitchf > 0] = 1
            pitchff[pitchf < 1] = protect
            pitchff = pitchff.unsqueeze(-1)
            feats = feats * pitchff + feats0 * (1 - pitchff)
            feats = feats.to(feats0.dtype)
        p_len = torch.tensor([p_len], device=self.device).long()
        with torch.no_grad():
            hasp = pitch is not None and pitchf is not None
            arg = (feats, p_len, pitch, pitchf,
                   sid) if hasp else (feats, p_len, sid)
            # now it comes out gpu and tensor
            audio1 = (net_g.infer(*arg)[0][0, 0]
                      ).data.to(self.device, non_blocking=True)
            del hasp, arg
        del feats, p_len, padding_mask
        # if torch.cuda.is_available():
        #     torch.cuda.empty_cache()
        t2 = ttime()
        times[0] += t1 - t0
        times[2] += t2 - t1
        return audio1

    def pipeline(
        self,
        model,
        net_g,
        sid,
        audio: torch.Tensor,
        times,
        f0_up_key,
        f0_method,
        index,
        index_rate,
        if_f0,
        filter_radius,
        version,
        protect,
        f0_spec: str | np.ndarray | None = None,
    ):
        (index, big_npy) = index
        # The butterworth highpass probably only serves as a safe gaurd, might want to remove it and ask ppl to add their own preprocessing step.
        # it's an extra memory expensive step for little gain.
        # I think the model also has a built in cutoff DB where it's not applied at ~-45db too.
        if enable_butterfilter:
            audio = torchaudio.functional.filtfilt(audio.to(torch.float64, non_blocking=True), ah, bh).to(
                torch.float32, non_blocking=True)  # assume on gpu
        # turning this into a torch section would speed it up
        npaud = audio.to(_cpu, non_blocking=False).numpy()
        audio_pad = np.pad(
            npaud, (self.window // 2, self.window // 2), mode="reflect")
        opt_ts = []
        if audio_pad.shape[0] > self.t_max:
            audio_sum = np.zeros_like(npaud)
            for i in range(self.window):
                audio_sum += np.abs(audio_pad[i: i - self.window])
            for t in range(self.t_center, npaud.shape[0], self.t_center):
                opt_ts.append(
                    t
                    - self.t_query
                    + np.where(
                        audio_sum[t - self.t_query: t + self.t_query]
                        == audio_sum[t - self.t_query: t + self.t_query].min()
                    )[0][0]
                )
        s = 0
        audio_opt = []
        t = None
        t1 = ttime()
        audio_pad = torch.nn.functional.pad(
            audio, (self.t_pad, self.t_pad), mode="reflect")
        del audio
        p_len = audio_pad.shape[1] // self.window
        if isinstance(f0_spec, str):
            try:
                with open(f0_spec, "r") as f:
                    lines = f.read().strip("\n").split("\n")
                f0_spec = []
                for line in lines:
                    f0_spec.append([float(i) for i in line.split(",")])
                f0_spec = np.array(f0_spec, dtype="float32")
            except:
                traceback.print_exc()
        sid = torch.tensor(sid, device=self.device).unsqueeze(0).long()
        pitch, pitchf = None, None
        if if_f0:
            pitch, pitchf = self.get_f0(
                audio_pad,
                p_len,
                f0_up_key,
                f0_method,
                filter_radius,
                f0_spec,
            )
            pitch = pitch[:p_len]
            pitchf = pitchf[:p_len]
            if "mps" not in str(self.device) or "xpu" not in str(self.device):
                pitchf = pitchf.astype(np.float32)
            pitch = torch.tensor(pitch, device=self.device).unsqueeze(0).long()
            pitchf = torch.tensor(
                pitchf, device=self.device).unsqueeze(0).float()
        t2 = ttime()
        times[1] += t2 - t1
        for t in opt_ts:
            t = t // self.window * self.window
            if if_f0 == 1:
                audio_opt.append(
                    self.vc(
                        model,
                        net_g,
                        sid,
                        audio_pad[s: t + self.t_pad2 + self.window],
                        pitch[:, s //
                              self.window: (t + self.t_pad2) // self.window],
                        pitchf[:, s //
                               self.window: (t + self.t_pad2) // self.window],
                        times,
                        index,
                        big_npy,
                        index_rate,
                        version,
                        protect,
                    )[self.t_pad_tgt: -self.t_pad_tgt]
                )
            else:
                audio_opt.append(
                    self.vc(
                        model,
                        net_g,
                        sid,
                        audio_pad[s: t + self.t_pad2 + self.window],
                        None,
                        None,
                        times,
                        index,
                        big_npy,
                        index_rate,
                        version,
                        protect,
                    )[self.t_pad_tgt: -self.t_pad_tgt]
                )
            s = t
        if if_f0 == 1:
            audio_opt.append(
                self.vc(
                    model,
                    net_g,
                    sid,
                    audio_pad[t:],
                    pitch[:, t // self.window:] if t is not None else pitch,
                    pitchf[:, t // self.window:] if t is not None else pitchf,
                    times,
                    index,
                    big_npy,
                    index_rate,
                    version,
                    protect,
                )[self.t_pad_tgt: -self.t_pad_tgt]
            )
        else:
            audio_opt.append(
                self.vc(
                    model,
                    net_g,
                    sid,
                    audio_pad[t:],
                    None,
                    None,
                    times,
                    index,
                    big_npy,
                    index_rate,
                    version,
                    protect,
                )[self.t_pad_tgt: -self.t_pad_tgt]
            )
        # audio_opt = np.concatenate(audio_opt)
        audio_opt = torch.cat(audio_opt, dim=0)
        del pitch, pitchf, sid
        return audio_opt
