import {SessionInfo} from '@/pages/llmPage'

export function ChatSidebar({ onItemClick, sessions }: { onItemClick: (session_info: SessionInfo) => void, sessions:SessionInfo[]}) {
  
  return (
    <div className='h-full flex flex-col bg-background p-2'>
      {sessions.map((session)=>(
        <div className='bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:hover:bg-input/50 p-1' 
        onClick={()=>{onItemClick(session)}}>{session.title}</div> 
      ))}
    </div>
  )
}
