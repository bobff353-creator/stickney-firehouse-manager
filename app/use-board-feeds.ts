'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { createBoardFeedClient, emptyBoardFeeds, validBoardFeeds } from './board-feeds-client';
import type { BoardFeeds } from './lib/board-feed-types';
let client: ReturnType<typeof createBoardFeedClient> | undefined;
function browserClient() {
  if (typeof window === 'undefined') return undefined;
  client ??= createBoardFeedClient({
    now: Date.now, active: () => document.visibilityState !== 'hidden', online: () => navigator.onLine,
    setTimer: (callback, delay) => setTimeout(callback, delay), clearTimer: timer => clearTimeout(timer),
    request: async (group, signal) => {
      const response = await fetch(`/api/board-feeds?group=${group}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
      if (!response.ok) throw new Error('Saved feeds unavailable');
      return response.json() as Promise<BoardFeeds>;
    },
    restore: group => {
      try { const raw = localStorage.getItem(`stickney-public-board-feeds-v1:${group}`); const value: unknown = raw ? JSON.parse(raw) : null; return validBoardFeeds(value) ? value : null; } catch { return null; }
    },
    persist: (group, value) => { try { localStorage.setItem(`stickney-public-board-feeds-v1:${group}`, JSON.stringify(value)); } catch { /* Storage is optional; durable authority is Supabase. */ } },
  });
  return client;
}
export function useBoardFeeds(alwaysOn: boolean) {
  const subscribe = useCallback((callback: () => void) => browserClient()?.subscribe(callback, alwaysOn) ?? (() => {}), [alwaysOn]);
  const value = useSyncExternalStore(subscribe, () => browserClient()?.snapshot() ?? emptyBoardFeeds, () => emptyBoardFeeds);
  useEffect(() => {
    const resume = () => browserClient()?.resume();
    window.addEventListener('online', resume); window.addEventListener('offline', resume); document.addEventListener('visibilitychange', resume);
    return () => { window.removeEventListener('online', resume); window.removeEventListener('offline', resume); document.removeEventListener('visibilitychange', resume); };
  }, []);
  return value;
}
