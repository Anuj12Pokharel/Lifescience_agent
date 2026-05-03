'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInviteUser, useUsers } from '@/lib/hooks/use-users';
import { useGmailStatus } from '@/lib/hooks/use-integrations';
import { Loader2, UserPlus, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean; // true = superadmin
}

export function InviteUserDialog({ open, onOpenChange, isAdmin }: InviteUserDialogProps) {
  const invite = useInviteUser();
  const { data: adminList } = useUsers({ role: 'admin' });
  const admins = adminList?.results ?? [];
  const { data: gmailStatus } = useGmailStatus();

  const [email, setEmail]           = useState('');
  const [managedById, setManagedById] = useState('');
  const [success, setSuccess]       = useState(false);
  const [invitedEmail, setInvitedEmail] = useState('');

  const errorData = (invite.error as {
    response?: { data?: { error?: { message?: string; details?: Record<string, string[]> } } };
  })?.response?.data?.error;
  const emailError  = errorData?.details?.email?.[0] ?? '';
  const globalError = (!errorData?.details && errorData?.message) ? errorData.message : '';

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail || invite.isPending) return;

    const payload: { email: string; managed_by_id?: string } = { email };
    if (managedById && managedById !== 'none') payload.managed_by_id = managedById;

    try {
      await invite.mutateAsync(payload);
      setInvitedEmail(email);
      setSuccess(true);
    } catch (_) { /* errors shown inline */ }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setEmail(''); setManagedById(''); setSuccess(false); setInvitedEmail('');
      invite.reset?.();
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] bg-[#0A1428] border-border/40 text-foreground shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-primary/10 p-2 rounded-lg ring-1 ring-primary/20">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Invite User</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                They'll receive an email with a secure signup link.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          /* ── Success state ── */
          <div className="py-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-400" />
              </div>
            </div>
            <div>
              <p className="font-bold text-foreground text-base">Invitation sent!</p>
              <p className="text-sm text-muted-foreground mt-1">
                A signup link has been sent to{' '}
                <span className="text-primary font-semibold">{invitedEmail}</span>.
                It expires in 72 hours.
              </p>
            </div>
            <p className="text-xs text-muted-foreground/60">
              The user will fill in their name, phone and password via the link, then sign in to access their agents.
            </p>
            <DialogFooter className="!mt-2">
              <Button onClick={handleClose} className="w-full">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} className="space-y-5 py-4">
            {/* Global error */}
            {globalError && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {globalError}
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  type="email"
                  placeholder="user@example.com"
                  className="pl-9 bg-muted/40 border-border/40"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {emailError && (
                <p className="text-[11px] text-destructive">{emailError}</p>
              )}
            </div>

            {/* Assign to admin (superadmin only) */}
            {isAdmin && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                  Assign to Manager <span className="font-normal normal-case text-muted-foreground/50">(optional)</span>
                </Label>
                <Select value={managedById} onValueChange={setManagedById}>
                  <SelectTrigger className="bg-muted/40 border-border/40">
                    <SelectValue placeholder="No manager assigned" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                    <SelectItem value="none">No manager</SelectItem>
                    {admins.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Info note */}
            <div className="bg-muted/20 border border-border/30 rounded-lg px-3 py-2.5 text-xs text-muted-foreground/70 space-y-1">
              <p>The invited user will:</p>
              <ol className="list-decimal list-inside space-y-0.5 pl-1">
                <li>Click the secure link in the email</li>
                <li>Fill in their name, phone &amp; password</li>
                <li>Sign in to access their agents</li>
              </ol>
              {gmailStatus?.connected && (
                <div className="pt-1 mt-1 border-t border-border/20 text-[10px] text-emerald-400/80 flex items-center gap-1.5 font-medium">
                  <Mail className="h-3 w-3" />
                  Invitation will be sent via {gmailStatus.gmail_email}
                </div>
              )}
            </div>


            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={handleClose}
                className="text-muted-foreground hover:bg-white/5">
                Cancel
              </Button>
              <Button type="submit" disabled={invite.isPending || !isValidEmail}
                className="bg-primary text-black font-bold hover:bg-primary/90 min-w-32 shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)]">
                {invite.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                  : 'Send Invite'
                }
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
