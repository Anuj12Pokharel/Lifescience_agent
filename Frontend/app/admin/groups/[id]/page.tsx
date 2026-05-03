'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Trash2, X, Plus, Search, Eye, UsersRound, Bot, Edit2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import {
  useGroup, useUpdateGroup, useToggleGroup, useDeleteGroup,
  useAddGroupMembers,
  useAssignGroupAgents, useRemoveGroupAgent,
} from '@/lib/hooks/use-groups';
import { useUsers } from '@/lib/hooks/use-users';
import { useOrgAgents } from '@/lib/hooks/use-organizations';
import { type OrgAgent } from '@/lib/api-client';
import { type CreateGroupPayload, type GroupMember, type GroupAgent } from '@/lib/api-client';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from 'lucide-react';

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('members');
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showAssignAgents, setShowAssignAgents] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveAgent, setConfirmRemoveAgent] = useState<GroupAgent | null>(null);

  const { data: group, isLoading } = useGroup(id as string);
  const toggleGroup = useToggleGroup();
  const deleteGroup = useDeleteGroup();
  const removeAgent = useRemoveGroupAgent(id as string);

  if (isLoading) {
    return (
      <DashboardLayout requireAdmin>
        <div className="flex justify-center items-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!group) {
    return (
      <DashboardLayout requireAdmin>
        <div className="flex flex-col justify-center items-center min-h-[50vh] text-destructive">
          <ShieldAlert className="h-12 w-12 mb-4 opacity-50" />
          <h2 className="text-xl font-bold">Group Not Found</h2>
          <Button variant="link" onClick={() => router.push('/admin/groups')} className="mt-4">Return to Groups</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requireAdmin>
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Back Link */}
        <Button variant="link" onClick={() => router.push('/admin/groups')} className="self-start text-muted-foreground hover:text-foreground pl-0">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Work Groups
        </Button>

        {/* Header Card */}
        <div className="bg-card/40 border border-border/40 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary/20 p-2 rounded-lg text-primary ring-1 ring-primary/30">
                  <UsersRound className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-foreground">{group.name}</h1>
                  <Badge variant="outline" className={`mt-1 ${group.is_active ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-rose-500/30 text-rose-400 bg-rose-500/10'}`}>
                    {group.is_active ? 'Active Group' : 'Inactive Group'}
                  </Badge>
                </div>
              </div>
              
              {group.description && (
                <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">{group.description}</p>
              )}
              
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mt-4">
                Created by {group.created_by}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} className="bg-transparent border-primary/30 text-primary hover:bg-primary/10">
                <Edit2 className="h-4 w-4 mr-2" /> Edit
              </Button>
              <Button 
                variant="outline" size="sm" 
                onClick={() => toggleGroup.mutate(id as string)}
                disabled={toggleGroup.isPending}
                className={`bg-transparent ${group.is_active ? 'border-amber-500/30 text-amber-500 hover:bg-amber-500/10' : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'}`}
              >
                {group.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} className="shadow-[0_0_15px_-5px_rgba(var(--destructive),0.5)]">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs & Content */}
        <div className="bg-card/20 border border-border/30 rounded-xl overflow-hidden backdrop-blur-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="p-4 border-b border-border/20 bg-muted/10 flex justify-between items-center">
              <TabsList className="bg-transparent border-b-0 space-x-2">
                <TabsTrigger value="members" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none px-6">
                  Members <Badge variant="secondary" className="ml-2 bg-background/50">{group.members.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="agents" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none px-6">
                  Agent Access <Badge variant="secondary" className="ml-2 bg-background/50">{group.agents.length}</Badge>
                </TabsTrigger>
              </TabsList>
              
              {activeTab === 'members' ? (
                <Button size="sm" onClick={() => setShowAddMembers(true)} className="h-8 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Members
                </Button>
              ) : (
                <Button size="sm" onClick={() => setShowAssignAgents(true)} className="h-8 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Assign Agent
                </Button>
              )}
            </div>
            
            <div className="p-0">
              {/* MEMBERS TAB */}
              <TabsContent value="members" className="m-0 border-none">
                <Table>
                  <TableHeader className="bg-muted/5">
                    <TableRow className="hover:bg-transparent border-border/20">
                      <TableHead className="font-bold tracking-wider text-[10px] uppercase text-muted-foreground w-1/3">User Email</TableHead>
                      <TableHead className="font-bold tracking-wider text-[10px] uppercase text-muted-foreground">System Role</TableHead>
                      <TableHead className="font-bold tracking-wider text-[10px] uppercase text-muted-foreground">Added By</TableHead>
                      <TableHead className="font-bold tracking-wider text-[10px] uppercase text-muted-foreground">Joined Group</TableHead>
                      <TableHead className="text-right font-bold tracking-wider text-[10px] uppercase text-muted-foreground">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                          No members assigned to this group.
                        </TableCell>
                      </TableRow>
                    ) : (
                      group.members.map((m) => (
                        <TableRow key={m.membership_id} className="border-border/10">
                          <TableCell className="font-medium">{m.email}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px] uppercase">{m.role}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{m.added_by}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(m.joined_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            {/* Remove member button removed */}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* AGENTS TAB */}
              <TabsContent value="agents" className="m-0 border-none">
                <Table>
                  <TableHeader className="bg-muted/5">
                    <TableRow className="hover:bg-transparent border-border/20">
                      <TableHead className="font-bold tracking-wider text-[10px] uppercase text-muted-foreground w-1/4">Agent</TableHead>
                      <TableHead className="font-bold tracking-wider text-[10px] uppercase text-muted-foreground">Type</TableHead>
                      <TableHead className="font-bold tracking-wider text-[10px] uppercase text-muted-foreground">Health</TableHead>
                      <TableHead className="font-bold tracking-wider text-[10px] uppercase text-muted-foreground">Status</TableHead>
                      <TableHead className="font-bold tracking-wider text-[10px] uppercase text-muted-foreground">Granted By</TableHead>
                      <TableHead className="text-right font-bold tracking-wider text-[10px] uppercase text-muted-foreground">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.agents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          No AI agents assigned to this group.
                        </TableCell>
                      </TableRow>
                    ) : (
                      group.agents.map((a) => (
                        <TableRow key={a.access_id} className="border-border/10">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-foreground flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-primary opacity-70"/>{a.name}</span>
                              <span className="text-[10px] text-muted-foreground mt-0.5">{a.subtitle || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] capitalize border-primary/20 text-primary/80 bg-primary/5">{a.agent_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] uppercase ${a.status === 'live' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-amber-500/30 text-amber-500 bg-amber-500/5'}`}>
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs">
                              {a.agent_is_active ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <X className="h-3.5 w-3.5 text-rose-500" />}
                              <span className={a.agent_is_active ? 'text-emerald-500 font-medium' : 'text-rose-500 font-medium'}>
                                {a.agent_is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{a.granted_by}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveAgent(a)} className="h-8 text-rose-400 hover:text-rose-400 hover:bg-rose-500/10">
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Unlink
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* MODALS */}
      {showEdit && (
        <EditGroupModal 
          id={id as string} 
          name={group.name} 
          description={group.description} 
          isActive={group.is_active} 
          open={showEdit} 
          onOpenChange={setShowEdit} 
        />
      )}

      {showAddMembers && (
        <AddMembersModal 
          groupId={id as string} 
          existingUserIds={group.members.map(m => m.user_id)} 
          open={showAddMembers} 
          onOpenChange={setShowAddMembers} 
        />
      )}

      {showAssignAgents && (
        <AssignAgentsModal 
          groupId={id as string} 
          existingAgentIds={group.agents.map(a => a.agent_id)} 
          open={showAssignAgents} 
          onOpenChange={setShowAssignAgents} 
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
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
              You are about to delete <span className="text-rose-400 font-bold">{group.name}</span>.
            </p>
            <p className="text-xs text-muted-foreground mt-3 p-3 bg-rose-500/5 border border-rose-500/20 rounded-md">
              This will instantly remove all member subscriptions and revoke shared agent permissions.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteGroup.isPending} onClick={() => {
              deleteGroup.mutate(id as string, { onSuccess: () => router.push('/admin/groups') });
            }}>
              {deleteGroup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {deleteGroup.isPending ? 'Deleting...' : 'Proceed with Deletion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmRemoveAgent} onOpenChange={(val) => !val && setConfirmRemoveAgent(null)}>
        <DialogContent className="sm:max-w-[400px] bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-rose-400">Unlink Agent</DialogTitle>
            <DialogDescription>
              Unlink <span className="text-foreground font-medium">{confirmRemoveAgent?.name}</span> from this group? Members will lose delegated access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRemoveAgent(null)}>Cancel</Button>
            <Button variant="destructive" disabled={removeAgent.isPending} onClick={() => {
              if (confirmRemoveAgent) removeAgent.mutate(confirmRemoveAgent.agent_id, { onSuccess: () => setConfirmRemoveAgent(null) });
            }}>
              {removeAgent.isPending ? 'Removing...' : 'Unlink Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ─── Edit Group Modal ──────────────────────────────────────────────────────────

function EditGroupModal({ id, name, description, isActive, open, onOpenChange }: {
  id: string; name: string; description?: string; isActive: boolean; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const updateGroup = useUpdateGroup();
  const [form, setForm] = useState<CreateGroupPayload>({ name, description: description ?? '', is_active: isActive });

  const error = (updateGroup.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#0A1428] border-border/40 text-foreground">
        <DialogHeader>
          <DialogTitle>Edit Group Details</DialogTitle>
        </DialogHeader>
        {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md p-3 mb-4">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); updateGroup.mutate({ id, payload: form }, { onSuccess: () => onOpenChange(false) }); }} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Group Name</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-muted/40 border-border/40" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-muted/40 border-border/40 min-h-[80px]" />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateGroup.isPending} className="bg-primary text-black font-bold">
              {updateGroup.isPending ? 'Saving...' : 'Update Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Members Modal ─────────────────────────────────────────────────────────

function AddMembersModal({ groupId, existingUserIds, open, onOpenChange }: {
  groupId: string; existingUserIds: string[]; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const addMembers = useAddGroupMembers(groupId);

  // Load all active accepted users upfront — no search required to trigger
  const { data, isLoading } = useUsers({ page_size: 200, is_active: 'true' });
  const users = (data?.results ?? []).filter(u => !existingUserIds.includes(u.id));
  const filtered = search
    ? users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()))
    : users;

  const toggleUser = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleClose = (o: boolean) => {
    if (!addMembers.isPending) {
      onOpenChange(o);
      if (!o) { setSearch(''); setSelected(new Set()); }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-[#0A1428] border-border/40 text-foreground">
        <DialogHeader>
          <DialogTitle>Add Members</DialogTitle>
          <DialogDescription>
            Select users to add to this group.{users.length > 0 && ` ${users.length} user${users.length !== 1 ? 's' : ''} available.`}
          </DialogDescription>
        </DialogHeader>

        {/* Search filter */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/40 border-border/40"
            autoFocus
          />
        </div>

        <div className="max-h-80 overflow-y-auto border border-border/20 rounded-lg bg-card/20 p-1">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {search ? `No users matching "${search}"` : 'No eligible users found'}
            </div>
          ) : (
            filtered.map(u => (
              <label key={u.id} className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${selected.has(u.id) ? 'bg-primary/20 border border-primary/30' : 'hover:bg-muted/10 border border-transparent'}`}>
                <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleUser(u.id)} className="w-4 h-4 accent-primary" />
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs ring-1 ring-primary/20 shrink-0">
                  {u.email[0].toUpperCase()}
                </div>
                <span className="flex-1 font-medium text-sm">{u.email}</span>
                <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">{u.role}</Badge>
              </label>
            ))
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={selected.size === 0 || addMembers.isPending}
            onClick={() => addMembers.mutate([...selected], { onSuccess: () => onOpenChange(false) })}
            className="bg-primary text-black font-bold"
          >
            {addMembers.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Selected ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Agents Modal ───────────────────────────────────────────────────────

function AssignAgentsModal({ groupId, existingAgentIds, open, onOpenChange }: {
  groupId: string; existingAgentIds: string[]; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const assignAgents = useAssignGroupAgents(groupId);

  const { data = [] } = useOrgAgents();
  const agents = data
    .filter((a: OrgAgent) => !existingAgentIds.includes(a.id))
    .filter((a: OrgAgent) => !search || a.name.toLowerCase().includes(search.toLowerCase()));


  const toggleAgent = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-[#0A1428] border-border/40 text-foreground">
        <DialogHeader>
          <DialogTitle>Assign Agents to Group</DialogTitle>
          <DialogDescription>Select active agents to expose to all group members.</DialogDescription>
        </DialogHeader>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-muted/40 border-border/40" />
        </div>
        <div className="max-h-[300px] overflow-y-auto border border-border/20 rounded-lg bg-card/20 p-1">
          {agents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground font-medium text-sm">No new active agents found</div>
          ) : (
            agents.map((a: OrgAgent) => (
              <label key={a.id} className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${selected.has(a.id) ? 'bg-primary/20 border border-primary/30' : 'hover:bg-muted/10 border border-transparent'}`}>
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleAgent(a.id)} className="w-4 h-4 accent-primary" />
                <span className="font-medium text-sm">{a.name}</span>
                <span className="text-muted-foreground text-xs ml-auto lowercase">({a.agent_type})</span>
              </label>
            ))
          )}
        </div>
        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={selected.size === 0 || assignAgents.isPending} onClick={() => assignAgents.mutate([...selected], { onSuccess: () => onOpenChange(false) })} className="bg-primary text-black font-bold">
            {assignAgents.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Assign Selected ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
