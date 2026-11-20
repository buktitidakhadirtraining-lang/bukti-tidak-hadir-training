// lib/training-utils.js
// Utilitas bersama (server & client) untuk normalisasi, pengurutan, dan resolusi nama Master Jenis Training

export function normalizeTrainingName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Pengurutan deterministik & konsisten di seluruh aplikasi (Master, API, Dropdown, Ekspor, Template):
 * 1. Item dengan sort_order angka positif (> 0) berada di urutan awal berdasarkan sort_order ASC.
 * 2. Item tanpa sort_order positif (0 / null / undefined) menyusul berdasarkan created_at ASC, lalu nama abjad ID.
 */
export function sortTrainings(items) {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const orderA = typeof a?.sort_order === 'number' && !Number.isNaN(a.sort_order) && a.sort_order > 0 ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b?.sort_order === 'number' && !Number.isNaN(b.sort_order) && b.sort_order > 0 ? b.sort_order : Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const timeA = a?.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
    const timeB = b?.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
      return timeA - timeB;
    }

    return String(a?.name || '').localeCompare(String(b?.name || ''), 'id', {
      sensitivity: 'base',
      numeric: true,
    });
  });
}

/**
 * Resolusi nama jenis training terbaru dari daftar Master berdasarkan ID terlebih dahulu,
 * lalu fallback ke pencocokan teks ternormalisasi (spasi & huruf besar/kecil), atau fallbackName jika tidak ditemukan.
 */
export function resolveTrainingName(trainings, trainingId, fallbackName = '-') {
  const list = Array.isArray(trainings) ? trainings : [];
  if (trainingId) {
    const byId = list.find((t) => String(t.id) === String(trainingId));
    if (byId?.name) return byId.name;
  }

  const normalizedFallback = normalizeTrainingName(fallbackName);
  if (normalizedFallback && normalizedFallback !== '-' && normalizedFallback !== 'TANPA JENIS TRAINING') {
    const byName = list.find((t) => normalizeTrainingName(t.name) === normalizedFallback);
    if (byName?.name) return byName.name;
  }

  return fallbackName || '-';
}
