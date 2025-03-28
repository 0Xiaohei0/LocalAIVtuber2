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

const PipelineDebugger: React.FC = () => {
    const { tasks } = usePipelineSubscription();
    const [viewingTask, setViewingTask] = useState<boolean>(false);
    const [currentTask, setCurrentTask] = useState<Task>();

    useEffect(() => {
        if (viewingTask) return
        let unfinishedTask = tasks.find(task => !task.task_finished);
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
                        <ScrollArea>
                            <Panel className="h-36">
                                {currentTask?.input}
                            </Panel>
                        </ScrollArea>
                    </div>
                    <div className="flex flex-col gap-4">
                        <Label>Response</Label>
                        <ScrollArea className="overflow-auto">
                            <Panel className="h-36">
                                {currentTask?.response.map((res, index) => (
                                    <span key={`${index}`}
                                        className=
                                            {`${res.audio && !res.playback_finished ? "bg-yellow-800" : ""} 
                                            ${res.playback_finished ? "bg-green-800" : ""}`}>
                                        {res.text}
                                    </span>
                                ))}
                            </Panel>
                        </ScrollArea>
                    </div>
                </div>
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
                            <TableRow key={task.id}onClick={() => { setViewingTask(true); setCurrentTask(task) }}>
                                <TableCell className="font-medium">{task.input}</TableCell>
                                <TableCell className="flex gap-1 p-5 flex-wrap">{task.response.map((res, index) => (
                                    <div key={`response-${task.id}-${index}`} className="flex">
                                        <div className={`w-4 h-2 rounded-l-full  ${res.text ? "bg-accent-foreground" : "bg-gray-500"}`}></div>
                                        <div className={`w-4 h-2 ${res.audio ? "bg-accent-foreground" : "bg-gray-500"}`}></div>
                                        <div className={`w-4 h-2 rounded-r-full  ${res.playback_finished ? "bg-accent-foreground" : "bg-gray-500"}`}></div>
                                    </div>
                                ))}</TableCell>
                                <TableCell className="font-medium">{task.task_finished && <Badge variant="secondary">Finished</Badge>}{task.cancelled && <Badge variant="destructive">Aborted</Badge>}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default PipelineDebugger;
