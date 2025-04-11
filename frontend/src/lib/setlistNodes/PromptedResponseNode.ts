import { NodeDefinition } from './nodeDefinition'

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
    const promptValue = settings.prompt as string || ''
    const result = `Pretend we invoked some AI with prompt: ${promptValue}`
    return result
  }
}
