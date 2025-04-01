import { SessionInfo } from '@/pages/llmPage'
import { Ellipsis, SquarePen, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from 'react'

export function ChatSidebar({ onItemClick, onChangeTitle,onDeleteSession, sessions }:
  {
    onItemClick: (session_info: SessionInfo) => void,
    onChangeTitle: (session_info: SessionInfo) => void,
    onDeleteSession: (session_info: SessionInfo) => void,
    sessions: SessionInfo[]
  }) {

  const [editingId, setEditingId] = useState<string>("")
  const handleRename = (sessionInfo: SessionInfo) => {
    onChangeTitle(sessionInfo)
    setEditingId("")
  }

  return (
    <div className='relative flex flex-col bg-background p-2 max-w-3xl mx-auto h-[calc(100vh-50px-17px)]'>
      {sessions.length == 0 ? <div className='text-center text-sm text-muted-foreground'>Memory Empty</div> : <></>}
      {sessions.map((session) => (
        <div key={session.id}
          onClick={() => { onItemClick(session) }}
          className='flex hover:bg-accent hover:text-accent-foreground dark:hover:bg-input/50 rounded-xs p-1'>
          {editingId != session.id && <div className='mr-auto'>{session.title}</div>}
          {editingId == session.id &&
            <input
              defaultValue={session.title}
              onBlur={(e) => {
                handleRename({ id: session.id, title: e.target.value.trim() })
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRename({ id: session.id, title: (e.target as HTMLInputElement).value.trim() })
                }
              }} />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Ellipsis></Ellipsis></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setEditingId(session.id)} ><SquarePen></SquarePen>Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteSession(session)}className='text-destructive'><Trash2></Trash2>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  )
}
