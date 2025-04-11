// components/SetlistEditor.tsx
import { SetlistItem, executeSetlist } from '@/lib/setlistNodes/executor'
import { getNodeDefinition, nodeRegistry } from '@/lib/setlistNodes/NodeRegistry'
import { useState } from 'react'
import { NodeSettingsEditor } from './NodeSettingsEditor'
import { Plus, X } from 'lucide-react'
import { Panel } from './panel'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { useSettings } from '@/context/SettingsContext'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SetlistEditor() {
  const { settings, updateSetting } = useSettings();
  const setlist: SetlistItem[] = settings["frontend.stream.setlist"] || [];
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const addNode = async (nodeType: string) => {
    const nodeDef = getNodeDefinition(nodeType)
    if (!nodeDef) return

    const updatedSetlist = [...setlist, {
      nodeType,
      settings: { ...nodeDef.defaultSettings }
    }];
    await updateSetting("frontend.stream.setlist", updatedSetlist);
  };

  const removeNode = async (index: number) => {
    const updatedSetlist = setlist.filter((_, i) => i !== index);
    await updateSetting("frontend.stream.setlist", updatedSetlist);
  }


  function selectNode(index: number) {
    setSelectedIndex(index)
  }

  async function onRun() {
    await executeSetlist(setlist)
    alert('Setlist execution finished!')
  }

  return (
    <div className='flex gap-4 w-full'>

      <Panel className="flex flex-col gap-4 w-xl">
        <Label>Set list</Label>
        {setlist.map((item, index) => (
          <div key={index} className="flex items-center gap-2 w-full" onClick={() => selectNode(index)}>
            <Panel className="flex w-full py-0 px-0">
              <div className="flex w-full my-4 ml-4 mr-0">
                <p>{getNodeDefinition(item.nodeType)?.name || item.nodeType}</p>
              </div>
              <Button className="size-1 mr-1 mt-1" variant="ghost" onClick={() => removeNode(index)}>
                <X></X>
              </Button>
            </Panel>
          </div>
        ))}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger>
            <Panel className="flex justify-center">
              <Plus></Plus>
            </Panel>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Node</DialogTitle>
              <DialogDescription>
                Select a node from the list below:
              </DialogDescription>
            </DialogHeader>
            {nodeRegistry.map((nodeDef, index) => (
              <Panel key={index} className="flex w-full py-0 px-0">
                <div className="flex w-full my-4 ml-4 mr-0" onClick={() => { addNode(nodeDef.type); setIsDialogOpen(false) }}>
                  <p>{nodeDef.type}</p>
                </div>
              </Panel>
            ))}
          </DialogContent>
        </Dialog>

        <Button onClick={onRun}>Run Setlist</Button>
      </Panel>
      <Panel className="flex flex-col gap-4 w-xl">
        {selectedIndex !== null && (
          <NodeSettingsEditor
            item={setlist[selectedIndex]}
            onChange={async (updated: SetlistItem) => {
              const updatedSetlist = [...setlist];
              updatedSetlist[selectedIndex] = updated
              await updateSetting("frontend.stream.setlist", updatedSetlist);
            }
            }
          />
        )}
      </Panel>

    </div>
  )
}
