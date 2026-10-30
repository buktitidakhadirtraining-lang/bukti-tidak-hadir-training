// lib/useMasterTrainings.js
// Hook terpusat & selalu segar untuk daftar Master Jenis Training di seluruh aplikasi
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Fungsi pengurutan terpadu: memastikan urutan di semua dropdown identik dengan Master Jenis Training
export function sortTrainings(items) {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const hasOrderA = typeof a.sort_order === 'number' && !isNaN(a.sort_order) && a.sort_order !== 0;
    const hasOrderB = typeof b.sort_order === 'number' && !isNaN(b.sort_order) && b.sort_order !== 0;
    
    if (hasOrderA && hasOrderB && a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }
    
    // Urutkan berdasarkan nama abjad (Bahasa Indonesia, case-insensitive, numeric-aware)
    return String(a.name || '').localeCompare(String(b.name || ''), 'id', {
      sensitivity: 'base',
      numeric: true,
    });
  });
}

// Fungsi helper untuk memicu pembaruan ke tab lain & seluruh komponen di tab aktif
export function notifyTrainingTypesChanged() {
  if (typeof window === 'undefined') return;

  // 1. BroadcastChannel untuk tab lain
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('training_types_sync');
      channel.postMessage({ type: 'TRAINING_TYPES_CHANGED', timestamp: Date.now() });
      channel.close();
    }
  } catch (err) {
    console.warn('[BroadcastChannel error]:', err);
  }

  // 2. CustomEvent untuk tab / jendela aktif
  try {
    window.dispatchEvent(new CustomEvent('training-types-changed', { detail: { timestamp: Date.now() } }));
  } catch (err) {
    console.warn('[CustomEvent error]:', err);
  }
}

// Cache in-memory singleton sederhana agar komponen yang render bersamaan tidak spam fetch
let memoryTrainingsCache = null;
let memoryCacheTimestamp = 0;
const CACHE_MAX_AGE_MS = 2000; // Maksimal 2 detik untuk batching render, lalu selalu revalidate

let globalRealtimeClient = null;

export function useMasterTrainings(options = {}) {
  const { includeInactive = false, autoRefetch = true } = options;

  const [trainings, setTrainings] = useState(() => {
    if (memoryTrainingsCache && Date.now() - memoryCacheTimestamp < CACHE_MAX_AGE_MS) {
      return includeInactive
        ? memoryTrainingsCache
        : memoryTrainingsCache.filter((t) => t.is_active);
    }
    return [];
  });
  const [loading, setLoading] = useState(trainings.length === 0);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  const fetchTrainings = useCallback(async (isSilent = false) => {
    if (!isSilent && trainings.length === 0) {
      setLoading(true);
    }
    setError(null);

    try {
      // Ambil selalu data terbaru dari database (hindari cache browser)
      const timestamp = Date.now();
      const res = await fetch(`/api/trainings?all=${includeInactive ? 'true' : 'false'}&_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) {
        throw new Error(`Gagal memuat jenis training (Status: ${res.status})`);
      }

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || 'Gagal memuat data jenis training dari server');
      }

      const rawList = Array.isArray(json.data) ? json.data : [];
      const sorted = sortTrainings(rawList);

      memoryTrainingsCache = sorted;
      memoryCacheTimestamp = Date.now();

      if (isMountedRef.current) {
        setTrainings(includeInactive ? sorted : sorted.filter((t) => t.is_active));
        setError(null);
      }

      // Inisialisasi Supabase Realtime client jika config publik tersedia
      if (typeof window !== 'undefined' && !globalRealtimeClient && json.publicConfig) {
        const { supabaseUrl, supabaseAnonKey } = json.publicConfig;
        if (supabaseUrl && supabaseAnonKey) {
          try {
            globalRealtimeClient = createClient(supabaseUrl, supabaseAnonKey, {
              auth: { persistSession: false },
            });

            globalRealtimeClient
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
                  console.log('[Realtime] Berhasil terhubung ke perubahan tabel training_types.');
                }
              });
          } catch (rtErr) {
            console.warn('[Realtime init failed]:', rtErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[useMasterTrainings Fetch Error]:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Gagal memuat Jenis Training');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [includeInactive, trainings.length]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchTrainings(trainings.length > 0);

    if (!autoRefetch) {
      return () => {
        isMountedRef.current = false;
      };
    }

    // 1. Refetch saat tab browser kembali aktif (visibilitychange & focus)
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchTrainings(true);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 2. Refetch via BroadcastChannel dari tab lain
    let broadcastChannel = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('training_types_sync');
        broadcastChannel.onmessage = (e) => {
          if (e.data?.type === 'TRAINING_TYPES_CHANGED') {
            fetchTrainings(true);
          }
        };
      }
    } catch (bcErr) {
      console.warn('[BroadcastChannel listener error]:', bcErr);
    }

    // 3. Refetch via CustomEvent di window yang sama
    const handleLocalEvent = () => {
      fetchTrainings(true);
    };
    window.addEventListener('training-types-changed', handleLocalEvent);

    // 4. Polling berkala setiap 60 detik sebagai jaring pengaman (fallback)
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchTrainings(true);
      }
    }, 60000);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('training-types-changed', handleLocalEvent);
      clearInterval(pollInterval);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [fetchTrainings, autoRefetch, trainings.length]);

  // Map pencarian cepat nama training berdasarkan ID
  const trainingsMap = useMemo(() => {
    const map = new Map();
    trainings.forEach((t) => {
      if (t.id) map.set(t.id, t.name);
      if (t.name) map.set(t.name.toUpperCase(), t.name);
    });
    return map;
  }, [trainings]);

  const getTrainingNameById = useCallback(
    (id, fallbackName = '-') => {
      if (!id) return fallbackName;
      return trainingsMap.get(id) || fallbackName;
    },
    [trainingsMap]
  );

  const getTrainingById = useCallback(
    (id) => {
      if (!id) return null;
      return trainings.find((t) => t.id === id) || null;
    },
    [trainings]
  );

  return {
    trainings,
    loading,
    error,
    refetch: () => fetchTrainings(false),
    getTrainingNameById,
    getTrainingById,
  };
}
