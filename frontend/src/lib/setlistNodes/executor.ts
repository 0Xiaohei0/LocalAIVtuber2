import { getNodeDefinition } from "./NodeRegistry"

export interface SetlistItem {
    nodeType: string
    settings: Record<string, unknown>
  }


export async function executeSetlist(items: SetlistItem[]) {
  for (const item of items) {
    const nodeDef = getNodeDefinition(item.nodeType)
    if (!nodeDef) {
      throw new Error(`Node definition not found for type: ${item.nodeType}`)
    }

    const finalSettings = { ...nodeDef.defaultSettings, ...item.settings }
    const result = await nodeDef.execute(finalSettings)
     console.log(result)
  }
}