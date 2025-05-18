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

        async function* messageProcessor() {
            while (Date.now() < endTime.getTime()) {
                if (messages.length > 0) {
                    const userMessage = messages.pop();
                    if (userMessage) {
                        const taskId = pipelineManager.addInputTask(userMessage);
                        await pipelineManager.waitForTaskCompletion(taskId);
                    }
                } else {
                  const taskId = pipelineManager.addInputTask("There is no message.");
                  await pipelineManager.waitForTaskCompletion(taskId);
                }
                yield new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        for await (const _ of messageProcessor()) {
            // Non-blocking loop iteration
        }
    } catch (error) {
        console.error("Error running Chat Node:", error);
    } finally {
        // Stop fetching stream chat
        await streamChatManager.stopChatFetch();
        streamChatManager.closeSocket();
    }

    return 'Chat node finished without any results.';
}
};
