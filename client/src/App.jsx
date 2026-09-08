import React, { useState } from 'react';
import Header from './components/Header';
import { ToastProvider } from './components/Toast';
import Home from './pages/Home';
import CustomerProfile from './pages/CustomerProfile';
import DuesReport from './pages/DuesReport';

export default function App() {
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'profile' | 'dues'
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

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

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-3.5 px-6 text-center text-xs text-slate-400">
          MedTrack Khata Ledger • Medical Shop Customer Dues & Medicine Purchase History
        </footer>
      </div>
    </ToastProvider>
  );
}
