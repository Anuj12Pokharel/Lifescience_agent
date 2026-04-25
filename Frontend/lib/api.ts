import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.lifescienceaiagents.com';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send httpOnly cookies automatically
  headers: { 'Content-Type': 'application/json' },
});

// Token storage
let accessToken: string | null = null;
if (typeof window !== 'undefined') {
  accessToken = localStorage.getItem('access_token');
  // Sync to cookie so middleware (Edge runtime) can read it
  if (accessToken) {
    document.cookie = `access_token=${accessToken}; path=/; SameSite=Lax`;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('access_token', token);
      document.cookie = `access_token=${token}; path=/; SameSite=Lax`;
    } else {
      localStorage.removeItem('access_token');
      document.cookie = 'access_token=; path=/; max-age=0';
    }
  }
}

export function getAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token');
  }
  return accessToken;
}

// Request interceptor: attach bearer token (skip for public auth endpoints)
const PUBLIC_AUTH_URLS = ['/auth/register/', '/auth/login/', '/auth/forgot-password/', '/auth/verify-email/', '/auth/resend-verification/', '/auth/reset-password/', '/auth/token/refresh/'];

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const url = config.url || '';
  const isPublic = PUBLIC_AUTH_URLS.some((u) => url.includes(u));
  const token = getAccessToken();
  if (token && config.headers && !isPublic) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
}

// Response interceptor: handle 401, refresh token once
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't refresh for login/register endpoints
      const url = originalRequest.url || '';
      if (url.includes('/auth/login/') || url.includes('/auth/register/') || url.includes('/auth/token/refresh/')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${BASE_URL.replace(/\/$/, '')}/api/v1/auth/token/refresh/`, {}, { withCredentials: true });
        const newToken = res.data?.data?.access ?? res.data?.access;
        if (!newToken) throw new Error('No token in refresh response');
        setAccessToken(newToken);
        processQueue(null, newToken);
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch {
        processQueue(null, null); // resolve queue silently so no toast errors fire
        setAccessToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        // Return a never-resolving promise — the page is already redirecting
        return new Promise(() => {});
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
