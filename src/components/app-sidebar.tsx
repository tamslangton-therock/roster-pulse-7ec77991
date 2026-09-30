import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Users, Activity, LayoutGrid, Sparkles, Printer, Home, FileText, LayoutDashboard, Shield } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import {
  canEditTeamsArea,
  canViewHealth,
  canViewIndividuals,
} from "@/lib/user-access";

interface NavItem {
  title: string;
  url: string;
  icon: typeof CalendarDays;
  /** Return true when the signed-in session may open this page. */
  allowed: (isMaster: boolean) => boolean;
}

const items: NavItem[] = [
  { title: "Home", url: "/", icon: LayoutDashboard, allowed: () => true },
  // Everyone signed in can view the full live roster; per-area edit limits are
  // enforced inside the roster page itself.
  { title: "Live Roster", url: "/roster", icon: CalendarDays, allowed: () => true },
  {
    title: "Individuals",
    url: "/volunteers",
    icon: Users,
    allowed: (m) => canViewIndividuals(m, useAuth.getState().user),
  },
  {
    title: "Team Health",
    url: "/health",
    icon: Activity,
    allowed: (m) => canViewHealth(m, useAuth.getState().user),
  },
  {
    title: "Team Builder",
    url: "/teams",
    icon: LayoutGrid,
    allowed: (m) => canEditTeamsArea(m, useAuth.getState().user, ""),
  },
  { title: "Team Print", url: "/print", icon: Printer, allowed: (m) => m },
  { title: "Doc Templates", url: "/docs", icon: FileText, allowed: (m) => m },
  { title: "Life Groups", url: "/life-groups", icon: Home, allowed: (m) => m },
  { title: "User Access", url: "/users", icon: Shield, allowed: (m) => m },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMaster = useAuth((s) => s.master);
  const user = useAuth((s) => s.user);
  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));

  const visible = items.filter((item) => {
    if (isMaster) return true;
    if (item.url === "/teams") {
      // Team Builder is visible only when the user may edit at least one area.
      return (user?.teamEditAreas ?? []).length > 0;
    }
    return item.allowed(isMaster);
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">Roster Pulse</span>
            <span className="text-[11px] text-muted-foreground">Church roster ops</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
