import { NodeDefinition } from './nodeDefinition'
import { pipelineManager } from '../pipelineManager';

export const PromptedResponseNode: NodeDefinition = {
  type: 'promptedResponse',
  name: 'Prompted Response',
  defaultSettings: {
    prompt: ''
  },
  presets: {
    intro: {
      prompt: 'Introduce the stream in a friendly manner.'
    },
    outro: {
      prompt: 'Conclude the stream with a final remark.'
    }
  },
  async execute(settings) {
    const promptValue = settings.prompt as string || '';
    
    const taskId = pipelineManager.addInputTask(promptValue);
    const result = await pipelineManager.waitForTaskCompletion(taskId);

    return `Prompted Response node finished with result ${result}.`
  }
};