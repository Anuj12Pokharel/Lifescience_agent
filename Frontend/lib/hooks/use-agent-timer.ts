'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usageApi } from '@/lib/api-client';

/**
 * Tracks active chat time for a user on an agent.
 * - Starts a session on mount
 * - Sends a heartbeat every 30s while the tab is visible
 * - Pauses heartbeats when the tab is hidden (Page Visibility API)
 * - Ends the session on unmount
 */
export function useAgentTimer(agentSlug: string | null, enabled = true) {
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);
  const limitExceededRef = useRef(false);
  const agentSlugRef = useRef(agentSlug);
  agentSlugRef.current = agentSlug;

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current || !isVisibleRef.current || limitExceededRef.current) return;
    try {
      const res = await usageApi.heartbeat(sessionIdRef.current);
      if (res.limit_exceeded) {
        limitExceededRef.current = true;
        stopHeartbeat();
      }
    } catch (err: unknown) {
      // Session not found (stale ID) — restart session silently
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 && agentSlugRef.current) {
        try {
          const res = await usageApi.startSession(agentSlugRef.current);
          sessionIdRef.current = res.session_id;
        } catch {
          // blocked or unavailable — stop tracking
          stopHeartbeat();
        }
      }
    }
  }, [stopHeartbeat]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 30_000);
  }, [sendHeartbeat, stopHeartbeat]);

  useEffect(() => {
    if (!enabled || !agentSlug) return;

    let mounted = true;

    const start = async () => {
      try {
        const res = await usageApi.startSession(agentSlug);
        if (!mounted) return;
        sessionIdRef.current = res.session_id;
        startHeartbeat();
      } catch {
        // blocked by limit or other error — don't start timer
      }
    };

    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
      if (isVisibleRef.current) {
        // Tab came back — send immediate heartbeat and restart interval
        sendHeartbeat();
        startHeartbeat();
      } else {
        // Tab hidden — stop interval, no more heartbeats until visible
        stopHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    start();

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopHeartbeat();
      if (sessionIdRef.current) {
        usageApi.endSession(sessionIdRef.current).catch(() => {});
        sessionIdRef.current = null;
      }
    };
  }, [agentSlug, enabled, startHeartbeat, stopHeartbeat, sendHeartbeat]);
}
