import { songDataList } from '@/constants/songData';
import { NodeDefinition } from './nodeDefinition'

export const SingNode: NodeDefinition = {
  type: 'sing',
  name: 'Sing',
  defaultSettings: {
    songName:""
  },
  presets: {
    Everlasting: {
      songName:"Everlasting Summer"
    },
    Renai: {
      songName:"Renai Circulation"
    },
  },
  async execute(settings) {
    const songName = settings.songName as string;
    const songData = songDataList.find((data) => data.songName === songName);

    if (!songData) {
      console.error(`Song not found: ${songName}`);
      return;
    }

    // Create an HTMLAudioElement to play the song
    const audio = new Audio(songData.fileName);

    console.log(`Playing song: ${songName} (${songData.fileName})`);

    // Play the audio and wait for it to finish
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = (error) => {
        console.error(`Error playing song: ${songName}`, error);
        reject(error);
      };
      audio.play().catch((error) => {
        console.error(`Error starting playback for song: ${songName}`, error);
        reject(error);
      });
    });
  }
};
