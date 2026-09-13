import React, { useState } from 'react';
import { BookOpen, FileText, HardDrive, Search, ShieldCheck } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from './Toast';
import BackupModal from './BackupModal';

export default function Header({ currentView, setCurrentView, onBackToSearch, onLock }) {
  const { addToast } = useToast();
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs select-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Shop Title */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => {
              if (onBackToSearch) onBackToSearch();
              setCurrentView('home');
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20 group-hover:bg-indigo-700 transition-colors">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900 font-sans">Medical Shop</span>
                <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Khata Book
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Customer Dues & Purchase History</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onBackToSearch) onBackToSearch();
                setCurrentView('home');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                currentView === 'home' || currentView === 'profile'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Customer Ledger</span>
            </button>

            <button
              onClick={() => setCurrentView('dues')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                currentView === 'dues'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Dues Report</span>
            </button>
          </nav>

          {/* Right actions: Backup & Local status */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-2xs"
              title="Backup, restore, and export ledger data"
            >
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              <span>Backups & Safety</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/60 rounded-xl text-emerald-800 text-[11px] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Offline Ready</span>
            </div>

            {onLock && (
              <button
                type="button"
                onClick={onLock}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Lock terminal now"
              >
                <ShieldCheck className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Backup & Safety Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </header>
  );
}
