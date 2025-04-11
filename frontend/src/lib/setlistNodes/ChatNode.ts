import { NodeDefinition } from './nodeDefinition'

export const ChatNode: NodeDefinition = {
  type: 'chat',
  name: 'Chat',
  defaultSettings: {
    duration: 60, // in minutes
    chatSource: "stream"
  },
  presets: {
    shortChat: {
      duration: 3,
      chatSource: "stream"
    },
    longChat: {
      duration: 120,
      chatSource: "microphone"
    }
  },
  async execute(settings) {
    const duration = settings.duration as number
    const chatSource = settings.chatSource as string
    return `Chat node finished after ${duration} minutes from ${chatSource}`
  }
}
