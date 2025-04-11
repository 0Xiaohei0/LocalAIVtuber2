import { ReactNode } from 'react';
import { cn } from "@/lib/utils"

interface PanelProps {
  children?: ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  return (
    <div
      className={cn("border bg-background p-4 rounded-md dark:bg-input/30 dark:border-input", className)}
    >
      {children}
    </div>
  );
}