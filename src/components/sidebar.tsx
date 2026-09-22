'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileEdit,
  FileDown,
  ClipboardList,
  KeyRound,
  Building2,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/input', label: 'Input Penugasan', icon: FileEdit },
  { href: '/laporan', label: 'Daftar Laporan', icon: ClipboardList },
  { href: '/cetak', label: 'Download PDF', icon: FileDown },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(true)
  const [showMobile, setShowMobile] = useState(false)

  return (
    <>
      {/* Mobile Topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 flex border-b border-slate-800 text-white items-center px-4 justify-between z-40 no-print">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Building2 className="text-primary" /> SIMPELGAS
        </div>
        <button
          onClick={() => setShowMobile(!showMobile)}
          aria-label="Toggle Menu"
          className="p-2 hover:bg-white/10 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer active:scale-95 transition-all duration-150"
        >
          {showMobile ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {showMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden no-print"
          onClick={() => setShowMobile(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={`fixed lg:static top-0 left-0 h-full bg-slate-900 text-white flex flex-col transition-all duration-300 z-50 no-print
          ${showMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isOpen ? 'w-64' : 'w-20'}
        `}
      >
        <div className="flex items-center justify-between p-4 h-16 border-b border-slate-800">
          <div
            className={`flex items-center gap-3 font-bold text-xl tracking-wide ${
              !isOpen && 'lg:hidden'
            }`}
          >
            <Building2 className="text-primary flex-shrink-0" />
            <span className="whitespace-nowrap">SIMPELGAS</span>
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hidden lg:flex p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all duration-150 cursor-pointer active:scale-95"
            aria-label="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="flex-1 px-3 overflow-y-auto overflow-x-hidden">
          <nav className="flex-1 space-y-2 py-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMobile(false)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 ease-out cursor-pointer active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? 'bg-white/15 text-white font-bold shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={20} className={isActive ? 'text-primary' : 'text-slate-400'} />
                  <span className={`${!isOpen && 'lg:hidden'} transition-all`}>
                    {item.label}
                  </span>
                </Link>
              )
            })}

            {/* Pimpinan Button */}
            <div className="pt-6 mt-6 border-t border-slate-800">
              <Link
                href="/pimpinan"
                prefetch={false}
                onClick={() => setShowMobile(false)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 ease-out cursor-pointer active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-secondary shadow-md ${
                  pathname === '/pimpinan'
                    ? 'bg-secondary-hover text-secondary-foreground font-bold'
                    : 'bg-secondary hover:bg-secondary-hover text-secondary-foreground font-bold'
                }`}
                aria-current={pathname === '/pimpinan' ? 'page' : undefined}
              >
                <KeyRound size={20} />
                <span className={`${!isOpen && 'lg:hidden'} transition-all`}>
                  Menu Pimpinan
                </span>
              </Link>
            </div>
          </nav>
        </div>
      </aside>
    </>
  )
}
