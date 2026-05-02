'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLogout } from '@/lib/hooks/use-auth';
import {
  LayoutDashboard, Users, Bot, LogOut,
  Settings, Shield, UsersRound, Menu, ChevronRight, Bell, Search,
  Fingerprint, Sparkles, Plus, Building2, CalendarDays, Plug, Building
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const adminNav: NavItem[] = [
  { label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Organization', href: '/admin/organization', icon: Building },
  { label: 'User Directory', href: '/admin/users', icon: Users },
  { label: 'Work Groups', href: '/admin/groups', icon: UsersRound },
  { label: 'AI Agents', href: '/admin/agents', icon: Bot },
  { label: 'Integrations', href: '/admin/integrations', icon: Plug },
  { label: 'Company', href: '/admin/company', icon: Building2 },
  { label: 'Events', href: '/admin/events', icon: CalendarDays },
];

const settingsNav: NavItem[] = [
  { label: 'Change Password', href: '/admin/change-password', icon: Settings },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function DashboardLayout({ children, requireAdmin = false }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const logout = useLogout();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    
    const isAtLeastAdmin = user.role === 'superadmin' || user.role === 'admin';
    if (requireAdmin && !isAtLeastAdmin) {
      router.push('/');
      return;
    }
    
    if (!requireAdmin && pathname === '/' && isAtLeastAdmin) {
      router.push('/admin/dashboard');
    }
  }, [user, loading, requireAdmin, router, pathname]);

  if (loading || !user) return <div className="min-h-screen bg-[#020B18] flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const isAdmin = user.role === 'superadmin';
  const isAtLeastAdmin = user.role === 'superadmin' || user.role === 'admin';

  // Generate breadcrumbs from pathname
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = `/${pathSegments.slice(0, index + 1).join('/')}`;
    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    const isLast = index === pathSegments.length - 1;
    return { label, href, isLast };
  });

  return (
    <SidebarProvider transition-duration={"200ms"}>
      <div className="flex min-h-svh w-full bg-[#020B18] selection:bg-cyan-500/30">
        <AppSidebar user={user} isAdmin={isAdmin} isAtLeastAdmin={isAtLeastAdmin} pathname={pathname} logout={logout} />
        
        <SidebarInset className="flex flex-col bg-transparent overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/5 px-4 md:px-6 backdrop-blur-xl sticky top-0 z-40 bg-[#020B18]/80">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 rounded-lg p-2 cursor-pointer" />
              <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
              
              <Breadcrumb className="hidden md:block">
                <BreadcrumbList>
                  {breadcrumbs.map((bc, i) => (
                    <React.Fragment key={bc.href}>
                      <BreadcrumbItem>
                        {bc.isLast ? (
                          <BreadcrumbPage className="text-cyan-400 font-bold tracking-tight">{bc.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link href={bc.href} className="text-slate-400 hover:text-white transition-colors">{bc.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!bc.isLast && <BreadcrumbSeparator className="text-slate-600" />}
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex-1 px-4 hidden lg:block max-w-md mx-auto">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors pointer-events-none" />
                <Input 
                  placeholder="Search everything..." 
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-10 rounded-xl focus-visible:ring-cyan-500/20 focus:border-cyan-500/30 transition-all duration-300 w-full"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4 ml-auto">
              <div className="hidden sm:flex items-center gap-2 mr-2">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 relative cursor-pointer rounded-xl">
                  <Bell className="h-5 w-5 transition-transform duration-200 hover:scale-110" />
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-cyan-500 rounded-full border-2 border-[#020B18] animate-pulse" />
                </Button>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative flex items-center gap-3 pl-1 pr-3 py-1 h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer">
                    <Avatar className="h-8 w-8 rounded-lg border border-white/10">
                      <AvatarImage src={user.profile?.avatar as string} alt={user.email} />
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold text-xs uppercase shadow-lg shadow-cyan-500/20">
                        {user.email[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start text-left hidden sm:flex">
                      <span className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">{user.email.split('@')[0]}</span>
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{user.role}</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 mt-2 bg-slate-900/95 border-white/10 text-white shadow-2xl animate-in fade-in slide-in-from-top-2 backdrop-blur-xl rounded-xl p-2" align="end">
                  <DropdownMenuLabel className="font-normal px-2 py-3">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-bold leading-none text-white">{user.email}</p>
                      <p className="text-xs leading-none text-slate-500 mt-1 capitalize">Role: {user.role}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuItem className="cursor-pointer hover:bg-white/5 py-2.5 rounded-lg text-slate-300 hover:text-white transition-all flex items-center gap-3">
                    <div className="bg-white/5 p-1.5 rounded-md">
                      <Settings className="h-4 w-4 text-slate-400" />
                    </div>
                    <span className="font-medium">Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => logout.mutate()} className="cursor-pointer text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 py-2.5 rounded-lg transition-all flex items-center gap-3">
                    <div className="bg-rose-500/10 p-1.5 rounded-md">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <span className="font-medium">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-700 overflow-y-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}


function AppSidebar({ user, isAdmin, isAtLeastAdmin, pathname, logout }: any) {
  return (
    <Sidebar className="border-r border-slate-700/50 bg-slate-900/95 backdrop-blur-md" collapsible="icon">
      <SidebarHeader className="p-4 border-b border-slate-700/30">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30">
            <Fingerprint className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none transition-opacity group-data-[collapsible=icon]:opacity-0">
            <span className="text-sm font-extrabold tracking-tight bg-gradient-to-br from-white to-cyan-400 bg-clip-text text-transparent">
 LIFE SCIENCE AI            </span>
            <span className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase opacity-90">
FUTURE INTELLIGENCE           </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 mb-2 text-[11px] font-bold tracking-widest text-slate-500 uppercase">
            Administration
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.label} className="mb-1">
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className={cn(
                        "h-10 px-3 tracking-wide transition-all group-data-[collapsible=icon]:justify-center rounded-lg",
                        isActive 
                          ? "bg-cyan-500/20 text-cyan-300 font-semibold ring-1 ring-cyan-500/30 shadow-[0_0_20px_-5px_rgba(34,211,238,0.3)]" 
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                      )}
                    >
                      <Link href={item.href} className="cursor-pointer">
                        <item.icon className={cn("size-4.5 shrink-0 transition-transform duration-200 hover:scale-110", isActive ? "text-cyan-300" : "text-slate-500")} />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] group-data-[collapsible=icon]:hidden" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-3 mb-2 text-[11px] font-bold tracking-widest text-slate-500 uppercase">
            Preferences
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNav.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton 
                    asChild 
                    className="h-10 px-3 text-slate-400 hover:bg-slate-800/50 hover:text-white transition-all group-data-[collapsible=icon]:justify-center rounded-lg"
                  >
                    <Link href={item.href} className="cursor-pointer">
                      <item.icon className="size-4.5 shrink-0 text-slate-500 transition-transform duration-200 hover:scale-110" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-slate-700/30">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => logout.mutate()}
              className="h-11 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all font-medium group-data-[collapsible=icon]:justify-center rounded-lg cursor-pointer"
            >
              <LogOut className="size-4.5 shrink-0 transition-transform duration-200 hover:scale-110" />
              <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        <div className="mt-4 p-3 rounded-lg bg-gradient-to-br from-cyan-500/20 to-transparent border border-cyan-500/30 group-data-[collapsible=icon]:hidden transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-cyan-500 p-1 rounded-md">
              <Sparkles className="size-3 text-black" />
            </div>
            <span className="text-[11px] font-bold text-cyan-300 tracking-wide">PREMIUM ACCESS</span>
          </div>
          <div className="text-[10px] text-slate-400 leading-relaxed">
            Manage agents and users with full administrative privileges.
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
