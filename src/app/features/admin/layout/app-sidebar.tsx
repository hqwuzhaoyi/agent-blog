// Adapted from satnaing/shadcn-admin/src/components/layout/app-sidebar.tsx (MIT).
import { Link } from "@tanstack/react-router";
import { siteConfig } from "../../../site";
import {
  AudioLines,
  CheckCheck,
  ClipboardCheck,
  Settings,
  NotebookPen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "../ui/sidebar";
import { NavGroup } from "./nav-group";
import { NavUser } from "./nav-user";
const navigation = {
  title: "工作台",
  items: [
    { title: "待确认", url: "/admin", icon: ClipboardCheck },
    { title: "已发布", url: "/admin/published", icon: CheckCheck },
    { title: "播客", url: "/admin/episodes", icon: AudioLines },
    { title: "设置", url: "/admin/settings", icon: Settings },
  ],
};
export function AppSidebar({
  onLogout,
  pending,
}: {
  onLogout: () => void;
  pending: boolean;
}) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <NotebookPen className="size-4" />
                </div>
                <div className="grid flex-1 text-start leading-tight">
                  <span className="truncate font-semibold">{siteConfig.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    审核工作台
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="审核导航">
          <NavGroup {...navigation} />
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <NavUser onLogout={onLogout} pending={pending} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
