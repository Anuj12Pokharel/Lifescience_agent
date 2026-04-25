'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Save, X, Building2, ShieldAlert } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCompany, useUpdateCompany } from '@/lib/hooks/use-company';
import type { UpdateCompanyPayload } from '@/lib/api-client';

const toLines = (arr: string[] | undefined) => (arr ?? []).join('\n');
const fromLines = (val: string) => val.split('\n').map((s) => s.trim()).filter(Boolean);

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: company, isLoading } = useCompany(id);
  const updateCompany = useUpdateCompany();

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<UpdateCompanyPayload>({});

  useEffect(() => {
    if (company) setForm(company);
  }, [company]);

  const set = <K extends keyof UpdateCompanyPayload>(key: K, value: UpdateCompanyPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    updateCompany.mutate(
      { id, payload: form },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const handleCancel = () => {
    if (company) setForm(company);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <DashboardLayout requireAdmin>
        <div className="flex justify-center items-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Admin trying to access a company not assigned to them
  if (!company) {
    return (
      <DashboardLayout requireAdmin>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-muted-foreground">
          <ShieldAlert className="h-12 w-12 opacity-20" />
          <p className="text-lg font-medium">Company not found or access denied.</p>
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Non-superadmin trying to view a company not assigned to them
  if (user?.role !== 'superadmin' && !company.can_edit && company.managed_by !== user?.id) {
    return (
      <DashboardLayout requireAdmin>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-muted-foreground">
          <ShieldAlert className="h-12 w-12 opacity-20" />
          <p className="text-lg font-medium">You do not have access to this company.</p>
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requireAdmin>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/admin/company')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{company.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {company.managed_by_email
                  ? <>Managed by <span className="text-primary">{company.managed_by_email}</span></>
                  : 'No admin assigned'}
              </p>
            </div>
          </div>

          {company.can_edit && (
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="ghost" onClick={handleCancel} disabled={updateCompany.isPending}>
                    <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={updateCompany.isPending} className="bg-primary text-black font-bold">
                    <Save className="mr-2 h-4 w-4" />
                    {updateCompany.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)} className="bg-primary text-black font-bold">
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Basic Info */}
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              ['name', 'Company Name'],
              ['location', 'Location'],
              ['website', 'Website'],
              ['email', 'Email'],
              ['timezone', 'Timezone'],
            ] as [keyof UpdateCompanyPayload, string][]).map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{label}</label>
                <Input
                  value={(form[key] as string) ?? ''}
                  onChange={(e) => set(key, e.target.value as never)}
                  disabled={!isEditing}
                  className="bg-muted/40 border-border/40 disabled:opacity-60"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Mission */}
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Mission</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              value={form.mission ?? ''}
              onChange={(e) => set('mission', e.target.value)}
              disabled={!isEditing}
              rows={4}
              className="bg-muted/40 border-border/40 disabled:opacity-60 resize-none"
            />
          </CardContent>
        </Card>

        {/* Pillars + Services */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Pillars</CardTitle>
              {isEditing && <p className="text-xs text-muted-foreground mt-1">One pillar per line</p>}
            </CardHeader>
            <CardContent>
              <Textarea
                value={toLines(form.pillars as string[])}
                onChange={(e) => set('pillars', fromLines(e.target.value) as never)}
                disabled={!isEditing}
                rows={6}
                className="bg-muted/40 border-border/40 disabled:opacity-60 resize-none text-sm"
                placeholder="Data with Integrity — transparency and ethical governance"
              />
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Services</CardTitle>
              {isEditing && <p className="text-xs text-muted-foreground mt-1">One service per line</p>}
            </CardHeader>
            <CardContent>
              <Textarea
                value={toLines(form.services as string[])}
                onChange={(e) => set('services', fromLines(e.target.value) as never)}
                disabled={!isEditing}
                rows={6}
                className="bg-muted/40 border-border/40 disabled:opacity-60 resize-none text-sm"
                placeholder="AI Education & Capability Building"
              />
            </CardContent>
          </Card>
        </div>

        {/* Who We Serve + Process */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Who We Serve</CardTitle>
              {isEditing && <p className="text-xs text-muted-foreground mt-1">One entry per line</p>}
            </CardHeader>
            <CardContent>
              <Textarea
                value={toLines(form.who_we_serve as string[])}
                onChange={(e) => set('who_we_serve', fromLines(e.target.value) as never)}
                disabled={!isEditing}
                rows={6}
                className="bg-muted/40 border-border/40 disabled:opacity-60 resize-none text-sm"
                placeholder="Healthcare providers, hospitals, clinics"
              />
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Process</CardTitle>
              {isEditing && <p className="text-xs text-muted-foreground mt-1">One step per line</p>}
            </CardHeader>
            <CardContent>
              <Textarea
                value={toLines(form.process as string[])}
                onChange={(e) => set('process', fromLines(e.target.value) as never)}
                disabled={!isEditing}
                rows={6}
                className="bg-muted/40 border-border/40 disabled:opacity-60 resize-none text-sm"
                placeholder="Step 1 — Initial Conversation: Explore goals"
              />
            </CardContent>
          </Card>
        </div>

        {/* System Prompt */}
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-base font-semibold">System Prompt</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              value={form.system_prompt ?? ''}
              onChange={(e) => set('system_prompt', e.target.value)}
              disabled={!isEditing}
              rows={8}
              className="bg-muted/40 border-border/40 disabled:opacity-60 resize-none font-mono text-sm"
            />
          </CardContent>
        </Card>

        {/* Metadata */}
        <div className="text-xs text-muted-foreground/50 flex gap-6 pb-4">
          <span>Created: {new Date(company.created_at).toLocaleString()}</span>
          <Separator orientation="vertical" className="h-4" />
          <span>Updated: {new Date(company.updated_at).toLocaleString()}</span>
        </div>

      </div>
    </DashboardLayout>
  );
}
