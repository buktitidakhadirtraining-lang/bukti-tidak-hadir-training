// lib/photo-loader.js
// Layanan terpusat pemuatan & caching foto bukti ketidakhadiran
// Dilengkapi: antrean paralel maks 3, retry 2x, timeout 60s, penanganan HEIC/HEIF, dan tracking error transparan

class PhotoQueueManager {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    // Cache: recordId -> { status: 'loading'|'loaded'|'error', dataUrl, mimeType, error, isHeic, recordId }
    this.cache = new Map();
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(new Map(this.cache));
      } catch (e) {
        console.error('[PhotoQueueManager notify error]:', e);
      }
    }
  }

  get(recordId) {
    return this.cache.get(recordId);
  }

  getAll() {
    return this.cache;
  }

  clear() {
    this.cache.clear();
    this.queue = [];
    this.notify();
  }

  retryFailed() {
    const failedEntries = [];
    for (const [recordId, item] of this.cache.entries()) {
      if (item.status === 'error') {
        failedEntries.push(recordId);
      }
    }
    for (const id of failedEntries) {
      this.cache.delete(id);
      this.load(id);
    }
  }

  async load(recordId) {
    if (!recordId) return null;

    // Jika sudah ada di cache dan berhasil/loading, jangan duplikasi
    const existing = this.cache.get(recordId);
    if (existing && (existing.status === 'loaded' || existing.status === 'loading')) {
      return existing;
    }

    const state = {
      recordId,
      status: 'loading',
      dataUrl: null,
      error: null,
      isHeic: false,
    };
    this.cache.set(recordId, state);
    this.notify();

    return new Promise((resolve) => {
      this.queue.push({
        recordId,
        resolve: (res) => {
          this.cache.set(recordId, res);
          this.notify();
          resolve(res);
        },
      });
      this.processNext();
    });
  }

  async processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;

    try {
      const result = await this.fetchWithRetry(item.recordId, 2);
      item.resolve(result);
    } catch (err) {
      item.resolve({
        recordId: item.recordId,
        status: 'error',
        dataUrl: null,
        error: err.message || 'Gagal memuat foto',
        isHeic: false,
      });
    } finally {
      this.running--;
      this.processNext();
    }
  }

  async fetchWithRetry(recordId, maxRetries = 2) {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Jeda bertahap: 1.2s, lalu 2.5s
          await new Promise((r) => setTimeout(r, attempt * 1200));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 detik timeout

        const res = await fetch(`/api/records/${recordId}/file?json=true`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          let errData;
          try {
            errData = await res.json();
          } catch {
            errData = { error: `HTTP ${res.status}` };
          }

          let friendlyMsg = errData.error || `HTTP ${res.status}`;
          if (res.status === 404) friendlyMsg = '404 file tidak ditemukan di Drive';
          else if (res.status === 403) friendlyMsg = '403 file di luar folder / akses ditolak';
          else if (res.status === 504) friendlyMsg = 'Timeout (koneksi Drive lambat)';

          throw new Error(friendlyMsg);
        }

        const json = await res.json();
        if (!json.ok || !json.dataUrl) {
          throw new Error(json.error || 'Data foto kosong');
        }

        // Cek format HEIC / HEIF
        if (json.isHeic) {
          return {
            recordId,
            status: 'error',
            dataUrl: null,
            error: 'Format HEIC/HEIF tidak didukung browser, ganti dengan JPG/PNG',
            isHeic: true,
          };
        }

        // Verifikasi apakah browser benar-benar bisa mendecode gambar ini
        await this.verifyImageDecode(json.dataUrl);

        return {
          recordId,
          status: 'loaded',
          dataUrl: json.dataUrl,
          mimeType: json.mimeType,
          fileName: json.fileName,
          error: null,
          isHeic: false,
        };
      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError') {
          lastError = new Error('Timeout 60 detik saat mengambil foto dari Google Drive');
        }
      }
    }

    return {
      recordId,
      status: 'error',
      dataUrl: null,
      error: lastError?.message || 'Gagal memuat setelah 3 kali percobaan',
      isHeic: false,
    };
  }

  verifyImageDecode(dataUrl) {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        return resolve(true);
      }
      const img = new Image();
      img.onload = () => {
        if (typeof img.decode === 'function') {
          img
            .decode()
            .then(() => resolve(true))
            .catch(() => resolve(true)); // Fallback jika decode promise gagal tapi onload sukses
        } else {
          resolve(true);
        }
      };
      img.onerror = () => {
        reject(new Error('Format data gambar rusak atau tidak didukung browser'));
      };
      img.src = dataUrl;
    });
  }
}

// Global Singleton Instance
export const photoLoader = new PhotoQueueManager(3);
