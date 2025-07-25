import { SetlistItem } from "@/lib/setlistNodes/executor"
import { getNodeDefinition } from "@/lib/setlistNodes/NodeRegistry"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Textarea } from "./ui/textarea"
import { Label } from "./ui/label"
import { Input } from "./ui/input"


interface Props {
  item: SetlistItem
  onChange: (updated: SetlistItem) => void
}

export function NodeSettingsEditor({ item, onChange }: Props) {
  if (!item) return null
  const nodeDef = getNodeDefinition(item.nodeType)
  if (!nodeDef) return null

  function updateField(fieldKey: string, value: unknown) {
    onChange({
      ...item,
      settings: { ...item.settings, [fieldKey]: value }
    })
  }

  function applyPreset(presetKey: string) {
    if (!nodeDef) return null
    const preset = nodeDef.presets[presetKey]
    onChange({
      ...item,
      settings: { ...item.settings, ...preset }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Label >Node Settings - {nodeDef.name}</Label>
      {Object.keys(nodeDef.presets).length > 0 && (
        <>
          <Select onValueChange={applyPreset}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key={"def"} value={"def"}>
                None
              </SelectItem>
              {Object.keys(nodeDef.presets).map((presetKey) => (
                <SelectItem key={presetKey} value={presetKey}>
                  {presetKey}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      {Object.entries(nodeDef.defaultSettings).map(([fieldKey, defaultValue]) => (
        <div key={fieldKey} className="flex flex-col gap-2">
          <Label>{fieldKey}</Label>
          {(() => {
            const value = item.settings[fieldKey] ?? defaultValue; // Fallback to default value
            if (typeof value === "string") {
              return (
                <Textarea
                  value={String(value)}
                  onChange={(e) => updateField(fieldKey, e.target.value)}
                />
              );
            } else if (typeof value === "number") {
              return (
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => updateField(fieldKey, Number(e.target.value))}
                />
              );
            }
            return null;
          })()}
        </div>
      ))}
    </div>
  )
}
