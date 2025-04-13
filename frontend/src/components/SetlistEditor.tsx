// components/SetlistEditor.tsx
import { SetlistItem, executeSetlist } from '@/lib/setlistNodes/executor'
import { getNodeDefinition, nodeRegistry } from '@/lib/setlistNodes/NodeRegistry'
import { useState } from 'react'
import { NodeSettingsEditor } from './NodeSettingsEditor'
import { ArrowDownFromLine, ArrowUpFromLine, Plus, X } from 'lucide-react'
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
  const [isSetlistRunning, setIsSetlistRunning] = useState(false);

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

  const moveNode = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    // Ensure target index is within bounds
    if (targetIndex >= 0 && targetIndex < setlist.length) {
      const updatedSetlist = [...setlist];
      // Swap nodes
      [updatedSetlist[index], updatedSetlist[targetIndex]] = [
        updatedSetlist[targetIndex],
        updatedSetlist[index],
      ];
      await updateSetting("frontend.stream.setlist", updatedSetlist);
    }
  };

  function selectNode(index: number) {
    if (selectedIndex == index) {
      setSelectedIndex(null)
    }
    else {
      setSelectedIndex(index)
    }
    
  }

  async function onRun() {
    setIsSetlistRunning(true)
    await executeSetlist(setlist)
  }

  async function onStop() {
    setIsSetlistRunning(false)
    // stop the execution somehow
  }

  return (
    <div className='flex gap-4 w-screen'>

      <Panel className="flex flex-col gap-4 w-sm">
        <Label>Set list</Label>
        {setlist.map((item, index) => (
          <div key={index} className="flex items-center gap-2 w-full" onClick={() => selectNode(index)}>
            <Panel className={`flex w-full py-0 px-0 ${selectedIndex === index ? "border dark:border-primary" : ""}`}>
              <div className="flex w-full my-4 ml-4 mr-0">
                <p>{getNodeDefinition(item.nodeType)?.name || item.nodeType}</p>
                <div className="flex flex-col justify-between ml-auto">
                  <Button
                    className="size-1"
                    variant="ghost"
                    onClick={() => moveNode(index, "up")}
                    disabled={index === 0}
                  >
                    <ArrowUpFromLine />
                  </Button>
                  <Button
                    className="size-1"
                    variant="ghost"
                    onClick={() => moveNode(index, "down")}
                    disabled={index === setlist.length - 1}
                  >
                    <ArrowDownFromLine />
                  </Button>
                </div>
              </div>
              <Button className="size-1 mr-1 mt-1" variant="ghost" onClick={() => removeNode(index)}>
                <X />
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
                  <p>{nodeDef.name}</p>
                </div>
              </Panel>
            ))}
          </DialogContent>
        </Dialog>

        {
          isSetlistRunning ?
          <Button variant={"destructive"} onClick={onStop}>Stop Setlist</Button>
          :
        <Button onClick={onRun}>Start Setlist</Button>
        }
      </Panel>
      <Panel className="flex flex-col gap-4 w-xl">
      {selectedIndex === null && <Label>Select from setlist</Label>}
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
