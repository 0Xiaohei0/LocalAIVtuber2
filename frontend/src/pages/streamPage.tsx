import { Stream } from "@/components/stream"
import { Label } from "@/components/ui/label"

function StreamPage() {


    return (
        <div className="p-5 flex flex-col gap-4">
            <Label className="text-sm text-muted-foreground">This is still an experiemental feature.</Label> 
            <Stream></Stream>
        </div>
    )
  }
  
  export default StreamPage