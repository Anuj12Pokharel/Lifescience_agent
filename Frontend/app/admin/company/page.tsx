'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2, Eye, UserCog, MoreHorizontal } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { useCompanies, useCreateCompany, useAssignAdmin } from '@/lib/hooks/use-company';
import { useUsers } from '@/lib/hooks/use-users';
import type { Company, CreateCompanyPayload } from '@/lib/api-client';

const EMPTY_FORM: CreateCompanyPayload = {
  name: '', location: '', website: '', email: '', timezone: '',
  mission: '', pillars: [], services: [], who_we_serve: [], process: [],
  system_prompt: '', managed_by: null,
};

export default function CompanyListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isSuperadmin = user?.role === 'superadmin';

  const { data: allCompanies = [], isLoading } = useCompanies();
  // Admins only see the company assigned to them; superadmin sees all
  const companies = isSuperadmin
    ? allCompanies
    : allCompanies.filter((c) => c.managed_by === user?.id);
  const { data: usersData } = useUsers({ role: 'admin', page_size: 100 });
  const admins = usersData?.results ?? [];

  const createCompany = useCreateCompany();
  const assignAdmin = useAssignAdmin();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateCompanyPayload>(EMPTY_FORM);

  const [assignTarget, setAssignTarget] = useState<Company | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<string>('none');

  const handleCreate = () => {
    createCompany.mutate(form, { onSuccess: () => { setCreateOpen(false); setForm(EMPTY_FORM); } });
  };

  const handleAssign = () => {
    if (!assignTarget) return;
    assignAdmin.mutate(
      { id: assignTarget.id, managed_by: selectedAdmin === 'none' ? null : selectedAdmin },
      { onSuccess: () => setAssignTarget(null) },
    );
  };

  return (
    <DashboardLayout requireAdmin>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Company Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage companies and their assigned administrators.</p>
          </div>
          {isSuperadmin && (
            <Button onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}
              className="bg-primary text-black font-bold shadow-[0_0_20px_-5px_rgba(var(--primary),0.4)]">
              <Plus className="mr-2 h-4 w-4" /> Create Company
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/40 bg-card/20 overflow-hidden backdrop-blur-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Company</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Contact</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Timezone</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Managed By</TableHead>
                <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-border/20">
                    <TableCell><div className="h-4 w-48 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-36 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-28 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-5 w-32 bg-muted animate-pulse rounded-full" /></TableCell>
                    <TableCell><div className="h-8 w-8 bg-muted animate-pulse rounded-md ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-8 w-8 opacity-20" />
                      <p>{isSuperadmin ? 'No companies yet' : 'No company has been assigned to you yet'}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <TableRow key={company.id} className="border-border/20 hover:bg-white/5 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{company.name}</div>
                          <div className="text-xs text-muted-foreground">{company.website || '—'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{company.email || '—'}</div>
                      <div className="text-xs text-muted-foreground">{company.location || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{company.timezone || '—'}</span>
                    </TableCell>
                    <TableCell>
                      {company.managed_by_email ? (
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs">
                          {company.managed_by_email}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-800/50">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 bg-[#0A1428] border-border/40 text-foreground">
                          <DropdownMenuItem
                            onClick={() => router.push(`/admin/company/${company.id}`)}
                            className="cursor-pointer hover:bg-white/5 py-2"
                          >
                            <Eye className="mr-2 h-4 w-4 text-primary" /> View / Edit
                          </DropdownMenuItem>
                          {isSuperadmin && (
                            <DropdownMenuItem
                              onClick={() => { setAssignTarget(company); setSelectedAdmin(company.managed_by ?? 'none'); }}
                              className="cursor-pointer hover:bg-white/5 py-2"
                            >
                              <UserCog className="mr-2 h-4 w-4 text-amber-400" /> Assign Admin
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
        </div>
      </div>

      {/* Create Company Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !createCompany.isPending && setCreateOpen(o)}>
        <DialogContent className="sm:max-w-135 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>Create Company</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Fill in the company details. You can assign an admin after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {([
              ['name', 'Company Name', 'text'],
              ['email', 'Email', 'email'],
              ['website', 'Website', 'text'],
              ['location', 'Location', 'text'],
              ['timezone', 'Timezone', 'text'],
            ] as [keyof CreateCompanyPayload, string, string][]).map(([key, label, type]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{label}</label>
                <Input
                  type={type}
                  value={(form[key] as string) ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="bg-muted/40 border-border/40"
                />
              </div>
            ))}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Mission</label>
              <Textarea
                value={form.mission ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, mission: e.target.value }))}
                rows={3}
                className="bg-muted/40 border-border/40 resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">System Prompt</label>
              <Textarea
                value={form.system_prompt ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
                rows={3}
                className="bg-muted/40 border-border/40 resize-none font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={createCompany.isPending}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createCompany.isPending || !form.name}
              className="bg-primary text-black font-bold">
              {createCompany.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Admin Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(o) => !assignAdmin.isPending && !o && setAssignTarget(null)}>
        <DialogContent className="sm:max-w-105 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>Assign Admin</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Choose which admin manages{' '}
              <span className="text-foreground font-medium">{assignTarget?.name}</span>.
              Set to Unassigned to remove the current admin.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 block">Admin</label>
            <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
              <SelectTrigger className="bg-muted/40 border-border/40">
                <SelectValue placeholder="Select admin" />
              </SelectTrigger>
              <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                <SelectItem value="none">Unassigned</SelectItem>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignTarget(null)} disabled={assignAdmin.isPending}>Cancel</Button>
            <Button onClick={handleAssign} disabled={assignAdmin.isPending} className="bg-primary text-black font-bold">
              {assignAdmin.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
