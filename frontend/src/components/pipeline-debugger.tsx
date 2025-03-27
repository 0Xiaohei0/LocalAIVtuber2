import React from "react";
import { usePipelineSubscription } from "@/hooks/use-pipeline-subscriptions";

const PipelineDebugger: React.FC = () => {
    const { tasks } = usePipelineSubscription();

    return (
        <div className="p-4 border rounded-md bg-input/50 shadow max-w-4xl mx-auto mt-6">
            <h2 className="text-xl font-bold mb-4">🧪 Pipeline Debugger</h2>
            {tasks.length === 0 ? (
                <p className="text-gray-500">No tasks in queue.</p>
            ) : (
                <div className="space-y-4">
                    {tasks.map((task) => (
                        // <div
                        //     key={taskIndex}
                        //     className="border rounded-md p-3 bg-gray-50"
                        // >
                        //     <div className="mb-2">
                        //         <span className="font-semibold">Task #{taskIndex + 1}</span>
                        //     </div>
                        //     {task.input && (
                        //         <p className="text-sm text-gray-700">
                        //             <strong>Input:</strong> {task.input}
                        //         </p>
                        //     )}
                        //     <p className="text-sm text-gray-700">
                        //         <strong>LLM Finished:</strong>{" "}
                        //         {task.llm_finished ? "✅" : "❌"}
                        //     </p>
                        //     <p className="text-sm text-gray-700">
                        //         <strong>Task Finished:</strong>{" "}
                        //         {task.task_finished ? "✅" : "❌"}
                        //     </p>
                        //     <p className="text-sm text-gray-700">
                        //         <strong>Cancelled:</strong>{" "}
                        //         {task.cancelled ? "🛑" : "—"}
                        //     </p>

                        //     {task.response.length > 0 && (
                        //         <div className="mt-2">
                        //             <p className="text-sm font-medium mb-1">Responses:</p>
                        //             <ul className="pl-4 list-disc space-y-1">
                        //                 {task.response.map((res, resIndex) => (
                        //                     <li key={resIndex} className="text-sm text-gray-600">
                        //                         <strong>{res.text}</strong>
                        //                         {res.audio && (
                        //                             <span className="ml-2 text-green-600">
                        //                                 🎧 audio
                        //                             </span>
                        //                         )}
                        //                         {res.playback_finished && (
                        //                             <span className="ml-2 text-blue-600">
                        //                                 ✔ played
                        //                             </span>
                        //                         )}
                        //                     </li>
                        //                 ))}
                        //             </ul>
                        //         </div>
                        //     )}
                        // </div>
                        <div key={task.id}>
                            {JSON.stringify(task)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PipelineDebugger;
