import pageMapping from "@/constants/pageMapping"

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

type PageKey = keyof typeof pageMapping
// Menu items.
const testPipelineKeys: PageKey[] = ["input", "llm", "tts", "pipeline-monitor"]
// const otherSettingKeys: PageKey[] = ["memory", "pipeline-monitor"]



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
                  <SidebarMenuButton asChild>
                    <a onClick={() => onItemClick(key)}>
                    {React.createElement(pageMapping[key].icon)}
                      <span>{pageMapping[key].title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>

          {/* <SidebarGroupLabel>Other Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
            {otherSettingKeys.map((key) => (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton asChild>
                    <a onClick={() => onItemClick(key)}>
                    {React.createElement(pageMapping[key].icon)}
                      <span>{pageMapping[key].title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent> */}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
      <ModeToggle></ModeToggle>
      </SidebarFooter>
    </Sidebar>
  )
}
