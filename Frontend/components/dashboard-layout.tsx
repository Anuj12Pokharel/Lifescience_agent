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
    console.log('[DashboardLayout] User state:', user);
    console.log('[DashboardLayout] Loading state:', loading);
    console.log('[DashboardLayout] RequireAdmin:', requireAdmin);
    console.log('[DashboardLayout] Pathname:', pathname);
    
    if (loading) {
      console.log('[DashboardLayout] Still loading, waiting...');
      return;
    }
    
    if (!user) {
      console.log('[DashboardLayout] No user found, redirecting to login');
      router.push('/login');
      return;
    }
    
    const isAtLeastAdmin = user.role === 'superadmin' || user.role === 'admin';
    if (requireAdmin && !isAtLeastAdmin) {
      console.log('[DashboardLayout] User lacks admin privileges, redirecting to home');
      router.push('/');
      return;
    }
    
    // Auto-redirect superadmins to dashboard if they land on root or non-admin pages
    if (!requireAdmin && pathname === '/' && isAtLeastAdmin) {
      console.log('[DashboardLayout] Admin user on root, redirecting to dashboard');
      router.push('/admin/dashboard');
    }
  }, [user, loading, requireAdmin, router, pathname]);

  if (loading || !user) return <div className="min-h-screen bg-[#020B18] flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const isAdmin = user.role === 'superadmin';
  const isAtLeastAdmin = user.role === 'superadmin' || user.role === 'admin';

  return (
    <SidebarProvider transition-duration={"200ms"}>
      <div className="flex min-h-svh w-full bg-[#020B18]">
        <AppSidebar user={user} isAdmin={isAdmin} isAtLeastAdmin={isAtLeastAdmin} pathname={pathname} logout={logout} />
        
        <SidebarInset className="flex flex-col bg-transparent">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-700/50 px-6 backdrop-blur-md sticky top-0 z-40 bg-slate-900/90">
            <SidebarTrigger className="-ml-1 text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200 rounded-md p-2 cursor-pointer" />
            <div className="flex-1 px-4 hidden md:block">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input 
                  placeholder="Global search..." 
                  className="pl-9 bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500 h-9 focus-visible:ring-cyan-500/30 focus:border-cyan-500/50 transition-all duration-200"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-4 ml-auto">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200 relative cursor-pointer">
                <Bell className="h-5 w-5 transition-transform duration-200 hover:scale-110" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-cyan-500 rounded-full border-2 border-slate-900 animate-pulse" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-1 ring-slate-700/50 p-0 overflow-hidden hover:ring-cyan-500/50 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.profile?.avatar as string} alt={user.email} />
                      <AvatarFallback className="bg-cyan-500/20 text-cyan-400 font-bold text-sm">{user.email[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 mt-2 bg-slate-900/95 border-slate-700/50 text-white shadow-2xl animate-in fade-in slide-in-from-top-2 backdrop-blur-md" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-white">{user.email}</p>
                      <p className="text-xs leading-none text-slate-400 capitalize">{user.role}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-700/50" />
                  <DropdownMenuItem className="cursor-pointer hover:bg-slate-800/50 py-2 text-slate-300 hover:text-white transition-colors">
                    <Settings className="mr-2 h-4 w-4 text-slate-400 transition-transform duration-200 hover:scale-110" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => logout.mutate()} className="cursor-pointer text-red-400 hover:bg-red-500/10 hover:text-red-300 py-2 transition-colors">
                    <LogOut className="mr-2 h-4 w-4 transition-transform duration-200 hover:scale-110" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 p-6 md:p-8 animate-in fade-in duration-500">
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
