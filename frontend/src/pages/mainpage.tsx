import { useState } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import pageMapping from "@/constants/pageMapping"
import { SettingsProvider } from "@/context/SettingsContext"

type PageKey = keyof typeof pageMapping

function Mainpage() {

    const [currentPage, setCurrentPage] = useState<PageKey>("stream")


    return (
        <SidebarProvider open={false}>
            <SettingsProvider>
                <AppSidebar onItemClick={setCurrentPage} />
                <div className="flex flex-col w-full h-screen">
                    <main className="flex-1 relative">
                        {Object.entries(pageMapping).map(([key, { page: PageComponent }]) => (
                            <div
                                key={key}
                                style={{ // workaround for live2d broken when setting display: none
                                    width: currentPage === key ? "100%" : "1px",
                                    height: currentPage === key ? "100%" : "1px",
                                    position: currentPage === key ? "absolute" : "absolute",
                                    overflow: currentPage === key ? "visible" : "hidden",
                                    pointerEvents: currentPage === key ? "auto" : "none",
                                }}

                            >
                                <PageComponent />
                            </div>
                        ))}
                    </main>
                </div>

            </SettingsProvider>
        </SidebarProvider>
    )
}

export default Mainpage