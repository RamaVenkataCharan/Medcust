import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, KeyRound, ShieldAlert, Check, X, Settings2 } from 'lucide-react';

export default function PinLockModal({ isLocked, onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const inputRef = useRef(null);

  const getStoredPin = () => localStorage.getItem('medtrack_shop_pin') || '1234';

  useEffect(() => {
    if (isLocked) {
      setPin('');
      setError('');
      setIsChangingPin(false);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    }
  }, [isLocked]);

  const handleKeyPress = (digit) => {
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      setError('');
      if (next.length === 4) {
        verifyPin(next);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const verifyPin = (candidate) => {
    const activePin = getStoredPin();
    if (candidate === activePin) {
      onUnlock();
    } else {
      setError('Incorrect PIN. (Default is 1234)');
      setPin('');
    }
  };

  const handleKeyDown = (e) => {
    if (!isLocked || isChangingPin) return;

    if (e.key >= '0' && e.key <= '9') {
      handleKeyPress(e.key);
    } else if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Enter' && pin.length === 4) {
      verifyPin(pin);
    }
  };

  useEffect(() => {
    if (isLocked) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isLocked, pin, isChangingPin]);

  const handleSaveNewPin = (e) => {
    e.preventDefault();
    const stored = getStoredPin();
    if (currentPinInput !== stored) {
      setError('Current PIN is incorrect');
      return;
    }
    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setError('New PIN must be exactly 4 digits');
      return;
    }
    localStorage.setItem('medtrack_shop_pin', newPinInput);
    setIsChangingPin(false);
    setCurrentPinInput('');
    setNewPinInput('');
    setError('');
    onUnlock();
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 select-none animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center space-y-6">
        {/* Icon & Title */}
        <div className="space-y-2">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Medical Shop Ledger Locked
          </h2>
          <p className="text-xs text-slate-500">
            Enter 4-digit shop PIN to unlock counter ledger
          </p>
        </div>

        {isChangingPin ? (
          /* Change PIN Form */
          <form onSubmit={handleSaveNewPin} className="space-y-3 text-left text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Current PIN</label>
              <input
                type="password"
                maxLength={4}
                required
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 1234"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">New 4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                required
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="4 digits"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {error && <p className="text-[11px] text-rose-600 font-bold text-center">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsChangingPin(false);
                  setError('');
                }}
                className="flex-1 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors"
              >
                Save PIN
              </button>
            </div>
          </form>
        ) : (
          /* Main PIN Display & Keypad */
          <div className="space-y-5">
            {/* PIN Dots Display */}
            <div className="flex justify-center gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                      filled
                        ? 'bg-indigo-600 border-indigo-600 scale-110'
                        : 'border-slate-300 bg-slate-100'
                    }`}
                  />
                );
              })}
            </div>

            {error ? (
              <p className="text-xs text-rose-600 font-semibold animate-pulse">{error}</p>
            ) : (
              <p className="text-[11px] text-slate-400">Default PIN: 1234 (Click settings below to change)</p>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  className="w-16 h-12 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 border border-slate-200/80 rounded-2xl text-base font-bold text-slate-800 transition-all flex items-center justify-center font-mono shadow-2xs"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsChangingPin(true)}
                className="w-16 h-12 text-slate-400 hover:text-slate-600 active:scale-95 rounded-2xl text-xs flex items-center justify-center transition-colors"
                title="Change Shop PIN"
              >
                <Settings2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="w-16 h-12 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 border border-slate-200/80 rounded-2xl text-base font-bold text-slate-800 transition-all flex items-center justify-center font-mono shadow-2xs"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                className="w-16 h-12 text-slate-500 hover:text-rose-600 active:scale-95 rounded-2xl text-xs font-bold flex items-center justify-center transition-colors"
                title="Backspace"
              >
                ←
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
