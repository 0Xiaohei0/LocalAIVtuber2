import { ArrowRightFromLine, ArrowLeftFromLine } from "lucide-react";
import { ReactNode, useState } from "react";
import { Panel } from "./panel";

interface SidePanelProps {
    children?: ReactNode;
    className?: string;
}


export function SidePanel({ children, className }: SidePanelProps) {

    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)

    const toggleSidePanel = () => {
        setIsSidePanelOpen((prev) => (!prev));
    }
    return (
            <div
                className={`absolute right-0 h-full p-2 transition-transform duration-300 ${isSidePanelOpen ? "translate-x-0" : "translate-x-full"
                    } ${className || ''}`}
            >
                {<button
                    className="absolute left-[-40px] top-5 border p-2 rounded-md bg-background"
                    onClick={toggleSidePanel}
                >
                    {isSidePanelOpen ? <ArrowRightFromLine /> : <ArrowLeftFromLine />}
                </button> 
                }
                <Panel className="h-full w-2xs flex flex-col gap-2 items-start">
                    {children}
                </Panel>
            </div>
    )
}