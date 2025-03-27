import { useEffect, useState } from "react";
import { Task } from "@/constants/types";
import { pipelineManager } from "@/lib/pipelineManager";

export const usePipelineSubscription = () => {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const unsubscribe = pipelineManager.subscribe(setTasks);
    return () => { unsubscribe(); };
  }, []);

  return { tasks };
};
