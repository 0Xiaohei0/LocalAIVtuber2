import pageMapping from "@/constants/page-mapping"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ModeToggle } from "./mode-toggle"
import React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


type PageKey = keyof typeof pageMapping
// Menu items.
const testPipelineKeys: PageKey[] = ["llm",  "character", "memory"]
const footerKeys: PageKey[] = ["input","vision","tts", "pipeline-monitor", "stream", "settings"]



export function AppSidebar({ onItemClick, activePage }: { onItemClick: (key: PageKey) => void, activePage?: PageKey }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Test pipeline</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {testPipelineKeys.map((key) => (
                <SidebarMenuItem key={key}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <SidebarMenuButton asChild isActive={key === activePage}>
                          <a onClick={() => onItemClick(key)}>
                            {React.createElement(pageMapping[key].icon)}
                            <span>{pageMapping[key].title}</span>
                          </a>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side={"right"} >
                        <p>{pageMapping[key].title}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {footerKeys.map((key) => (
            <SidebarMenuItem key={key}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <SidebarMenuButton asChild isActive={key === activePage}>
                    <a onClick={() => onItemClick(key)}>
                      {React.createElement(pageMapping[key].icon)}
                      <span>{pageMapping[key].title}</span>
                    </a>
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side={"right"} >
                  <p>{pageMapping[key].title}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <ModeToggle></ModeToggle>
      </SidebarFooter>
    </Sidebar>
  )
}
