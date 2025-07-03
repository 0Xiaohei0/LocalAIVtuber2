import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReactNode, useState } from "react";
import { Panel } from "./panel";

interface SidePanelProps {
    children?: ReactNode;
    side?: "left" | "right";
    className?: string;
    isOpen?: boolean;
}

export function SidePanel({ children, className, side = "right", isOpen = false }: SidePanelProps) {
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(isOpen);

    const toggleSidePanel = () => {
        setIsSidePanelOpen((prev) => (!prev));
    };

    return (
        <div
            className={`absolute ${side === "right" ? "right-0" : "left-0"} top-0 h-full transition-transform duration-300 ${
                isSidePanelOpen 
                    ? "translate-x-0" 
                    : side === "right" 
                        ? "translate-x-full" 
                        : "-translate-x-full"
            } ${className || ''}`}
            style={{ zIndex: 40 }}
        >
            <button
                className={`absolute ${side === "right" ? "left-[-25px] rounded-l-sm" : "right-[-25px] rounded-r-sm"} top-5 border  bg-background dark:border-input`}
                onClick={toggleSidePanel}
            >
                {isSidePanelOpen 
                    ? (side === "right" ? <ChevronRight /> : <ChevronLeft />)
                    : (side === "right" ? <ChevronLeft /> : <ChevronRight />)
                }
            </button>
            <Panel className="h-full w-2xs flex flex-col gap-2 items-start  rounded-none">
                {children}
            </Panel>
        </div>
    );
}