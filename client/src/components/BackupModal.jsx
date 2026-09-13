import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Download,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Database,
  RefreshCw,
  Clock,
  Calendar,
} from 'lucide-react';
import Modal from './Modal';
import { api } from '../utils/api';
import { useToast } from './Toast';
import { formatDate } from '../utils/formatting';

export default function BackupModal({ isOpen, onClose }) {
  const { addToast } = useToast();

  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const list = await api.getBackups();
      setBackups(list || []);
    } catch (err) {
      addToast('Failed to load backups list: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
      setSelectedBackupForRestore(null);
      setConfirmText('');
    }
  }, [isOpen]);

  const handleCreateBackup = async () => {
    try {
      setBackingUp(true);
      const res = await api.triggerBackup();
      if (res.success) {
        addToast(res.message || 'Immediate backup snapshot created!', 'success');
        fetchBackups();
      } else {
        addToast(res.error || 'Backup creation failed', 'error');
      }
    } catch (err) {
      addToast('Backup error: ' + err.message, 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackupForRestore) return;

    try {
      setRestoring(true);
      const res = await api.restoreBackup(selectedBackupForRestore.filename);
      if (res.success) {
        addToast(res.message || 'Database restored successfully! Reloading...', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        addToast(res.error || 'Restore failed', 'error');
      }
    } catch (err) {
      addToast('Restore error: ' + err.message, 'error');
    } finally {
      setRestoring(false);
      setSelectedBackupForRestore(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Data Safety & Backups"
      subtitle="Create snapshots, restore historical ledgers, or export offline copies"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 text-xs text-slate-700">
        {/* Top Action Bar: Create Backup + Exports */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <div>
            <span className="font-bold text-slate-900 block">Instant Backup & Export</span>
            <span className="text-[11px] text-slate-500">Safeguard your medical shop financial data</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={backingUp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <HardDrive className={`w-4 h-4 ${backingUp ? 'animate-spin' : ''}`} />
              <span>{backingUp ? 'Creating Snapshot...' : 'Backup Now'}</span>
            </button>

            <a
              href={api.getExportCsvUrl()}
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-semibold shadow-2xs transition-colors"
              title="Download full ledger as CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </a>

            <a
              href={api.getExportSqliteUrl()}
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-semibold shadow-2xs transition-colors"
              title="Download raw SQLite database file"
            >
              <Database className="w-4 h-4 text-indigo-600" />
              <span>Export .sqlite</span>
            </a>
          </div>
        </div>

        {/* Restore Confirmation Screen */}
        {selectedBackupForRestore ? (
          <div className="p-5 border-2 border-rose-200 bg-rose-50/50 rounded-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-rose-900">
                  Confirm Database Restore
                </h4>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  You are about to restore the database from snapshot:
                  <strong className="block font-mono mt-0.5 text-rose-950">
                    {selectedBackupForRestore.filename} ({selectedBackupForRestore.sizeKb} KB)
                  </strong>
                  This will replace your current active ledger with this backup. A safety backup of your current database will automatically be saved first.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-rose-200/60">
              <button
                type="button"
                disabled={restoring}
                onClick={() => setSelectedBackupForRestore(null)}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={handleConfirmRestore}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                <RotateCcw className={`w-4 h-4 ${restoring ? 'animate-spin' : ''}`} />
                <span>{restoring ? 'Restoring...' : 'Yes, Overwrite & Restore'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Available Backups List */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Available Backup Snapshots ({backups.length})</span>
              </h4>

              <button
                type="button"
                onClick={fetchBackups}
                disabled={loading}
                className="text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {loading && backups.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Loading snapshots...</div>
              ) : backups.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  No historical snapshots found in backup directory.
                </div>
              ) : (
                backups.map((b) => (
                  <div
                    key={b.filename}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-slate-900 font-mono truncate text-[11px]">
                        {b.filename}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>Created: {new Date(b.createdAt).toLocaleString()}</span>
                        <span>•</span>
                        <span>{b.sizeKb} KB</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedBackupForRestore(b)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 rounded-xl font-bold text-[11px] transition-colors"
                        title="Restore database to this snapshot"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
