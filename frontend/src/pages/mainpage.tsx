import { useState } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import pageMapping from "@/constants/page-mapping"
import { SettingsProvider } from "@/context/SettingsContext"

type PageKey = keyof typeof pageMapping

function Mainpage() {
    const [currentPage, setCurrentPage] = useState<PageKey>("llm")

    return (
        <SidebarProvider open={false}>
            <SettingsProvider>
                    <AppSidebar onItemClick={setCurrentPage} activePage={currentPage} />
                    <div className="flex flex-col w-full h-screen">
                        <main className="flex-1 relative">
                            {Object.entries(pageMapping).map(([key, { page: PageComponent }]) => {
                                const isActive = currentPage === key;
                                const keepMounted = key === "character" || key === "llm" || key === "vision";

                                // Special handling for character page - minimize instead of unmount
                                if (keepMounted) {
                                    return (
                                        <div
                                            key={key}
                                            style={{
                                                width: isActive ? "100%" : "1px",
                                                height: isActive ? "100%" : "1px",
                                                position: "absolute",
                                                overflow: isActive ? "visible" : "hidden",
                                                pointerEvents: isActive ? "auto" : "none",
                                            }}
                                        >
                                            <PageComponent isActive={isActive} />
                                        </div>
                                    );
                                }

                                // Normal handling for other pages - mount/unmount
                                return isActive ? (
                                    <div key={key} className="absolute w-full h-full">
                                        <PageComponent isActive={true} />
                                    </div>
                                ) : null;
                            })}
                        </main>
                    </div>
            </SettingsProvider>
        </SidebarProvider>
    );
}

export default Mainpage;