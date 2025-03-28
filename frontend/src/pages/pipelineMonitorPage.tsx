import PipelineDebugger from "@/components/pipeline-debugger"

function PipelineMonitorPage() {
    return (
        <div className="p-5">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">Pipeline Monitor</h3>
            <PipelineDebugger />
        </div>
    )
  }
  
  export default PipelineMonitorPage