// lib/useMasterTrainings.js
// Alias kompatibilitas yang meneruskan langsung ke hook terpusat lib/useJenisTraining.js
'use client';

export {
  useJenisTraining as useMasterTrainings,
  useJenisTraining,
  notifyTrainingTypesChanged,
  sortTrainings,
  normalizeTrainingName,
  resolveTrainingName,
} from './useJenisTraining.js';
