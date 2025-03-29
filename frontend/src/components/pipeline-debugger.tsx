import React, { useEffect, useState } from "react";
import { usePipelineSubscription } from "@/hooks/use-pipeline-subscriptions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Panel } from "./panel";
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Task } from "@/constants/types";
import { Badge } from "@/components/ui/badge"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";

const PipelineDebugger: React.FC = () => {
    const { tasks } = usePipelineSubscription();
    const [viewingTask, setViewingTask] = useState<boolean>(false);
    const [currentTask, setCurrentTask] = useState<Task>();
    const [isOpen, setIsOpen] = React.useState(false)

    useEffect(() => {
        if (viewingTask) return
        let unfinishedTask = tasks.find(task => !(task.status == "task_finished"));
        if (!unfinishedTask && tasks.length > 0) unfinishedTask = tasks[-1]
        setCurrentTask(unfinishedTask)
    }, [tasks])

    return (
        <div>
            <Panel className="max-w-4xl mx-auto">
                <h2 className="text-xl font-bold mb-4">Current Task</h2>
                <div className="grid grid-cols-2 gap-4"
                    style={{
                        gridTemplateColumns: '0.3fr 0.7fr',
                    }}>
                    <div className="flex flex-col gap-4">
                        <Label>Input</Label>
                        <Panel className="h-36">
                            <ScrollArea className="overflow-auto h-full">
                                {currentTask?.input}
                            </ScrollArea>
                        </Panel>
                    </div>
                    <div className="flex flex-col gap-4">
                        <Label>Response</Label>
                        <Panel className="h-36">
                            <ScrollArea className="overflow-auto h-full">
                                {currentTask?.response.map((res, index) => (
                                    <span key={`${index}`}
                                        className=
                                        {`${res.audio && !res.playback_finished ? "bg-yellow-800" : ""} 
                                                ${res.playback_finished ? "bg-green-800" : ""}`}>
                                        {res.text}
                                    </span>
                                ))}
                            </ScrollArea>
                        </Panel>
                    </div>
                </div>

                <Collapsible
                    open={isOpen}
                    onOpenChange={setIsOpen}
                    className="w-full space-y-2 mt-4"
                >
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">
                            raw data
                        </h4>
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4"></ChevronUp>}
                                <span className="sr-only">Toggle</span>
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="space-y-2">
                        <div className="font-mono text-sm shadow-sm">
                            {JSON.stringify(currentTask)}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </Panel>
            <div className="p-4 border rounded-md bg-input/50 shadow max-w-4xl mx-auto mt-6">
                <h2 className="text-xl font-bold mb-4">Pipeline Status</h2>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Input</TableHead>
                            <TableHead>Response</TableHead>
                            <TableHead className="w-[100px]">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tasks.map((task) => (
                            <TableRow key={task.id} onClick={() => { setViewingTask(true); setCurrentTask(task) }}>
                                <TableCell className="font-medium">{task.input}</TableCell>
                                <TableCell className="flex gap-1 p-5 flex-wrap">{task.response.map((res, index) => (
                                    <div key={`response-${task.id}-${index}`} className="flex">
                                        <div className={`w-4 h-2 rounded-l-full  ${res.text ? "bg-accent-foreground" : "bg-gray-500"}`}></div>
                                        <div className={`w-4 h-2 ${res.audio ? "bg-accent-foreground" : "bg-gray-500"}`}></div>
                                        <div className={`w-4 h-2 rounded-r-full  ${res.playback_finished ? "bg-accent-foreground" : "bg-gray-500"}`}></div>
                                    </div>
                                ))}</TableCell>
                                <TableCell className="font-medium">{task.status == "task_finished" && <Badge variant="secondary">Finished</Badge>}{task.status == "cancelled" && <Badge variant="destructive">Aborted</Badge>}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default PipelineDebugger;
