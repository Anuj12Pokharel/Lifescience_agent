'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInviteUser } from '@/lib/hooks/use-users';
import { useUsers } from '@/lib/hooks/use-users';
import { Loader2, UserPlus } from 'lucide-react';

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  password_confirm: z.string().optional(),
  managed_by_id: z.string().optional(),
}).refine((data) => {
  if (data.password && data.password !== data.password_confirm) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["password_confirm"],
});

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean; // superadmin = true
}

export function InviteUserDialog({ open, onOpenChange, isAdmin }: InviteUserDialogProps) {
  const invite = useInviteUser();
  const { data: adminList } = useUsers({ role: 'admin' });
  const admins = adminList?.results ?? [];

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      password: '',
      password_confirm: '',
      managed_by_id: '',
    },
  });

  async function onSubmit(values: z.infer<typeof inviteSchema>) {
    const { managed_by_id, ...rest } = values;
    const payload: any = { ...rest };
    
    if (managed_by_id && managed_by_id !== 'none' && managed_by_id.trim() !== '') {
      payload.managed_by_id = managed_by_id;
    }
    
    await invite.mutateAsync(payload);
    onOpenChange(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-[#0A1428] border-border/40 text-foreground shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-2 rounded-lg ring-1 ring-primary/20">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Invite New User</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Create a user directly and assign management.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="user@example.com" className="bg-muted/40 border-border/40" {...field} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="bg-muted/40 border-border/40" {...field} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password_confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Confirm</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="bg-muted/40 border-border/40" {...field} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>

            {isAdmin && (
              <FormField
                control={form.control}
                name="managed_by_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Assign to Manager (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/40 border-border/40">
                          <SelectValue placeholder="No manager assigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                        <SelectItem value="none">No manager</SelectItem>
                        {admins.map((admin) => (
                          <SelectItem key={admin.id} value={admin.id}>{admin.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:bg-white/5">
                Cancel
              </Button>
              <Button type="submit" disabled={invite.isPending} className="bg-primary text-black font-bold hover:bg-primary/90 min-w-32 shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)]">
                {invite.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Inviting...
                  </>
                ) : (
                  'Invite User'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
