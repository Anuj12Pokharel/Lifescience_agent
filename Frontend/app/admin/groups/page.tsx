'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, Plus, Trash2, Eye, ToggleLeft, UsersRound, Power, PowerOff, ShieldAlert, Bot } from 'lucide-react';
import {
  useGroups, useCreateGroup, useToggleGroup, useDeleteGroup,
} from '@/lib/hooks/use-groups';
import { type Group, type ListGroupsParams, type CreateGroupPayload } from '@/lib/api-client';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function AdminGroupsPage() {
  const router = useRouter();
  const [params, setParams] = useState<ListGroupsParams>({ page: 1, page_size: 20 });
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null);

  const { data, isLoading } = useGroups(params);
  const groups = data?.results ?? [];
  const pagination = data ? { count: data.count, next: data.next, previous: data.previous } : null;

  const toggleGroup = useToggleGroup();
  const deleteGroup = useDeleteGroup();

  const setParam = (key: keyof ListGroupsParams, value: string | number) =>
    setParams((p) => ({ ...p, [key]: value, page: 1 }));

  return (
    <DashboardLayout requireAdmin>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Work Groups</h1>
            <p className="text-sm text-muted-foreground mt-1">Organize users and manage collective agent access.</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-primary text-black font-bold shadow-[0_0_20px_-5px_rgba(var(--primary),0.4)]">
            <Plus className="mr-2 h-4 w-4" /> Create Group
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-card/40 border border-border/40 backdrop-blur-sm">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search groups..." 
              value={params.search ?? ''}
              onChange={(e) => setParam('search', e.target.value)}
              className="pl-9 bg-muted/40 border-border/40"
            />
          </div>
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
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/40 bg-card/20 overflow-hidden backdrop-blur-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Group Details</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Members</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Agents</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Status</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-border/20 hover:bg-white/5">
                    <TableCell><div className="h-4 w-48 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-5 w-20 bg-muted animate-pulse rounded-full" /></TableCell>
                    <TableCell><div className="h-8 w-16 bg-muted animate-pulse rounded-md ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <UsersRound className="h-8 w-8 opacity-20 text-primary" />
                      <p>No groups found matching your criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.id} className="border-border/20 hover:bg-white/5 group transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary ring-1 ring-primary/20">
                          <UsersRound className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground flex items-center gap-2">
                            {group.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 max-w-[250px] truncate">
                            {group.description || 'No description provided'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                         <div className="font-medium text-sm">{group.member_count}</div>
                         <div className="text-[10px] text-muted-foreground">Users</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                         <div className="font-medium text-sm flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-primary opacity-70"/> {group.agent_count}</div>
                         <div className="text-[10px] text-muted-foreground">Agents Available</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`w-fit self-start ${group.is_active ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" : "border-rose-500/30 text-rose-400 bg-rose-500/10"}`}>
                        {group.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end items-center gap-2">
                         <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/groups/${group.id}`)} className="h-8 text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary hover:bg-primary/10">
                           Manage
                         </Button>
                         <Button 
                           variant="ghost" size="icon" 
                           onClick={() => toggleGroup.mutate(group.id)}
                           disabled={toggleGroup.isPending && toggleGroup.variables === group.id}
                           className={`h-8 w-8 rounded-full hover:bg-white/5 ${group.is_active ? 'text-amber-400' : 'text-emerald-400'}`}
                         >
                           {group.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                         </Button>
                         <Button 
                           variant="ghost" size="icon" 
                           onClick={() => setConfirmDelete(group)}
                           className="h-8 w-8 rounded-full text-rose-400 hover:text-rose-400 hover:bg-rose-500/10"
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
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
                variant="outline" size="sm" 
                disabled={!pagination.previous}
                onClick={() => setParam('page', (params.page ?? 1) - 1)}
                className="bg-transparent border-border/40"
               >
                 Previous
               </Button>
               <span className="text-xs text-muted-foreground">Page {params.page || 1}</span>
               <Button 
                variant="outline" size="sm" 
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

      <CreateGroupModal open={showCreate} onOpenChange={setShowCreate} />

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-[400px] bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="bg-rose-500/10 p-2 rounded-full text-rose-500">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl">Delete Group?</DialogTitle>
            </div>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground/90">
              You are about to delete <span className="text-rose-400 font-bold">{confirmDelete?.name}</span>.
            </p>
            <p className="text-xs text-muted-foreground mt-3 p-3 bg-rose-500/5 border border-rose-500/20 rounded-md">
              This will instantly remove all member subscriptions and revoke their shared agent access.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteGroup.isPending} onClick={() => {
              if (confirmDelete) deleteGroup.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) });
            }}>
              {deleteGroup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {deleteGroup.isPending ? 'Deleting...' : 'Proceed with Deletion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function CreateGroupModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const createGroup = useCreateGroup();
  const [form, setForm] = useState<CreateGroupPayload>({ name: '', description: '', is_active: true });

  const error = (createGroup.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? '';

  const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     createGroup.mutate(form, { onSuccess: () => {
       onOpenChange(false);
       setForm({ name: '', description: '', is_active: true });
     }});
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#0A1428] border-border/40 text-foreground shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-2 rounded-lg ring-1 ring-primary/20">
              <UsersRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Create Group</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mr-8">
                Establish a new logical grouping for users and common agent access policies.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md p-3 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
           <div className="space-y-2">
             <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Group Name</label>
             <Input 
               value={form.name} 
               onChange={(e) => setForm({ ...form, name: e.target.value })} 
               placeholder="e.g. Content Creators" 
               className="bg-muted/40 border-border/40" 
               required 
             />
           </div>

           <div className="space-y-2">
             <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center justify-between">
               <span>Description</span>
               <span className="text-[9px] lowercase text-muted-foreground/50 tracking-normal">(Optional)</span>
             </label>
             <Textarea 
               value={form.description} 
               onChange={(e) => setForm({ ...form, description: e.target.value })} 
               placeholder="What is the purpose of this group?..." 
               className="bg-muted/40 border-border/40 min-h-[80px]" 
             />
           </div>

          <DialogFooter className="pt-6">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createGroup.isPending} className="bg-primary text-black font-bold shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)]">
              {createGroup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {createGroup.isPending ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
