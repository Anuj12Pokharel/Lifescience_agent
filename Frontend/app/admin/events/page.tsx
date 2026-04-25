'use client';

import { useState } from 'react';
import { Plus, MoreHorizontal, ToggleLeft, ToggleRight, Pencil, Trash2, CalendarDays } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import {
  useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, useToggleEvent,
} from '@/lib/hooks/use-company';
import { useUsers } from '@/lib/hooks/use-users';
import type { CompanyEvent, EventPayload } from '@/lib/api-client';

const EMPTY_FORM: EventPayload = {
  title: '',
  description: '',
  date: '',
  time: '',
  timezone: 'Perth (AWST)',
  format: '',
  is_active: true,
  managed_by: null,
};

export default function EventsManagementPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';
  const canCreate = user?.role === 'admin' || user?.role === 'superadmin';

  const { data: events = [], isLoading } = useEvents();
  const { data: usersData } = useUsers({ role: 'admin', page_size: 100 });
  const admins = usersData?.results ?? [];

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const toggleEvent = useToggleEvent();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CompanyEvent | null>(null);
  const [form, setForm] = useState<EventPayload>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<CompanyEvent | null>(null);

  const openCreate = () => {
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM, managed_by: user?.role === 'admin' ? user.id : null });
    setDialogOpen(true);
  };

  const openEdit = (event: CompanyEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time.slice(0, 5), // HH:MM for input[type=time]
      timezone: event.timezone,
      format: event.format,
      is_active: event.is_active,
      managed_by: event.managed_by,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload: EventPayload = {
      ...form,
      time: form.time.length === 5 ? form.time + ':00' : form.time,
    };

    if (editingEvent) {
      updateEvent.mutate({ id: editingEvent.id, payload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createEvent.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const isPending = createEvent.isPending || updateEvent.isPending;

  return (
    <DashboardLayout requireAdmin>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Events Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage company events, workshops, and conferences.</p>
          </div>
          {canCreate && (
            <Button onClick={openCreate} className="bg-primary text-black font-bold shadow-[0_0_20px_-5px_rgba(var(--primary),0.4)]">
              <Plus className="mr-2 h-4 w-4" /> Create Event
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/40 bg-card/20 overflow-hidden backdrop-blur-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Event</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Date & Time</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Format</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Status</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Managed By</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-border/20 hover:bg-white/5">
                    <TableCell><div className="h-4 w-48 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-28 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-5 w-24 bg-muted animate-pulse rounded-full" /></TableCell>
                    <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded-full" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-8 w-8 bg-muted animate-pulse rounded-md ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarDays className="h-8 w-8 opacity-20" />
                      <p>No events found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id} className="border-border/20 hover:bg-white/5 transition-colors">
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground">{event.title}</div>
                        {event.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{event.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{event.date}</div>
                      <div className="text-xs text-muted-foreground">{event.time.slice(0, 5)} · {event.timezone}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs">
                        {event.format || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        event.is_active
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                          : 'border-slate-500/30 text-slate-400 bg-slate-500/10'
                      }>
                        {event.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{event.managed_by_email ?? '—'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {event.can_edit ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-800/50 hover:text-white">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 bg-[#0A1428] border-border/40 text-foreground">
                            <DropdownMenuItem onClick={() => openEdit(event)} className="cursor-pointer hover:bg-white/5 py-2">
                              <Pencil className="mr-2 h-4 w-4 text-primary" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleEvent.mutate(event.id)}
                              className="cursor-pointer hover:bg-white/5 py-2"
                            >
                              {event.is_active
                                ? <><ToggleLeft className="mr-2 h-4 w-4 text-amber-400" /> Deactivate</>
                                : <><ToggleRight className="mr-2 h-4 w-4 text-emerald-400" /> Activate</>
                              }
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border/40" />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(event)}
                              className="cursor-pointer hover:bg-white/5 py-2 text-rose-400 focus:text-rose-400"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">No access</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !isPending && setDialogOpen(o)}>
        <DialogContent className="sm:max-w-[520px] bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {editingEvent ? 'Update the event details below.' : 'Fill in the details to create a new event.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Title</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="AI Workshop" className="bg-muted/40 border-border/40" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3} className="bg-muted/40 border-border/40 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Date</label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="bg-muted/40 border-border/40" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Time</label>
                <Input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className="bg-muted/40 border-border/40" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Timezone</label>
                <Input value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                  className="bg-muted/40 border-border/40" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Format</label>
                <Input value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
                  placeholder="Interactive workshop" className="bg-muted/40 border-border/40" />
              </div>
            </div>

            {isSuperadmin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Managed By</label>
                <Select
                  value={form.managed_by ?? 'none'}
                  onValueChange={(v) => setForm((f) => ({ ...f, managed_by: v === 'none' ? null : v }))}
                >
                  <SelectTrigger className="bg-muted/40 border-border/40">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                    <SelectItem value="none">Unassigned</SelectItem>
                    {admins.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <label className="text-sm text-muted-foreground">Active</label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending} className="bg-primary text-black font-bold">
              {isPending ? 'Saving...' : editingEvent ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-[#0A1428] border-border/40 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete <span className="text-foreground font-medium">{deleteTarget?.title}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border/40">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => {
                if (deleteTarget) deleteEvent.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
