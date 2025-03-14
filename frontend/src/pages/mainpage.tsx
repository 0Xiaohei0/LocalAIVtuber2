import { useState } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import pageMapping from "@/constants/pageMapping"

type PageKey = keyof typeof pageMapping

function Mainpage() {

    const [currentPage, setCurrentPage] = useState("input")
        
    const renderPage = () => {
        const PageComponent = pageMapping[currentPage]?.page || pageMapping["input"].page
        return <PageComponent />
    }
  
    return (
        <SidebarProvider>
            <AppSidebar onItemClick={setCurrentPage}/>
            <main>
                <SidebarTrigger className='m-1' />
                {renderPage()}
            </main>
        </SidebarProvider>
    )
  }
  
  export default Mainpage