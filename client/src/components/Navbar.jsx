import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  FileSpreadsheet,
  Package,
  HardDrive,
  Check,
  CreditCard,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from './Toast';

export default function Navbar({ activeTab, setActiveTab, onQuickPayment }) {
  const { addToast } = useToast();
  const [backupLoading, setBackupLoading] = useState(false);

  // Keyboard shortcut listener (F1-F5)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('dashboard');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('billing');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('customers');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('reports');
      } else if (e.key === 'F5') {
        e.preventDefault();
        setActiveTab('inventory');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await api.triggerBackup();
      if (res.success) {
        addToast(res.message || 'Database backup saved successfully!', 'success');
      } else {
        addToast(res.error || 'Backup failed', 'error');
      }
    } catch (err) {
      addToast('Backup failed: ' + err.message, 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'F1' },
    { id: 'billing', label: 'New Sale / Billing', icon: ShoppingCart, shortcut: 'F2', highlight: true },
    { id: 'customers', label: 'Customers', icon: Users, shortcut: 'F3' },
    { id: 'reports', label: 'Dues Ledger', icon: FileSpreadsheet, shortcut: 'F4' },
    { id: 'inventory', label: 'Inventory', icon: Package, shortcut: 'F5' },
  ];

  return (
    <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-xs select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Shop Title */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-700 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-teal-700/20">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                <path d="m8.5 8.5 7 7"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900 font-sans">MedTrack</span>
                <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200/60">POS v1.0</span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[200px] sm:max-w-none">
                Medical & General Store
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? item.highlight
                        ? 'bg-teal-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-900 shadow-xs'
                      : item.highlight
                      ? 'text-teal-700 hover:bg-teal-50/80 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive && item.highlight ? 'text-white' : item.highlight ? 'text-teal-700' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${isActive ? (item.highlight ? 'bg-teal-800 text-teal-100' : 'bg-slate-200 text-slate-600') : 'bg-slate-100 text-slate-400'}`}>
                    {item.shortcut}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right actions: Collect Due, Backup, DB Status */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onQuickPayment}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors shadow-xs"
              title="Quick Collect Due"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Collect Due</span>
            </button>

            <button
              onClick={handleBackup}
              disabled={backupLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-xs"
              title="Create immediate database backup"
            >
              <HardDrive className={`w-3.5 h-3.5 ${backupLoading ? 'animate-spin text-teal-600' : 'text-slate-500'}`} />
              <span className="hidden lg:inline">{backupLoading ? 'Backing up...' : 'Backup'}</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/60 rounded-lg text-emerald-800 text-[11px] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Offline Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="flex md:hidden border-t border-slate-200/80 px-2 py-1.5 overflow-x-auto gap-1 bg-slate-50/50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                isActive ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
