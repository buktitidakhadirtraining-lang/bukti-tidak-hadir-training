// lib/useJenisTraining.js
// Hook terpusat & selalu segar untuk daftar Master Jenis Training (training_types) di seluruh aplikasi
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  sortTrainings,
  normalizeTrainingName,
  resolveTrainingName,
} from './training-utils.js';

export { sortTrainings, normalizeTrainingName, resolveTrainingName };

const BROADCAST_CHANNEL_NAME = 'training_types_sync';
const CUSTOM_EVENT_NAME = 'training-types-changed';
const POLL_INTERVAL_MS = 30000; // Fallback polling 30 detik

// Store bersama di tingkat modul agar seluruh komponen dalam tab aktif sinkron seketika
const sharedStore = {
  allTrainings: [],
  activeTrainings: [],
  lastLoadedAt: null,
  error: null,
  inFlightAll: null,
  inFlightActive: null,
  subscribers: new Set(),
};

let globalRealtimeClient = null;
let globalRealtimeChannel = null;

function notifySubscribers() {
  sharedStore.subscribers.forEach((cb) => {
    try {
      cb();
    } catch (_) {}
  });
}

/**
 * Memicu pembaruan ke seluruh komponen di tab aktif & tab lain seketika (tanpa cache stale)
 */
export function notifyTrainingTypesChanged() {
  // 1. Bersihkan state timestamp agar refetch berikutnya selalu dianggap perlu & segar
  sharedStore.lastLoadedAt = null;
  sharedStore.inFlightAll = null;
  sharedStore.inFlightActive = null;

  if (typeof window === 'undefined') return;

  // 2. BroadcastChannel untuk tab lain pada origin yang sama
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({ type: 'TRAINING_TYPES_CHANGED', timestamp: Date.now() });
      channel.close();
    }
  } catch (err) {
    console.warn('[BroadcastChannel error]:', err);
  }

  // 3. CustomEvent untuk seluruh instance hook di tab/jendela aktif
  try {
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: { timestamp: Date.now() } }));
  } catch (err) {
    console.warn('[CustomEvent error]:', err);
  }
}

function initSupabaseRealtime(publicConfig) {
  if (typeof window === 'undefined' || globalRealtimeClient || !publicConfig) return;
  const { supabaseUrl, supabaseAnonKey } = publicConfig;
  if (!supabaseUrl || !supabaseAnonKey) return;

  try {
    globalRealtimeClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    globalRealtimeChannel = globalRealtimeClient
      .channel('realtime:training_types')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'training_types' },
        () => {
          notifyTrainingTypesChanged();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Terhubung ke perubahan tabel training_types.');
        }
      });
  } catch (rtErr) {
    console.warn('[Realtime init failed]:', rtErr?.message);
  }
}

