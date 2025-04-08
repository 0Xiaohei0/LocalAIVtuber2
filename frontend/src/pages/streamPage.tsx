import { KaraokeStream } from "@/components/karaoke-stream"

function StreamPage() {
    return (
        <div className="p-5">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">Stream</h3>
            <KaraokeStream></KaraokeStream>
        </div>
    )
  }
  
  export default StreamPage