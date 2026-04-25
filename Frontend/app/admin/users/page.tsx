'use client';

import { useState } from 'react';
import {
  Search, ShieldCheck, Lock, Unlock, UserCheck, UserX, Bot, ShieldAlert, BadgeCheck, XCircle, MoreHorizontal, Fingerprint, Building2
} from 'lucide-react';
import {
  useUsers, useUpdateUserRole, useActivateUser, useDeactivateUser,
  useLockUser, useUnlockUser, useUserAgents, useToggleUserAgentAccess, useGrantUserAgentAccess,
  useUserGroups, useAssignManager, useAccessDiagnostic, useAssignCompany
} from '@/lib/hooks/use-users';
import { type ApiUser, type ListUsersParams, type UserAgentAccess } from '@/lib/api-client';
import { useCompanies } from '@/lib/hooks/use-company';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import DashboardLayout from '@/components/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/lib/auth-context';
import { InviteUserDialog } from '@/components/admin/users/invite-user-dialog';
import { AccessDiagnosticDialog } from '@/components/admin/users/access-diagnostic-dialog';
import { AgentAccessDialog } from '@/components/admin/users/agent-access-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'superadmin';
  const [params, setParams] = useState<ListUsersParams>({ page: 1, page_size: 20 });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [diagnosticUserId, setDiagnosticUserId] = useState<string | null>(null);
  
  const [lockingUser, setLockingUser] = useState<ApiUser | null>(null);
  const [lockMinutes, setLockMinutes] = useState(30);

  const [agentAccessUser, setAgentAccessUser] = useState<ApiUser | null>(null);
  const [companyTarget, setCompanyTarget] = useState<ApiUser | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('none');

  const { data, isLoading } = useUsers(params);
  const users = data?.results ?? [];
  const pagination = data ? { count: data.count, next: data.next, previous: data.previous } : null;

  const { data: companiesData = [] } = useCompanies();
  // Admin can only assign the company they manage; superadmin can assign any
  const availableCompanies = isAdmin
    ? companiesData
    : companiesData.filter((c) => c.managed_by === currentUser?.id);

  const updateRole     = useUpdateUserRole();
  const activate       = useActivateUser();
  const deactivate     = useDeactivateUser();
  const lockUser       = useLockUser();
  const unlockUser     = useUnlockUser();
  const assignCompany  = useAssignCompany();

  const setParam = (key: keyof ListUsersParams, value: string | number) =>
    setParams((p) => ({ ...p, [key]: value, page: 1 }));

  return (
    <DashboardLayout requireAdmin>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">User Directory</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage platform users, roles, and agent access permissions.</p>
          </div>
          <Button onClick={() => setInviteOpen(true)} className="bg-primary text-black font-bold shadow-[0_0_20px_-5px_rgba(var(--primary),0.4)]">
            <UserCheck className="mr-2 h-4 w-4" /> Invite User
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-card/40 border border-border/40 backdrop-blur-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search users..." 
              value={params.search ?? ''}
              onChange={(e) => setParam('search', e.target.value)}
              className="pl-9 bg-muted/40 border-border/40"
            />
          </div>
          <Select value={String(params.role ?? '')} onValueChange={(val) => setParam('role', val)}>
            <SelectTrigger className="bg-muted/40 border-border/40">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="superadmin">Superadmin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(params.is_active ?? '')} onValueChange={(val) => setParam('is_active', val)}>
            <SelectTrigger className="bg-muted/40 border-border/40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(params.is_verified ?? '')} onValueChange={(val) => setParam('is_verified', val)}>
            <SelectTrigger className="bg-muted/40 border-border/40">
              <SelectValue placeholder="Verification" />
            </SelectTrigger>
            <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Verified</SelectItem>
              <SelectItem value="false">Unverified</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User Table */}
        <div className="rounded-xl border border-border/40 bg-card/20 overflow-hidden backdrop-blur-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">User</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Role</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Status</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Manager</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Company</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-border/20 hover:bg-white/5">
                    <TableCell><div className="h-4 w-48 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-5 w-20 bg-muted animate-pulse rounded-full" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-28 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-8 w-8 bg-muted animate-pulse rounded-md ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 opacity-20" />
                      <p>No users found matching your criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                 users.map((user) => (
                  <TableRow key={user.id} className="border-border/20 hover:bg-white/5 group transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs ring-1 ring-primary/20">
                          {user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{user.email}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            {user.is_verified ? <BadgeCheck className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-rose-500" />}
                            {user.is_verified ? 'Verified' : 'Unverified'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        user.role === 'superadmin' ? "border-amber-500/30 text-amber-500 bg-amber-500/10" : 
                        user.role === 'admin' ? "border-blue-500/30 text-blue-500 bg-blue-500/10" :
                        "border-muted-foreground/30 text-muted-foreground"
                      }>
                        {user.role === 'superadmin' && <ShieldAlert className="w-3 h-3 mr-1" />}
                        {user.role === 'admin' && <ShieldCheck className="w-3 h-3 mr-1" />}
                        {user.role.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Badge variant="outline" className={user.is_active ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" : "border-rose-500/30 text-rose-500 bg-rose-500/10"}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {user.is_locked && (
                          <Badge variant="destructive" className="bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border-none">Locked</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-medium">
                        {user.managed_by?.email || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.company_name ? (
                        <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10 text-xs">
                          <Building2 className="h-3 w-3 mr-1" />{user.company_name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-100 transition-opacity hover:bg-slate-800/50 hover:text-white">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-[#0A1428] border-border/40 text-foreground">
                          <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Management</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-border/40" />
                          
                          <DropdownMenuItem onClick={() => setAgentAccessUser(user)} className="cursor-pointer hover:bg-white/5 py-2">
                            <Bot className="mr-2 h-4 w-4 text-primary" />
                            <span>Manage Agents</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => {
                              setCompanyTarget(user);
                              setSelectedCompanyId(
                                companiesData.find((c) => c.name === user.company_name)?.id ?? 'none'
                              );
                            }}
                            className="cursor-pointer hover:bg-white/5 py-2"
                          >
                            <Building2 className="mr-2 h-4 w-4 text-green-400" />
                            <span>Assign Company</span>
                          </DropdownMenuItem>
                          
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => setDiagnosticUserId(user.id)} className="cursor-pointer hover:bg-white/5 py-2">
                              <Fingerprint className="mr-2 h-4 w-4 text-emerald-400" />
                              <span>Access Diagnostic</span>
                            </DropdownMenuItem>
                          )}

                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator className="bg-border/40" />
                              <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Admin Actions</DropdownMenuLabel>
                              <DropdownMenuItem 
                                onClick={() => updateRole.mutate({ id: user.id, role: user.role === 'user' ? 'admin' : 'user' })}
                                className="cursor-pointer hover:bg-white/5 py-2"
                              >
                                <ShieldCheck className="mr-2 h-4 w-4 text-amber-500" />
                                <span>{user.role === 'user' ? 'Promote to Admin' : 'Demote to User'}</span>
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuSeparator className="bg-border/40" />
                          
                          {user.is_active ? (
                            <DropdownMenuItem onClick={() => deactivate.mutate(user.id)} className="cursor-pointer hover:bg-white/5 py-2 text-rose-400 focus:text-rose-400">
                              <UserX className="mr-2 h-4 w-4" />
                              <span>Deactivate User</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => activate.mutate(user.id)} className="cursor-pointer hover:bg-white/5 py-2 text-emerald-400 focus:text-emerald-400">
                              <UserCheck className="mr-2 h-4 w-4" />
                              <span>Activate User</span>
                            </DropdownMenuItem>
                          )}
                          
                          {user.is_locked ? (
                            <DropdownMenuItem onClick={() => unlockUser.mutate(user.id)} className="cursor-pointer hover:bg-white/5 py-2">
                              <Unlock className="mr-2 h-4 w-4" />
                              <span>Unlock Account</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setLockingUser(user)} className="cursor-pointer hover:bg-white/5 py-2">
                              <Lock className="mr-2 h-4 w-4" />
                              <span>Lock Account</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination Controls */}
          {pagination && (pagination.next || pagination.previous) && (
             <div className="p-4 border-t border-border/20 flex justify-between items-center bg-muted/10">
               <Button 
                variant="outline" 
                size="sm" 
                disabled={!pagination.previous}
                onClick={() => setParam('page', (params.page ?? 1) - 1)}
                className="bg-transparent border-border/40"
               >
                 Previous
               </Button>
               <span className="text-xs text-muted-foreground">Page {params.page || 1}</span>
               <Button 
                variant="outline" 
                size="sm" 
                disabled={!pagination.next}
                onClick={() => setParam('page', (params.page ?? 1) + 1)}
                className="bg-transparent border-border/40"
               >
                 Next
               </Button>
             </div>
          )}
        </div>
      </div>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} isAdmin={isAdmin} />
      
      <AccessDiagnosticDialog 
        userId={diagnosticUserId} 
        open={!!diagnosticUserId} 
        onOpenChange={(open) => !open && setDiagnosticUserId(null)} 
      />

      <AgentAccessDialog
        user={agentAccessUser}
        open={!!agentAccessUser}
        onOpenChange={(open) => !open && setAgentAccessUser(null)}
      />

      {/* Assign Company Dialog */}
      <Dialog open={!!companyTarget} onOpenChange={(o) => !assignCompany.isPending && !o && setCompanyTarget(null)}>
        <DialogContent className="sm:max-w-105 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>Assign Company</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Assign a company to{' '}
              <span className="text-foreground font-medium">{companyTarget?.email}</span>.
              Set to None to remove the current assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 block">Company</label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="bg-muted/40 border-border/40">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                <SelectItem value="none">None</SelectItem>
                {availableCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompanyTarget(null)} disabled={assignCompany.isPending}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-black font-bold"
              disabled={assignCompany.isPending}
              onClick={() => {
                if (!companyTarget) return;
                assignCompany.mutate(
                  { id: companyTarget.id, company_id: selectedCompanyId === 'none' ? null : selectedCompanyId },
                  { onSuccess: () => setCompanyTarget(null) },
                );
              }}
            >
              {assignCompany.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Lock Modal (Should extract to component eventually) */}
      <Dialog open={!!lockingUser} onOpenChange={(open) => !open && setLockingUser(null)}>
        <DialogContent className="sm:max-w-[400px] bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>Lock User Account</DialogTitle>
            <DialogDescription>
              Temporarily prevent <span className="text-primary font-medium">{lockingUser?.email}</span> from logging in.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 block">Lockout Duration (Minutes)</label>
            <Input 
              type="number" 
              min={1} 
              value={lockMinutes} 
              onChange={(e) => setLockMinutes(Number(e.target.value))}
              className="bg-muted/40 border-border/40"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLockingUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (lockingUser) lockUser.mutate({ id: lockingUser.id, lockout_minutes: lockMinutes });
              setLockingUser(null);
            }}>Confirm Lock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
