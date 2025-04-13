import { PromptedResponseNode } from './PromptedResponseNode'
import { ChatNode } from './ChatNode'
import { NodeDefinition } from './nodeDefinition'
import { SingNode } from './SingNode'
import { SystemPromptNode } from './SystemPromptNode'

const nodeRegistry: NodeDefinition[] = [
  SystemPromptNode,
  PromptedResponseNode,
  ChatNode,
  SingNode
]

export function getNodeDefinition(type: string) {
  return nodeRegistry.find(nodeDef => nodeDef.type === type)
}

export { nodeRegistry }