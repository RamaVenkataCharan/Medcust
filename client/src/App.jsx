import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import { ToastProvider } from './components/Toast';
import Home from './pages/Home';
import CustomerProfile from './pages/CustomerProfile';
import DuesReport from './pages/DuesReport';
import PinLockModal from './components/PinLockModal';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes auto-lock

export default function App() {
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'profile' | 'dues'
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [isLocked, setIsLocked] = useState(true);
  const timerRef = useRef(null);

  // Inactivity Auto-Lock
  const resetInactivityTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsLocked(true);
    }, INACTIVITY_TIMEOUT_MS);
  };

  useEffect(() => {
    const handleUserActivity = () => {
      if (!isLocked) {
        resetInactivityTimer();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));
    resetInactivityTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
    };
  }, [isLocked]);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomerId(customer.customer_id);
    setCurrentView('profile');
  };

  const handleBackToSearch = () => {
    setSelectedCustomerId(null);
    setCurrentView('home');
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-indigo-600 selection:text-white">
        {/* Top Khata Header */}
        <Header
          currentView={currentView}
          setCurrentView={setCurrentView}
          onBackToSearch={handleBackToSearch}
          onLock={() => setIsLocked(true)}
        />

        {/* Main Content View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {currentView === 'home' && (
            <Home
              onSelectCustomer={handleSelectCustomer}
              onOpenDuesReport={() => setCurrentView('dues')}
            />
          )}

          {currentView === 'profile' && selectedCustomerId && (
            <CustomerProfile
              customerId={selectedCustomerId}
              onBackToSearch={handleBackToSearch}
            />
          )}

          {currentView === 'dues' && (
            <DuesReport
              onSelectCustomer={handleSelectCustomer}
            />
          )}
        </main>

        {/* Security PIN Gate Modal */}
        <PinLockModal
          isLocked={isLocked}
          onUnlock={() => {
            setIsLocked(false);
            resetInactivityTimer();
          }}
        />

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-3.5 px-6 text-center text-xs text-slate-400">
          MedTrack Khata Ledger • Medical Shop Customer Dues & Medicine Purchase History
        </footer>
      </div>
    </ToastProvider>
  );
}
