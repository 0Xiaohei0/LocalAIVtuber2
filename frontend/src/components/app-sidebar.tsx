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
const testPipelineKeys: PageKey[] = ["input", "llm", "tts", "pipeline-monitor", "character", "stream", "memory"]
const footerKeys: PageKey[] = ["settings"]



export function AppSidebar({ onItemClick }: { onItemClick: (key: PageKey) => void }) {
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
                        <SidebarMenuButton asChild>
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
                  <SidebarMenuButton asChild>
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
