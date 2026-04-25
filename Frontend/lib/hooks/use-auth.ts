import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authApi } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

// ─── Register ──────────────────────────────────────────────────────────────────

export function useRegister() {
  return useMutation({
    mutationFn: authApi.register,
    onError: () => {},           // callers handle errors via mutation.error
  });
}

export function useRegisterAdmin() {
  return useMutation({
    mutationFn: authApi.registerAdmin,
    onError: () => {},
  });
}

// ─── Login ─────────────────────────────────────────────────────────────────────

export function useLogin() {
  const { setUser } = useAuth();
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      // Update React context state with user data
      setUser(data.user);
      toast.success('Logged in successfully');
      console.log('[useLogin] Login successful, user role:', data.user.role);
      console.log('[useLogin] User state updated in context:', data.user);
      
      if (data.user.role === 'superadmin') {
        console.log('[useLogin] Navigating to superadmin panel');
        router.push('/superadmin');
      } else if (data.user.role === 'admin') {
        console.log('[useLogin] Navigating to admin dashboard');
        router.push('/admin/dashboard');
      } else {
        console.log('[useLogin] Navigating to user dashboard');
        router.push('/dashboard');
      }
    },
    onError: (error: any) => {
      console.error('[useLogin] Login failed:', error);
    },
  });
}

// ─── Logout ────────────────────────────────────────────────────────────────────

export function useLogout() {
  const { setUser } = useAuth();
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      setUser(null);
      router.push('/login');
    },
  });
}

// ─── Verify email ──────────────────────────────────────────────────────────────

export function useVerifyEmail() {
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: () => {
      toast.success('Email verified! You can now log in.');
      setTimeout(() => router.push('/login'), 2500);
    },
  });
}

// ─── Resend verification ───────────────────────────────────────────────────────

export function useResendVerification() {
  return useMutation({
    mutationFn: authApi.resendVerification,
  });
}

// ─── Forgot password ───────────────────────────────────────────────────────────

export function useForgotPassword() {
  return useMutation({
    mutationFn: authApi.forgotPassword,
  });
}

// ─── Reset password ────────────────────────────────────────────────────────────

export function useResetPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      toast.success('Password reset successfully! Please log in.');
      router.push('/login');
    },
  });
}

// ─── Change password ───────────────────────────────────────────────────────────

export function useChangePassword() {
  const { updateToken } = useAuth();

  return useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: (data) => {
      const newToken: string | undefined = data?.data?.access;
      if (newToken) updateToken(newToken);
      toast.success('Password changed successfully');
    },
  });
}
