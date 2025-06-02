import { ArrowRightFromLine, ArrowLeftFromLine } from "lucide-react";
import { ReactNode, useState } from "react";
import { Panel } from "./panel";

interface SidePanelProps {
    children?: ReactNode;
    side?: "left" | "right";
    className?: string;
}

export function SidePanel({ children, className, side = "right" }: SidePanelProps) {
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

    const toggleSidePanel = () => {
        setIsSidePanelOpen((prev) => (!prev));
    };

    return (
        <div
            className={`absolute ${side === "right" ? "right-0" : "left-0"} top-0 h-full p-2 transition-transform duration-300 ${
                isSidePanelOpen 
                    ? "translate-x-0" 
                    : side === "right" 
                        ? "translate-x-full" 
                        : "-translate-x-full"
            } ${className || ''}`}
            style={{ zIndex: 1000 }}
        >
            <button
                className={`absolute ${side === "right" ? "left-[-40px]" : "right-[-40px]"} top-5 border p-2 rounded-md bg-background`}
                onClick={toggleSidePanel}
            >
                {isSidePanelOpen 
                    ? (side === "right" ? <ArrowRightFromLine /> : <ArrowLeftFromLine />)
                    : (side === "right" ? <ArrowLeftFromLine /> : <ArrowRightFromLine />)
                }
            </button>
            <Panel className="h-full w-2xs flex flex-col gap-2 items-start">
                {children}
            </Panel>
        </div>
    );
}