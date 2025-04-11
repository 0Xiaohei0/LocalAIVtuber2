import { pipelineManager } from '../pipelineManager';
import { NodeDefinition } from './nodeDefinition'

export type ChatSource = "stream" | "microphone"

export const ChatNode: NodeDefinition = {
  type: 'chat',
  name: 'Chat',
  defaultSettings: {
    duration: 60, // in minutes
  },
  presets: {
    shortChat: {
      duration: 3
    },
    longChat: {
      duration: 120
    }
  },
  async execute(settings) {
    const duration = settings.duration as number
    const chatSource = settings.chatSource as string

    const endTime = new Date(Date.now() + duration * 60 * 1000);
    console.log("chatSource " + chatSource)

    while (new Date() < endTime) {
      const taskId = pipelineManager.addInputTask("Tell me a random thought you have.");
      const result = await pipelineManager.waitForTaskCompletion(taskId);
      return `Chat node finished with result ${result}.`;
    }
  }
};
