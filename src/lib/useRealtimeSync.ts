'use client';

import { useEffect, useRef } from 'react';
import { createClient } from './supabase-client';

interface RealtimeSyncOptions {
  onRefresh: (isBackground?: boolean) => void;
  pollIntervalMs?: number;
  tables?: string[];
}

export function useRealtimeSync({
  onRefresh,
  pollIntervalMs = 3500,
  tables = ['inventory', 'borrowing_transactions', 'transaction_items', 'users', 'returns_and_penalties'],
}: RealtimeSyncOptions) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    // 1. Cross-Tab Broadcast Channel (Instant sync across open browser tabs)
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('pigeon_realtime_sync');
        bc.onmessage = () => {
          refreshRef.current(true);
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    // 2. Window Focus & Online Revalidation
    const handleFocus = () => {
      refreshRef.current(true);
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    // 3. Supabase Realtime WebSockets Channel
    let channel: any = null;
    try {
      const supabase = createClient();
      if (supabase) {
        channel = supabase.channel(`pigeon-realtime-${Math.random().toString(36).substring(7)}`);

        tables.forEach((table) => {
          channel = channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table },
            () => {
              refreshRef.current(true);
            }
          );
        });

        channel.subscribe();
      }
    } catch (e) {
      console.warn('Realtime channel subscription fallback:', e);
    }

    // 4. Background Polling Timer (3.5s interval fallback)
    const interval = setInterval(() => {
      // Only poll when the tab is visible to avoid unnecessary battery/data drain
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshRef.current(true);
      }
    }, pollIntervalMs);

    return () => {
      if (bc) {
        try {
          bc.close();
        } catch {}
      }
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      clearInterval(interval);
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [pollIntervalMs, tables.join(',')]);
}

// Global helper to broadcast updates whenever any mutation happens
export function broadcastDataChange() {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel('pigeon_realtime_sync');
      bc.postMessage({ type: 'DATA_CHANGED', at: Date.now() });
      bc.close();
    } catch {}
  }
}
