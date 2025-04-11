export interface NodeDefinition {
  type: string
  name: string
  defaultSettings: Record<string, unknown>
  presets: Record<string, Record<string, unknown>>
  execute: (settings: Record<string, unknown>) => Promise<unknown>
}