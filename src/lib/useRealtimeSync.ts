'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from './supabase-client';

export const SYNC_CHANNEL_NAME = 'pigeon-multi-device-sync';

// Global singleton registry for listeners
const dataListeners = new Set<(isBackground?: boolean) => void>();
type StatusListener = (status: { isConnected: boolean; deviceCount: number }) => void;
const statusListeners = new Set<StatusListener>();

let globalChannel: any = null;
let localBroadcastChannel: BroadcastChannel | null = null;
let currentStatus = {
  isConnected: false,
  deviceCount: 1,
};

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

function triggerAllDataListeners(isBackground: boolean = true) {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  debounceTimeout = setTimeout(() => {
    dataListeners.forEach((callback) => {
      try {
        callback(isBackground);
      } catch (err) {
        console.error('[Multi-Device Sync] Data listener error:', err);
      }
    });
  }, 80);
}

function notifyStatusListeners() {
  statusListeners.forEach((cb) => {
    try {
      cb({ ...currentStatus });
    } catch (err) {
      console.error('[Multi-Device Sync] Status listener error:', err);
    }
  });
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = sessionStorage.getItem('pigeon_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      sessionStorage.setItem('pigeon_device_id', id);
    }
    return id;
  } catch {
    return 'dev_fallback';
  }
}

export function ensureGlobalRealtimeInitialized() {
  if (typeof window === 'undefined') return;

  // 1. Cross-Tab Local Broadcast Channel (0ms sync on same device)
  if (!localBroadcastChannel && 'BroadcastChannel' in window) {
    try {
      localBroadcastChannel = new BroadcastChannel('pigeon_realtime_sync');
      localBroadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'DATA_CHANGED') {
          triggerAllDataListeners(true);
        }
      };
    } catch (e) {
      console.warn('[Multi-Device Sync] BroadcastChannel error:', e);
    }
  }

  // 2. Multi-Device Supabase WebSocket Channel Singleton
  if (!globalChannel) {
    try {
      const supabase = createClient();
      if (supabase) {
        const deviceId = getDeviceId();
        const channel = supabase.channel(SYNC_CHANNEL_NAME, {
          config: {
            broadcast: { self: false },
            presence: { key: deviceId },
          },
        });

        // A. Multi-device Broadcast Event
        channel.on('broadcast', { event: 'pigeon:sync' }, (payload: any) => {
          if (payload?.payload?.deviceId !== deviceId) {
            triggerAllDataListeners(true);
          }
        });

        // B. Database-level changes on main tables
        const tables = [
          'inventory',
          'borrowing_transactions',
          'transaction_items',
          'users',
          'returns_and_penalties',
        ];
        tables.forEach((table) => {
          channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table },
            () => {
              triggerAllDataListeners(true);
            }
          );
        });

        // C. Device Presence Tracker
        channel.on('presence', { event: 'sync' }, () => {
          try {
            const presenceState = channel.presenceState();
            const keys = Object.keys(presenceState);
            const count = Math.max(1, keys.length);
            currentStatus = { ...currentStatus, deviceCount: count };
            notifyStatusListeners();
          } catch (e) {
            console.warn('[Multi-Device Sync] Presence sync error:', e);
          }
        });

        // D. Subscribe & Presence Track
        channel.subscribe(async (status: string) => {
          const isConnected = status === 'SUBSCRIBED';
          currentStatus = { ...currentStatus, isConnected };
          notifyStatusListeners();

          if (isConnected) {
            try {
              await channel.track({
                deviceId,
                onlineAt: new Date().toISOString(),
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
              });
            } catch (err) {
              console.warn('[Multi-Device Sync] Presence track error:', err);
            }
          }
        });

        globalChannel = channel;
      }
    } catch (e) {
      console.warn('[Multi-Device Sync] Supabase init error:', e);
    }
  }
}

// Global broadcast function called when any action/mutation occurs on any device
export function broadcastDataChange(meta?: Record<string, any>) {
  const deviceId = getDeviceId();

  // 1. Send via local BroadcastChannel (same browser / machine)
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel('pigeon_realtime_sync');
      bc.postMessage({ type: 'DATA_CHANGED', at: Date.now(), deviceId, ...meta });
      bc.close();
    } catch {}
  }

  // 2. Broadcast via Supabase Realtime WebSocket to all other devices
  try {
    ensureGlobalRealtimeInitialized();
    if (globalChannel) {
      globalChannel.send({
        type: 'broadcast',
        event: 'pigeon:sync',
        payload: {
          deviceId,
          at: Date.now(),
          ...meta,
        },
      });
    }
  } catch (e) {
    console.warn('[Multi-Device Sync] Broadcast send error:', e);
  }
}

// React Hook to display active connection status & connected device count
export function useMultiDeviceStatus() {
  const [status, setStatus] = useState(currentStatus);

  useEffect(() => {
    ensureGlobalRealtimeInitialized();
    setStatus(currentStatus);

    const listener: StatusListener = (newStatus) => {
      setStatus(newStatus);
    };
    statusListeners.add(listener);

    return () => {
      statusListeners.delete(listener);
    };
  }, []);

  return status;
}

interface RealtimeSyncOptions {
  onRefresh: (isBackground?: boolean) => void;
  pollIntervalMs?: number;
  tables?: string[];
}

export function useRealtimeSync({
  onRefresh,
  pollIntervalMs = 2500,
}: RealtimeSyncOptions) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    ensureGlobalRealtimeInitialized();

    const callback = (isBackground?: boolean) => {
      refreshRef.current(isBackground);
    };
    dataListeners.add(callback);

    // Revalidate when user focuses the tab or unlocks phone
    const handleRevalidate = () => {
      refreshRef.current(true);
    };

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshRef.current(true);
      }
    };

    window.addEventListener('focus', handleRevalidate);
    window.addEventListener('online', handleRevalidate);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    // Polling fallback
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshRef.current(true);
      }
    }, pollIntervalMs);

    return () => {
      dataListeners.delete(callback);
      window.removeEventListener('focus', handleRevalidate);
      window.removeEventListener('online', handleRevalidate);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      clearInterval(interval);
    };
  }, [pollIntervalMs]);
}
