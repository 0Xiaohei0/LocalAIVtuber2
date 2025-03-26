import { useState } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import pageMapping from "@/constants/pageMapping"

type PageKey = keyof typeof pageMapping

function Mainpage() {

    const [currentPage, setCurrentPage] = useState<PageKey>("input")
        
    const renderPage = () => {
        const PageComponent = pageMapping[currentPage]?.page || pageMapping["input"].page
        return <PageComponent />
    }
  
    return (
        <SidebarProvider open={false}>
            <AppSidebar onItemClick={setCurrentPage}/>
            <div className="flex flex-col w-full h-screen">
                <main className="flex-1">
                    {renderPage()}
                </main>
            </div>
        </SidebarProvider>
    )
  }
  
  export default Mainpage