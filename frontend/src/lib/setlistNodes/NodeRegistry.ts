import { PromptedResponseNode } from './PromptedResponseNode'
import { ChatNode } from './ChatNode'
import { NodeDefinition } from './nodeDefinition'

const nodeRegistry: NodeDefinition[] = [
  PromptedResponseNode,
  ChatNode
]

export function getNodeDefinition(type: string) {
  return nodeRegistry.find(nodeDef => nodeDef.type === type)
}

export { nodeRegistry }