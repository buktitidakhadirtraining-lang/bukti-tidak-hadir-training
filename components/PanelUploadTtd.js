// components/PanelUploadTtd.js
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Info,
  ImageIcon,
  Crop,
  Sliders,
  RotateCcw,
  Scissors,
  Check,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Helper: Memproses file paket tanda tangan di canvas sisi klien
 */
async function processPackageSignatureFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file melebihi batas maksimal 5 MB.');
  }

  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = rawDataUrl;
  });

  let { width, height } = img;
  const maxW = 2400;
  if (width > maxW) {
    height = Math.round((height * maxW) / width);
    width = maxW;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const processedDataUrl = canvas.toDataURL('image/png', 1.0);
  const base64 = processedDataUrl.split(',')[1];

  return {
    dataUrl: processedDataUrl,
    base64,
    mimeType: 'image/png',
    width,
    height,
    originalWidth: img.width,
    originalHeight: img.height,
    fileSizeKb: Math.round(file.size / 1024),
  };
}

/**
 * Modal Alat Potong (Crop) Gambar Interaktif
 */
function CropModal({
  isOpen,
  imageSrc,
  isExistingRecord = false,
  onClose,
  onApply,
  formatLabel = 'Soft Skill',
}) {
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true);
  const [cropBox, setCropBox] = useState({ x: 5, y: 10, width: 90, height: 80 }); // in percentages (0-100)
  const [isProcessing, setIsProcessing] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [previewDataUrl, setPreviewDataUrl] = useState('');

  const containerRef = useRef(null);
  const dragRef = useRef({
    isDragging: false,
    dragType: null, // 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'w' | 'e'
    startX: 0,
    startY: 0,
    startBox: null,
  });

  // Load natural image size
  useEffect(() => {
    if (!imageSrc || !isOpen) return;
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      // Reset crop box ke perkiraan default yang rapi (90% width, 80% height)
      setCropBox({ x: 5, y: 10, width: 90, height: 80 });
    };
    img.src = imageSrc;
  }, [imageSrc, isOpen]);

  // Update live preview of cropped region
  const updateCropPreview = useCallback(() => {
    if (!imageSrc || !naturalSize.width || !naturalSize.height) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;

      const pxX = Math.round((cropBox.x / 100) * natW);
      const pxY = Math.round((cropBox.y / 100) * natH);
      const pxW = Math.max(10, Math.round((cropBox.width / 100) * natW));
      const pxH = Math.max(10, Math.round((cropBox.height / 100) * natH));

      const canvas = document.createElement('canvas');
      canvas.width = pxW;
      canvas.height = pxH;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, pxX, pxY, pxW, pxH, 0, 0, pxW, pxH);

      if (removeWhiteBg) {
        try {
          const imgData = ctx.getImageData(0, 0, pxW, pxH);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Deteksi piksel putih / abu-abu terang
            if (r > 210 && g > 210 && b > 210) {
              const brightness = (r + g + b) / 3;
              if (brightness > 238) {
                data[i + 3] = 0; // Transparan penuh
              } else {
                const alpha = (238 - brightness) / 28;
                data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, alpha)));
              }
            }
          }
          ctx.putImageData(imgData, 0, 0);
        } catch (e) {
          console.warn('[Crop preview removeWhiteBg error]:', e);
        }
      }

      setPreviewDataUrl(canvas.toDataURL('image/png', 0.9));
    };
    img.src = imageSrc;
  }, [imageSrc, naturalSize, cropBox, removeWhiteBg]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(updateCropPreview, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, cropBox, removeWhiteBg, updateCropPreview]);

  // Drag & Resize Handlers
  const handlePointerDown = (e, dragType) => {
    e.preventDefault();
    e.stopPropagation();

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;

    dragRef.current = {
      isDragging: true,
      dragType,
      startX: clientX,
      startY: clientY,
      startBox: { ...cropBox },
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.isDragging || !containerRef.current) return;
    e.preventDefault();

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;

    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const deltaX = ((clientX - dragRef.current.startX) / rect.width) * 100;
    const deltaY = ((clientY - dragRef.current.startY) / rect.height) * 100;
    const { dragType, startBox } = dragRef.current;

    let newBox = { ...startBox };

    if (dragType === 'move') {
      newBox.x = Math.max(0, Math.min(100 - startBox.width, startBox.x + deltaX));
      newBox.y = Math.max(0, Math.min(100 - startBox.height, startBox.y + deltaY));
    } else {
      // Resize handles
      if (dragType.includes('w')) {
        const maxX = startBox.x + startBox.width - 5;
        const proposedX = Math.max(0, Math.min(maxX, startBox.x + deltaX));
        newBox.width = startBox.width + (startBox.x - proposedX);
        newBox.x = proposedX;
      }
      if (dragType.includes('e')) {
        const maxWidth = 100 - startBox.x;
        newBox.width = Math.max(5, Math.min(maxWidth, startBox.width + deltaX));
      }
      if (dragType.includes('n')) {
        const maxY = startBox.y + startBox.height - 5;
        const proposedY = Math.max(0, Math.min(maxY, startBox.y + deltaY));
        newBox.height = startBox.height + (startBox.y - proposedY);
        newBox.y = proposedY;
      }
      if (dragType.includes('s')) {
        const maxHeight = 100 - startBox.y;
        newBox.height = Math.max(5, Math.min(maxHeight, startBox.height + deltaY));
      }
    }

    setCropBox(newBox);
  };

  const handlePointerUp = () => {
    dragRef.current.isDragging = false;
    window.removeEventListener('mousemove', handlePointerMove);
    window.removeEventListener('mouseup', handlePointerUp);
    window.removeEventListener('touchmove', handlePointerMove);
    window.removeEventListener('touchend', handlePointerUp);
  };

  const handleReset = () => {
    setCropBox({ x: 0, y: 0, width: 100, height: 100 });
  };

  const handleApplyCrop = async () => {
    if (!imageSrc || !naturalSize.width || !naturalSize.height) return;

    setIsProcessing(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageSrc;
      });

      const natW = img.naturalWidth;
      const natH = img.naturalHeight;

      const pxX = Math.round((cropBox.x / 100) * natW);
      const pxY = Math.round((cropBox.y / 100) * natH);
      const pxW = Math.max(10, Math.round((cropBox.width / 100) * natW));
      const pxH = Math.max(10, Math.round((cropBox.height / 100) * natH));

      const canvas = document.createElement('canvas');
      canvas.width = pxW;
      canvas.height = pxH;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, pxX, pxY, pxW, pxH, 0, 0, pxW, pxH);

      if (removeWhiteBg) {
        const imgData = ctx.getImageData(0, 0, pxW, pxH);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 210 && g > 210 && b > 210) {
            const brightness = (r + g + b) / 3;
            if (brightness > 238) {
              data[i + 3] = 0;
            } else {
              const alpha = (238 - brightness) / 28;
              data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, alpha)));
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      const croppedDataUrl = canvas.toDataURL('image/png', 1.0);
      const base64 = croppedDataUrl.split(',')[1];

      const cropResult = {
        dataUrl: croppedDataUrl,
        base64,
        mimeType: 'image/png',
        width: pxW,
        height: pxH,
        isExistingRecord,
      };

      await onApply(cropResult);
      onClose();
    } catch (err) {
      console.error('[handleApplyCrop error]:', err);
      toast.error('Gagal memotong gambar: ' + (err.message || 'Kesalahan sistem'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-gray-200 flex flex-col max-h-[94vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0056b3] flex items-center justify-center">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900 font-title">
                Potong Gambar Paket Tanda Tangan ({formatLabel})
              </h3>
              <p className="text-xs text-gray-500">
                Pilih hanya bagian 3 goresan tanda tangan agar tidak menduplikasi teks jabatan dan nama.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Petunjuk & Opsi Transparansi */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/70 p-3 rounded-xl border border-blue-100 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-blue-900">
            <Info className="w-4 h-4 text-[#0056b3] shrink-0" />
            <span>
              Tarik garis sudut/tepi kotak untuk memotong <strong>tanda tangan saja</strong> (tanpa baris judul, nama, atau tabel).
            </span>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-2xs shrink-0 select-none font-semibold text-gray-800 hover:bg-blue-50/40 transition-colors">
            <input
              type="checkbox"
              checked={removeWhiteBg}
              onChange={(e) => setRemoveWhiteBg(e.target.checked)}
              className="w-4 h-4 rounded text-[#0056b3] focus:ring-[#0056b3]"
            />
            <span>Hapus latar putih (transparan)</span>
          </label>
        </div>

        {/* Main Crop Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-[280px] max-h-[55vh] overflow-hidden">
          {/* Kolom Kiri: Area Gambar & Kotak Potong Interaktif */}
          <div
            className="lg:col-span-2 rounded-xl border border-gray-200 bg-gray-900/95 flex items-center justify-center relative overflow-hidden select-none p-2"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #1f2937 25%, transparent 25%), linear-gradient(-45deg, #1f2937 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f2937 75%), linear-gradient(-45deg, transparent 75%, #1f2937 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            }}
          >
            <div
              ref={containerRef}
              className="relative inline-block max-w-full max-h-full"
              style={{ touchAction: 'none' }}
            >
              {/* Gambar Dasar */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt="Gambar untuk dipotong"
                className="max-h-[48vh] max-w-full object-contain mx-auto block pointer-events-none select-none"
                draggable={false}
              />

              {/* Overlay Gelap di Luar Kotak Crop */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.55)`,
                  left: `${cropBox.x}%`,
                  top: `${cropBox.y}%`,
                  width: `${cropBox.width}%`,
                  height: `${cropBox.height}%`,
                }}
              />

              {/* Kotak Seleksi Interaktif */}
              <div
                className="absolute border-2 border-blue-400 bg-transparent cursor-move shadow-md"
                style={{
                  left: `${cropBox.x}%`,
                  top: `${cropBox.y}%`,
                  width: `${cropBox.width}%`,
                  height: `${cropBox.height}%`,
                  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.8), inset 0 0 0 1px rgba(255, 255, 255, 0.4)',
                }}
                onMouseDown={(e) => handlePointerDown(e, 'move')}
                onTouchStart={(e) => handlePointerDown(e, 'move')}
              >
                {/* Grid Rule of Thirds Tipis */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                  <div className="border-r border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-b border-white" />
                  <div className="border-r border-white" />
                  <div className="border-r border-white" />
                  <div />
                </div>

                {/* 8 Handles Resize */}
                {/* Top-Left */}
                <div
                  className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-nw-resize shadow-sm"
                  onMouseDown={(e) => handlePointerDown(e, 'nw')}
                  onTouchStart={(e) => handlePointerDown(e, 'nw')}
                />
                {/* Top-Middle */}
                <div
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-2.5 bg-blue-500 border-2 border-white rounded cursor-n-resize shadow-sm"
                  onMouseDown={(e) => handlePointerDown(e, 'n')}
                  onTouchStart={(e) => handlePointerDown(e, 'n')}
                />
                {/* Top-Right */}
                <div
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-ne-resize shadow-sm"
                  onMouseDown={(e) => handlePointerDown(e, 'ne')}
                  onTouchStart={(e) => handlePointerDown(e, 'ne')}
                />
                {/* Middle-Right */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-2.5 h-4 bg-blue-500 border-2 border-white rounded cursor-e-resize shadow-sm"
                  onMouseDown={(e) => handlePointerDown(e, 'e')}
                  onTouchStart={(e) => handlePointerDown(e, 'e')}
                />
                {/* Bottom-Right */}
                <div
                  className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-se-resize shadow-sm"
                  onMouseDown={(e) => handlePointerDown(e, 'se')}
                  onTouchStart={(e) => handlePointerDown(e, 'se')}
                />
                {/* Bottom-Middle */}
                <div
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2.5 bg-blue-500 border-2 border-white rounded cursor-s-resize shadow-sm"
                  onMouseDown={(e) => handlePointerDown(e, 's')}
                  onTouchStart={(e) => handlePointerDown(e, 's')}
                />
                {/* Bottom-Left */}
                <div
                  className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-sw-resize shadow-sm"
                  onMouseDown={(e) => handlePointerDown(e, 'sw')}
                  onTouchStart={(e) => handlePointerDown(e, 'sw')}
                />
                {/* Middle-Left */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2.5 h-4 bg-blue-500 border-2 border-white rounded cursor-w-resize shadow-sm"
                  onMouseDown={(e) => handlePointerDown(e, 'w')}
                  onTouchStart={(e) => handlePointerDown(e, 'w')}
                />
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Pratinjau Hasil Potong */}
          <div className="flex flex-col justify-between bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-3 overflow-y-auto">
            <div>
              <span className="font-bold text-gray-800 text-xs block mb-1">
                Pratinjau Hasil Potong:
              </span>
              <p className="text-[11px] text-gray-500 mb-2">
                Hasil yang akan ditampilkan di antara jabatan dan nama.
              </p>

              <div
                className="w-full min-h-[110px] max-h-[160px] rounded-lg border border-gray-300 bg-white flex items-center justify-center p-2 relative overflow-hidden"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
                  backgroundSize: '12px 12px',
                  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                }}
              >
                {previewDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewDataUrl}
                    alt="Preview Potong"
                    className="max-h-[140px] max-w-full object-contain mx-auto block shadow-2xs"
                  />
                ) : (
                  <span className="text-[11px] text-gray-400">Membuat pratinjau...</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-[11px] text-gray-600 bg-white p-2.5 rounded-lg border border-gray-200">
              <div className="flex justify-between">
                <span>Resolusi Asli:</span>
                <strong className="font-mono text-gray-900">{naturalSize.width} × {naturalSize.height} px</strong>
              </div>
              <div className="flex justify-between">
                <span>Ukuran Potong:</span>
                <strong className="font-mono text-blue-700">
                  {Math.round((cropBox.width / 100) * naturalSize.width)} ×{' '}
                  {Math.round((cropBox.height / 100) * naturalSize.height)} px
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Kotak Potong
            </button>
          </div>
        </div>

        {/* Modal Footer Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-xs font-bold transition-all disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleApplyCrop}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses & Menyimpan...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Terapkan Hasil Potong</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PanelUploadTtd({
  ttdRecords = [], // Array dari /api/ttd
  printFormat = 'rekap_dispensasi', // 'rekap_dispensasi' | 'soft_skill'
  modeGambar = 'hanya_ttd', // 'hanya_ttd' | 'lengkap'
  signerConfig = null,
  onSignerConfigChange = null,
  userRole = 'admin_cabang',
  branchName = '',
  branchId = '',
  isDriveReady = true,
  onTtdUpdated, // Callback ketika TTD berhasil diupload/dihapus
}) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    selectedFile: null,
    processedResult: null,
    isProcessing: false,
    isSaving: false,
  });

  const [cropModalState, setCropModalState] = useState({
    isOpen: false,
    imageSrc: '',
    isExistingRecord: false,
  });

  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef(null);

  const isSoftSkill = printFormat === 'soft_skill';
  const activePeran = isSoftSkill ? 'paket_ttd_softskill' : 'paket_ttd_rekap';

  // Ambil record paket sesuai format yang SEDANG DIPILIH saja
  const paketRecord = React.useMemo(() => {
    if (isSoftSkill) {
      return (ttdRecords || []).find((rec) => rec.peran === 'paket_ttd_softskill') || null;
    }
    return (
      (ttdRecords || []).find((rec) => rec.peran === 'paket_ttd_rekap') ||
      (ttdRecords || []).find((rec) => rec.peran === 'paket_ttd') ||
      null
    );
  }, [ttdRecords, isSoftSkill]);

  const hasPaketTtd = Boolean(paketRecord?.drive_file_id);
  const isAdmin = userRole === 'admin_cabang' || userRole === 'admin_pusat';

  // Cek apakah gambar tampak masih berisi teks jabatan & nama (rasio tinggi vs lebar relatif tinggi)
  const [imageAspectRatio, setImageAspectRatio] = useState(0);
  useEffect(() => {
    if (hasPaketTtd && paketRecord?.dataUrl) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0) {
          setImageAspectRatio(img.naturalHeight / img.naturalWidth);
        }
      };
      img.src = paketRecord.dataUrl;
    } else {
      setImageAspectRatio(0);
    }
  }, [hasPaketTtd, paketRecord?.dataUrl]);

  // Gambar tampak masih memiliki baris nama/jabatan jika rasio > 0.23 pada mode hanya_ttd
  const showsDuplicateTextWarning =
    isSoftSkill &&
    modeGambar === 'hanya_ttd' &&
    hasPaketTtd &&
    imageAspectRatio > 0.23;

  function triggerFileInput() {
    if (!isAdmin) {
      toast.error('Hanya Admin Cabang yang memiliki hak akses untuk mengupload tanda tangan.');
      return;
    }

    if (!isDriveReady) {
      toast.error('Google Drive cabang belum terhubung, hubungi Admin Pusat');
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Format file harus berupa gambar PNG, JPG, JPEG, atau WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5 MB. Silakan pilih file yang lebih kecil.');
      return;
    }

    setModalState({
      isOpen: true,
      selectedFile: file,
      processedResult: null,
      isProcessing: true,
      isSaving: false,
    });

    try {
      const result = await processPackageSignatureFile(file);
      setModalState((prev) => ({
        ...prev,
        processedResult: result,
        isProcessing: false,
      }));
    } catch (err) {
      toast.error('Gagal memproses gambar: ' + err.message);
      setModalState((prev) => ({ ...prev, isOpen: false, isProcessing: false }));
    }
  }

  async function handleSavePackageSignature() {
    if (!modalState.processedResult) return;

    setModalState((prev) => ({ ...prev, isSaving: true }));
    const formatLabel = isSoftSkill ? 'Soft Skill' : 'Rekap';
    const toastId = toast.loading(`Mengunggah gambar paket TTD ${formatLabel} ke Google Drive cabang...`);

    try {
      const res = await fetch('/api/ttd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peran: activePeran,
          base64: modalState.processedResult.base64,
          mimeType: modalState.processedResult.mimeType,
          branch_id: branchId || undefined,
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || `Gagal menyimpan gambar paket tanda tangan ${formatLabel}`);
      }

      toast.success(`Gambar paket tanda tangan ${formatLabel} berhasil disimpan ke Google Drive cabang!`, {
        id: toastId,
      });

      setModalState({
        isOpen: false,
        selectedFile: null,
        processedResult: null,
        isProcessing: false,
        isSaving: false,
      });

      if (onTtdUpdated) onTtdUpdated(json.data, json.dataUrl);
    } catch (err) {
      console.error('[Upload Paket TTD Error]:', err);
      toast.error(err.message || 'Gagal menyimpan gambar paket tanda tangan', { id: toastId });
      setModalState((prev) => ({ ...prev, isSaving: false }));
    }
  }

  async function handleDeletePackageSignature() {
    if (!isAdmin) {
      toast.error('Hanya Admin Cabang yang dapat menghapus tanda tangan.');
      return;
    }

    const formatLabel = isSoftSkill ? 'Berita Acara Soft Skill' : 'Berita Acara Rekap';
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus gambar paket tanda tangan ${formatLabel} ini? File di Google Drive cabang akan dipindahkan ke Sampah.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    const toastId = toast.loading(`Menghapus gambar paket TTD ${formatLabel}...`);

    try {
      const targetPeran = paketRecord?.peran || activePeran;
      const params = new URLSearchParams();
      params.set('peran', targetPeran);
      if (branchId) params.set('branch_id', branchId);

      const res = await fetch(`/api/ttd?${params.toString()}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || 'Gagal menghapus gambar paket tanda tangan');
      }

      toast.success(`Gambar paket tanda tangan ${formatLabel} berhasil dihapus dari Google Drive!`, { id: toastId });
      if (onTtdUpdated) onTtdUpdated(null, null, targetPeran);
    } catch (err) {
      console.error('[Delete Paket TTD Error]:', err);
      toast.error(err.message || 'Gagal menghapus gambar paket tanda tangan', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  }

  // Buka Crop Dialog untuk Gambar yang Sudah Ada di Drive
  const handleOpenCropExisting = () => {
    if (!paketRecord?.dataUrl) return;
    setCropModalState({
      isOpen: true,
      imageSrc: paketRecord.dataUrl,
      isExistingRecord: true,
    });
  };

  // Buka Crop Dialog untuk Gambar Baru yang Baru Dipilih
  const handleOpenCropFresh = () => {
    if (!modalState.processedResult?.dataUrl) return;
    setCropModalState({
      isOpen: true,
      imageSrc: modalState.processedResult.dataUrl,
      isExistingRecord: false,
    });
  };

  // Callback saat hasil Crop diterapkan
  const handleApplyCropResult = async (cropResult) => {
    if (cropResult.isExistingRecord) {
      // Simpan langsung ke server menggantikan file lama
      const formatLabel = isSoftSkill ? 'Soft Skill' : 'Rekap';
      const toastId = toast.loading(`Menyimpan hasil potong TTD ${formatLabel} ke Google Drive cabang...`);

      const res = await fetch('/api/ttd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peran: activePeran,
          base64: cropResult.base64,
          mimeType: cropResult.mimeType,
          branch_id: branchId || undefined,
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || `Gagal menyimpan hasil potong ${formatLabel}`);
      }

      toast.success(`Hasil potong TTD ${formatLabel} berhasil diperbarui di Google Drive cabang!`, {
        id: toastId,
      });

      if (onTtdUpdated) onTtdUpdated(json.data, json.dataUrl);
    } else {
      // Perbarui pratinjau pada modal upload sebelum disimpan
      setModalState((prev) => ({
        ...prev,
        processedResult: {
          ...prev.processedResult,
          dataUrl: cropResult.dataUrl,
          base64: cropResult.base64,
          width: cropResult.width,
          height: cropResult.height,
        },
      }));
      toast.success('Hasil potong diterapkan pada pratinjau.');
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-soft space-y-4">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-[#0056b3]">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-900 font-title">
                {isSoftSkill
                  ? 'Upload Gambar Paket TTD - Berita Acara Soft Skill'
                  : 'Upload Gambar Paket TTD - Berita Acara Rekap'}
              </h2>
              {hasPaketTtd ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Tersimpan di Google Drive
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Belum ada gambar
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {isSoftSkill ? (
                modeGambar === 'hanya_ttd' ? (
                  <>
                    Disimpan ke Google Drive cabang {branchName ? `(${branchName})` : ''} &amp; otomatis tampil di antara baris jabatan dan nama versi &quot;Sudah Ada TTD (Gbr 7)&quot;.
                  </>
                ) : (
                  <>
                    Disimpan ke Google Drive cabang {branchName ? `(${branchName})` : ''} &amp; menggantikan seluruh blok tanda tangan pada versi &quot;Sudah Ada TTD (Gbr 7)&quot;.
                  </>
                )
              ) : (
                <>
                  Disimpan ke Google Drive cabang {branchName ? `(${branchName})` : ''} &amp; menggantikan seluruh blok tanda tangan pada versi &quot;Ada TTD (Gbr 3)&quot;.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Warning Google Drive jika belum terhubung */}
        {!isDriveReady && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Google Drive cabang belum terhubung, hubungi Admin Pusat</span>
          </div>
        )}
      </div>

      {/* Petunjuk Penggunaan */}
      <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 flex items-start gap-2.5 text-xs text-blue-950">
        <Info className="w-4 h-4 text-[#0056b3] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-900">
            {isSoftSkill
              ? modeGambar === 'hanya_ttd'
                ? 'Upload satu gambar berisi 3 tanda tangan berjajar horizontal, tanpa judul, nama, atau jabatan.'
                : 'Upload satu gambar berisi seluruh tabel tanda tangan (Mengetahui 2, Mengetahui 1, Membuat, dan 3 TTD).'
              : 'Upload satu gambar berisi seluruh tabel tanda tangan (Mengetahui, Dibuat oleh, 4 TTD, dan nama jabatan).'}
          </p>
          <p className="text-blue-800/80 leading-relaxed text-[11px]">
            {isSoftSkill ? (
              modeGambar === 'hanya_ttd' ? (
                <>
                  Gambar hanya berisi 3 goresan tanda tangan berjajar. Teks nama dan jabatan akan ditulis otomatis oleh aplikasi sesuai pengaturan. Gunakan tombol <strong>&quot;Potong Gambar&quot;</strong> jika gambar Anda masih memuat nama atau jabatan. Disarankan format <strong>PNG transparan</strong> (maksimal 5 MB).
                </>
              ) : (
                <>
                  Sesuai blok tanda tangan pada <strong>Gambar 7</strong> (Mengetahui 2 Deputy Branch Manager ADM, Mengetahui 1 Human Resource Manager, Membuat Training Center Supervisor). Disarankan format <strong>PNG</strong> (maksimal 5 MB).
                </>
              )
            ) : (
              <>
                Sesuai blok tanda tangan pada <strong>Gambar 3</strong> (DBM Operasional, DBM Admin, HRD Manager, TC Supervisor). Potong gambar tepat di tepi garis tabel. Disarankan format <strong>PNG</strong> dengan lebar minimal <strong>1200 px</strong> (maksimal 5 MB).
              </>
            )}
          </p>
        </div>
      </div>

      {/* Peringatan Cerdas: Jika gambar masih berisi nama & jabatan pada mode hanya_ttd */}
      {showsDuplicateTextWarning && (
        <div className="flex items-start gap-2.5 text-xs bg-amber-50 text-amber-900 p-3 rounded-xl border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-950">Peringatan Format Gambar:</p>
            <p className="text-amber-900/90 leading-relaxed">
              Gambar ini tampaknya masih berisi tulisan jabatan dan nama. Gunakan tombol{' '}
              <button
                type="button"
                onClick={handleOpenCropExisting}
                className="inline-flex items-center font-bold text-[#0056b3] underline hover:text-blue-800"
              >
                Potong Gambar
              </button>{' '}
              untuk memotong bagian 3 tanda tangan saja, atau ganti mode tanda tangan ke &quot;Gambar sudah lengkap&quot;.
            </p>
          </div>
        </div>
      )}

      {/* Peringatan jika belum ada gambar paket untuk format ini */}
      {!hasPaketTtd && (
        <div className="flex items-center gap-2 text-xs bg-amber-50/70 text-amber-800 p-2.5 rounded-xl border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-medium">
            Gambar paket TTD untuk format ini belum diupload.
          </span>
        </div>
      )}

      {/* Area Preview Gambar Paket & Tombol Aksi */}
      <div className="border rounded-2xl p-4 bg-gray-50/40 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-bold text-xs text-gray-800">
            Pratinjau Blok Tanda Tangan ({isSoftSkill ? 'Soft Skill' : 'Rekap'}):
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {!hasPaketTtd ? (
              <button
                type="button"
                onClick={triggerFileInput}
                disabled={!isAdmin || !isDriveReady}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Paket TTD</span>
              </button>
            ) : (
              <>
                {/* Tombol Potong Gambar */}
                <button
                  type="button"
                  onClick={handleOpenCropExisting}
                  disabled={!isAdmin || isDeleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0056b3] text-xs font-bold border border-blue-200 transition-all disabled:opacity-50"
                  title="Potong hanya goresan tanda tangan & hapus latar putih"
                >
                  <Crop className="w-3.5 h-3.5" />
                  <span>Potong Gambar</span>
                </button>

                <button
                  type="button"
                  onClick={triggerFileInput}
                  disabled={!isAdmin || isDeleting}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Ganti Gambar</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeletePackageSignature}
                  disabled={!isAdmin || isDeleting}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all disabled:opacity-50"
                  title="Hapus gambar paket tanda tangan ini dari Google Drive"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Hapus</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Kotak Tampilan Pratinjau Paket TTD */}
        <div
          className="w-full min-h-[140px] max-h-[300px] rounded-xl border border-gray-200 bg-white flex items-center justify-center p-3 overflow-hidden relative"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
            backgroundSize: '14px 14px',
            backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0px',
          }}
        >
          {hasPaketTtd && paketRecord?.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={paketRecord.dataUrl}
              alt={`Paket Tanda Tangan ${isSoftSkill ? 'Soft Skill' : 'Rekap'}`}
              className="max-h-[280px] max-w-full object-contain mx-auto shadow-xs border border-gray-100 rounded"
            />
          ) : hasPaketTtd ? (
            <div className="text-center p-4 text-emerald-700">
              <FileCheck2 className="w-8 h-8 mx-auto mb-1.5 text-emerald-600" />
              <span className="text-xs font-bold block">Tersimpan di Google Drive</span>
              <span className="text-[10px] text-gray-500 truncate block max-w-xs mx-auto">
                {paketRecord?.file_name || (isSoftSkill ? 'TTD_PAKET_SOFTSKILL.png' : 'TTD_PAKET_REKAP.png')}
              </span>
            </div>
          ) : (
            <div className="text-center p-6 text-gray-400 space-y-1.5">
              <ImageIcon className="w-8 h-8 mx-auto text-gray-300" />
              <p className="text-xs font-medium text-gray-500">
                Belum ada gambar paket tanda tangan yang diupload untuk format {isSoftSkill ? 'Soft Skill' : 'Rekap'}
              </p>
              <p className="text-[11px] text-gray-400">
                Klik tombol &quot;Upload Paket TTD&quot; di atas untuk memilih berkas gambar.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Preview Sebelum Simpan */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-gray-200 flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-gray-900 font-title">
                  Pratinjau Gambar Paket Tanda Tangan - {isSoftSkill ? 'Berita Acara Soft Skill' : 'Berita Acara Rekap'}
                </h3>
                <p className="text-xs text-gray-500">
                  Periksa gambar tanda tangan sebelum disimpan ke Google Drive cabang
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informasi Berkas & Tombol Potong Sebelum Simpan */}
            {modalState.processedResult && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] bg-gray-50 p-2.5 rounded-xl border border-gray-200 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">
                    Dimensi:{' '}
                    <strong className="text-gray-900 font-mono">
                      {modalState.processedResult.width} × {modalState.processedResult.height} px
                    </strong>
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-600">
                    Ukuran:{' '}
                    <strong className="text-gray-900 font-mono">
                      {modalState.processedResult.fileSizeKb} KB
                    </strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleOpenCropFresh}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-[#0056b3] border border-blue-200 rounded-lg font-bold transition-colors"
                >
                  <Crop className="w-3.5 h-3.5" />
                  <span>Potong Gambar Ini</span>
                </button>
              </div>
            )}

            {/* Area Tampilan Pratinjau */}
            <div
              className="flex-1 w-full min-h-[220px] rounded-xl border border-gray-200 bg-white flex items-center justify-center p-3 relative overflow-auto"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
                backgroundSize: '14px 14px',
                backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0px',
              }}
            >
              {modalState.isProcessing ? (
                <div className="flex flex-col items-center gap-2 text-gray-500 py-10">
                  <Loader2 className="w-7 h-7 animate-spin text-[#0056b3]" />
                  <span className="text-xs font-semibold">Memuat gambar paket TTD...</span>
                </div>
              ) : modalState.processedResult?.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={modalState.processedResult.dataUrl}
                  alt="Pratinjau Ukuran Sebenarnya"
                  className="max-w-full h-auto object-contain mx-auto shadow-md border border-gray-200 rounded"
                />
              ) : null}
            </div>

            {/* Tombol Aksi Modal */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t shrink-0">
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                disabled={modalState.isSaving}
                className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-xs font-bold transition-all disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePackageSignature}
                disabled={modalState.isSaving || modalState.isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                {modalState.isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Drive...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Simpan ke Google Drive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alat Potong (Crop) Interaktif */}
      {cropModalState.isOpen && (
        <CropModal
          isOpen={cropModalState.isOpen}
          imageSrc={cropModalState.imageSrc}
          isExistingRecord={cropModalState.isExistingRecord}
          onClose={() => setCropModalState({ isOpen: false, imageSrc: '', isExistingRecord: false })}
          onApply={handleApplyCropResult}
          formatLabel={isSoftSkill ? 'Berita Acara Soft Skill' : 'Berita Acara Rekap'}
        />
      )}
    </div>
  );
}
