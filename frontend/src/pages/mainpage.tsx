import { useState } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import pageMapping from "@/constants/pageMapping"
import { Breadcrumb, BreadcrumbItem, BreadcrumbPage} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"

type PageKey = keyof typeof pageMapping

function Mainpage() {

    const [currentPage, setCurrentPage] = useState<PageKey>("input")
        
    const renderPage = () => {
        const PageComponent = pageMapping[currentPage]?.page || pageMapping["input"].page
        return <PageComponent />
    }
  
    return (
        <SidebarProvider>
            <AppSidebar onItemClick={setCurrentPage}/>
            <div className="flex flex-col w-full h-screen">
                <div className="sticky top-0  flex h-16 shrink-0 items-center gap-2">
                    <div className="flex items-center gap-2 px-3">
                        <SidebarTrigger className='m-1' />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <Breadcrumb>
                            <BreadcrumbItem>
                                <BreadcrumbPage>{pageMapping[currentPage]?.title}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </Breadcrumb>
                    </div>
                </div>
                <main className="flex-1">
                    {renderPage()}
                </main>
            </div>
            
        </SidebarProvider>
    )
  }
  
  export default Mainpage