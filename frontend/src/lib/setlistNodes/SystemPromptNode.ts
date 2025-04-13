import { globalStateManager } from '../globalStateManager';
import { NodeDefinition } from './nodeDefinition'

export const SystemPromptNode: NodeDefinition = {
  type: 'systemPrompt',
  name: 'System Prompt',
  defaultSettings: {
    systemprompt: ''
  },
  presets: {
    default: {
      systemprompt: 'You are hosting a karaoke stream today where the plan is to sing and chat with viewers.'
    },
  },
  async execute(settings) {
    const promptValue = settings.systemprompt as string || '';
    globalStateManager.updateState("systemPrompt", promptValue)
  }
};