async function fetchFromServer(includeInactive = false) {
  const inflightKey = includeInactive ? 'inFlightAll' : 'inFlightActive';
  if (sharedStore[inflightKey]) {
    return sharedStore[inflightKey];
  }

  const promise = (async () => {
    const timestamp = Date.now();
    const res = await fetch(
      `/api/trainings?all=${includeInactive ? 'true' : 'false'}&_t=${timestamp}`,
      {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Gagal memuat Jenis Training (Status: ${res.status})`);
    }

    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.error || 'Gagal memuat Jenis Training');
    }

    const rawList = Array.isArray(json.data) ? json.data : [];
    const sorted = sortTrainings(rawList);
    const activeOnly = sorted.filter((t) => t.is_active !== false);

    if (includeInactive) {
      sharedStore.allTrainings = sorted;
    }
    sharedStore.activeTrainings = activeOnly;
    sharedStore.error = null;
    sharedStore.lastLoadedAt = new Date();

    if (json.publicConfig) {
      initSupabaseRealtime(json.publicConfig);
    }

    notifySubscribers();
    return includeInactive ? sorted : activeOnly;
  })();

  sharedStore[inflightKey] = promise;
  try {
    return await promise;
  } finally {
    if (sharedStore[inflightKey] === promise) {
      sharedStore[inflightKey] = null;
    }
  }
}

export function useJenisTraining(options = {}) {
  const { includeInactive = false, autoRefetch = true } = options;

  const initialList = includeInactive
    ? sharedStore.allTrainings
    : sharedStore.activeTrainings;

  const [trainings, setTrainings] = useState(initialList);
  const [loading, setLoading] = useState(initialList.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastLoadedAt, setLastLoadedAt] = useState(sharedStore.lastLoadedAt);
  const isMountedRef = useRef(true);

  const syncFromStore = useCallback(() => {
    if (!isMountedRef.current) return;
    const list = includeInactive ? sharedStore.allTrainings : sharedStore.activeTrainings;
    setTrainings(list);
    setLastLoadedAt(sharedStore.lastLoadedAt);
  }, [includeInactive]);

  const fetchTrainings = useCallback(
    async (isSilent = false) => {
      if (isMountedRef.current) {
        if (!isSilent && (includeInactive ? sharedStore.allTrainings : sharedStore.activeTrainings).length === 0) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
        setError(null);
      }

      try {
        const list = await fetchFromServer(includeInactive);
        if (isMountedRef.current) {
          setTrainings(list);
          setLastLoadedAt(sharedStore.lastLoadedAt);
          setError(null);
        }
      } catch (err) {
        console.error('[useJenisTraining Fetch Error]:', err);
        if (isMountedRef.current) {
          setError('Gagal memuat Jenis Training');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [includeInactive]
  );

  useEffect(() => {
    isMountedRef.current = true;
    sharedStore.subscribers.add(syncFromStore);

    // Selalu ambil ulang data terbaru dari database saat komponen mount
    const hasExisting = (includeInactive ? sharedStore.allTrainings : sharedStore.activeTrainings).length > 0;
    fetchTrainings(hasExisting);

    if (!autoRefetch) {
      return () => {
        isMountedRef.current = false;
        sharedStore.subscribers.delete(syncFromStore);
      };
    }

    // 1. Refetch saat jendela fokus / tab kembali terlihat
    const handleFocus = () => {
      fetchTrainings(true);
    };
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchTrainings(true);
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Refetch via BroadcastChannel dari tab lain (misal Admin mengubah Master di tab sebelah)
    let broadcastChannel = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        broadcastChannel.onmessage = (e) => {
          if (e.data?.type === 'TRAINING_TYPES_CHANGED') {
            sharedStore.inFlightAll = null;
            sharedStore.inFlightActive = null;
            fetchTrainings(true);
          }
        };
      }
    } catch (bcErr) {
      console.warn('[BroadcastChannel listener error]:', bcErr);
    }

    // 3. Refetch via CustomEvent di tab yang sama
    const handleLocalEvent = () => {
      sharedStore.inFlightAll = null;
      sharedStore.inFlightActive = null;
      fetchTrainings(true);
    };
    window.addEventListener(CUSTOM_EVENT_NAME, handleLocalEvent);

    // 4. Polling berkala 30 detik sebagai fallback jika Realtime terputus
    const pollInterval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchTrainings(true);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      sharedStore.subscribers.delete(syncFromStore);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener(CUSTOM_EVENT_NAME, handleLocalEvent);
      clearInterval(pollInterval);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [fetchTrainings, syncFromStore, autoRefetch, includeInactive]);

  const trainingsMap = useMemo(() => {
    const map = new Map();
    trainings.forEach((t) => {
      if (t.id) map.set(String(t.id), t.name);
      if (t.name) map.set(normalizeTrainingName(t.name), t.name);
    });
    return map;
  }, [trainings]);

  const resolveName = useCallback(
    (idOrKey, fallbackName = '-') => resolveTrainingName(trainings, idOrKey, fallbackName),
    [trainings]
  );

  const getTrainingNameById = useCallback(
    (id, fallbackName = '-') => {
      if (!id) return fallbackName;
      return trainingsMap.get(String(id)) || fallbackName;
    },
    [trainingsMap]
  );

  const getTrainingById = useCallback(
    (id) => {
      if (!id) return null;
      return trainings.find((t) => String(t.id) === String(id)) || null;
    },
    [trainings]
  );

  return {
    trainings,
    loading,
    refreshing,
    error,
    lastLoadedAt,
    sourceTable: 'training_types',
    refetch: () => fetchTrainings(false),
    resolveTrainingName: resolveName,
    getTrainingNameById,
    getTrainingById,
  };
}
