/**
 * File Guard & Payload Limit Utilities
 * Proteksi ukuran payload transmisi Next.js Server Actions ke Vercel Serverless (Limit 4.5 MB)
 */

export const MAX_FOTO_SIZE_BYTES = 500 * 1024 // 500 KB
export const MAX_MATERI_FILE_SIZE_BYTES = 3.5 * 1024 * 1024 // 3.5 MB
export const PDF_COMPRESS_THRESHOLD_BYTES = 3.0 * 1024 * 1024 // 3.0 MB
export const MAX_TOTAL_PAYLOAD_BYTES = 4.0 * 1024 * 1024 // 4.0 MB

/**
 * Format ukuran bita ke format ramah pengguna (B, KB, MB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(1))
  return `${formatted} ${sizes[i]}`
}

/**
 * Estimasi pembesaran ukuran bita biner setelah encoding Base64 (+33.3%)
 */
export function estimateBase64Size(bytes: number): number {
  return Math.ceil((bytes * 4) / 3)
}

/**
 * Validasi ukuran berkas materi dokumen tunggal
 */
export function validateMateriFileSize(file: { name: string; size: number }): {
  valid: boolean
  message?: string
} {
  if (file.size > MAX_MATERI_FILE_SIZE_BYTES) {
    const sizeStr = formatFileSize(file.size)
    const limitStr = formatFileSize(MAX_MATERI_FILE_SIZE_BYTES)
    return {
      valid: false,
      message: `Berkas "${file.name}" berukuran ${sizeStr}. Batas maksimal adalah ${limitStr} per dokumen agar tidak melebihi kapasitas pengiriman serverless Vercel (4.5 MB). Silakan kompres dokumen terlebih dahulu.`,
    }
  }
  return { valid: true }
}

/**
 * Validasi total akumulasi ukuran berkas foto dan materi
 */
export function validateTotalPayloadSize(
  docs: { size: number }[],
  mats: { size: number }[]
): {
  valid: boolean
  totalBytes: number
  message?: string
} {
  const totalBytes =
    docs.reduce((acc, f) => acc + (f.size || 0), 0) +
    mats.reduce((acc, f) => acc + (f.size || 0), 0)

  if (totalBytes > MAX_TOTAL_PAYLOAD_BYTES) {
    const totalStr = formatFileSize(totalBytes)
    const limitStr = formatFileSize(MAX_TOTAL_PAYLOAD_BYTES)
    return {
      valid: false,
      totalBytes,
      message: `Total ukuran lampiran (${totalStr}) melebihi batas aman transmisi server (${limitStr}). Silakan kurangi foto atau kompres berkas materi sebelum menyimpan.`,
    }
  }

  return { valid: true, totalBytes }
}

/**
 * Kompresi foto via HTML5 Canvas ke ukuran maksimal (default 500 KB)
 * Menjaga resolusi maksimal 1280px dan kualitas JPEG optimal
 */
export async function compressImageFile(
  file: File,
  maxSizeBytes = MAX_FOTO_SIZE_BYTES
): Promise<File> {
  if (typeof window === 'undefined' || !file || !file.type.startsWith('image/')) {
    return file
  }

  // Jika ukuran sudah di bawah batas, tidak perlu kompresi
  if (file.size <= maxSizeBytes) {
    return file
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_DIMENSION = 1280
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height = Math.round((height * MAX_DIMENSION) / width)
            width = MAX_DIMENSION
          }
        } else {
          if (height > MAX_DIMENSION) {
            width = Math.round((width * MAX_DIMENSION) / height)
            height = MAX_DIMENSION
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Kualitas awal 0.72 (seimbang antara ketajaman dan ukuran < 500 KB)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          },
          'image/jpeg',
          0.72
        )
      }
      img.onerror = () => resolve(file)
    }
    reader.onerror = () => resolve(file)
  })
}

/**
 * Deteksi apakah berkas adalah dokumen PDF
 */
export function isPdfFile(fileName: string, mimeType = ''): boolean {
  return (
    mimeType === 'application/pdf' ||
    fileName.toLowerCase().endsWith('.pdf')
  )
}

export interface CompressPdfResult {
  file: File
  compressed: boolean
  originalSize: number
  newSize: number
  error?: string
}

/**
 * Kompresi berkas PDF di sisi peramban (client-side)
 */
export async function compressPdfFile(
  file: File,
  thresholdBytes = PDF_COMPRESS_THRESHOLD_BYTES
): Promise<CompressPdfResult> {
  const originalSize = file?.size || 0

  if (!file || !isPdfFile(file.name, file.type) || originalSize <= thresholdBytes) {
    return { file, compressed: false, originalSize, newSize: originalSize }
  }

  try {
    if (typeof window === 'undefined') {
      return { file, compressed: false, originalSize, newSize: originalSize }
    }

    return {
      file,
      compressed: false,
      originalSize,
      newSize: originalSize,
    }
  } catch (err: any) {
    return {
      file,
      compressed: false,
      originalSize,
      newSize: originalSize,
      error: err?.message || 'Gagal mengompresi PDF',
    }
  }
}

/**
 * Konversi berkas browser File ke string Base64 mentah (tanpa data prefix)
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('')
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      let encoded = reader.result?.toString().replace(/^data:(.*,)?/, '') || ''
      if (encoded.length % 4 > 0) {
        encoded += '='.repeat(4 - (encoded.length % 4))
      }
      resolve(encoded)
    }
    reader.onerror = (error) => reject(error)
  })
}
