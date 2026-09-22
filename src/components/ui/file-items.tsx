'use client'

import { useMemo, useEffect } from 'react'
import { Eye, Trash2, FileText, FileSpreadsheet, File as FileIcon } from 'lucide-react'

export interface FileItemProps {
  file: File
  onRemove: () => void
  onPreview: (url: string) => void
  formatSize: (bytes: number) => string
}

export function PhotoThumbnail({
  file,
  onRemove,
  onPreview,
  formatSize,
}: FileItemProps) {
  const url = useMemo(() => {
    try {
      return URL.createObjectURL(file)
    } catch {
      return ''
    }
  }, [file])

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  return (
    <div className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={file.name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onPreview(url)}
          className="p-1.5 rounded-md bg-white/90 text-slate-800 hover:text-primary transition cursor-pointer"
          title="Lihat foto besar"
        >
          <Eye size={14} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-md bg-white/90 text-rose-600 hover:text-rose-700 transition cursor-pointer"
          title="Hapus foto ini"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <span className="absolute bottom-1 left-1 text-[10px] bg-slate-900/80 text-white px-1.5 py-0.5 rounded truncate max-w-[90%] font-medium">
        {formatSize(file.size)}
      </span>
    </div>
  )
}

export function MaterialItem({
  file,
  onRemove,
  onPreview,
  formatSize,
}: FileItemProps) {
  const isPdf = file.name.toLowerCase().endsWith('.pdf')
  const isExcel = /\.(xls|xlsx)$/i.test(file.name)
  const isWord = /\.(doc|docx)$/i.test(file.name)

  const url = useMemo(() => {
    if (!isPdf) return ''
    try {
      return URL.createObjectURL(file)
    } catch {
      return ''
    }
  }, [file, isPdf])

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  const handlePreview = () => {
    if (url) onPreview(url)
  }

  return (
    <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
      <div className="flex items-center gap-2 min-w-0 pr-1">
        {isPdf ? (
          <FileText size={16} className="text-rose-600 shrink-0" />
        ) : isExcel ? (
          <FileSpreadsheet size={16} className="text-emerald-600 shrink-0" />
        ) : isWord ? (
          <FileText size={16} className="text-sky-600 shrink-0" />
        ) : (
          <FileIcon size={16} className="text-slate-500 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 truncate text-xs sm:text-sm" title={file.name}>
            {file.name}
          </p>
          <span className="text-[11px] text-slate-500">{formatSize(file.size)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isPdf && (
          <button
            type="button"
            onClick={handlePreview}
            className="p-1.5 rounded-md text-slate-500 hover:text-primary hover:bg-slate-100 transition cursor-pointer"
            title="Lihat PDF"
          >
            <Eye size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-md text-slate-400 hover:text-destructive hover:bg-slate-100 transition cursor-pointer"
          title="Hapus berkas"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
