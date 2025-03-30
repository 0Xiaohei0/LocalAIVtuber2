import { useState } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import pageMapping from "@/constants/pageMapping"

type PageKey = keyof typeof pageMapping

function Mainpage() {

    const [currentPage, setCurrentPage] = useState<PageKey>("character")
        
  
    return (
        <SidebarProvider open={false}>
        <AppSidebar onItemClick={setCurrentPage} />
        <div className="flex flex-col w-full h-screen">
            <main className="flex-1 relative">
              {Object.entries(pageMapping).map(([key, { page: PageComponent }]) => (
                <div
                  key={key}
                  style={{
                    display: currentPage === key ? 'block' : 'none',
                  }}
                  className="absolute inset-0"
                >
                  <PageComponent />
                </div>
              ))}
            </main>
        </div>
      </SidebarProvider>
    )
  }
  
  export default Mainpage