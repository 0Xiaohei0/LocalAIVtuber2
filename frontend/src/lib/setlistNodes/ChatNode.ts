import { pipelineManager } from '../pipelineManager';
import { StreamChatManager } from '../streamChatManager';
import { NodeDefinition } from './nodeDefinition'

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
    const duration = settings.duration as number;
    const endTime = new Date(Date.now() + duration * 60 * 1000);
    const messages: string[] = [];
    const streamChatManager = new StreamChatManager((message) => {
      messages.push(message);
    });

    try {
      // Start fetching stream chat
      await streamChatManager.startChatFetch();

      async function delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
      
      while (Date.now() < endTime.getTime()) {
        if (messages.length > 0) {
          const userMessage = messages[messages.length - 1];
          if (userMessage) {
            const taskId = pipelineManager.addInputTask(userMessage);
            await pipelineManager.waitForTaskCompletion(taskId);
          }
        }
        await delay(100);
      }
    } catch (error) {
      console.error("Error running Chat Node:", error);
    }
    finally {
      // Stop fetching stream chat
      await streamChatManager.stopChatFetch();
      streamChatManager.closeSocket();
    }

    return 'Chat node finished without any results.';
  }
};
