import React, { useState } from 'react';
import { AlertCircle, Lock, User, KeyRound } from 'lucide-react';
import type { UserSession } from '../types/pos';

interface LoginFormProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please check credentials.');
      }

      onLoginSuccess(data.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (role: 'admin' | 'cashier') => {
    if (role === 'admin') {
      setUsername('admin');
      setPassword('admin');
    } else {
      setUsername('cashier');
      setPassword('1234');
    }
    setError(null);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-900 px-4 py-12 relative overflow-hidden">
      {/* Subtle background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            Counterline POS
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Retail Point-of-Sale & Inventory Management
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Sign In to Terminal</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your credentials to unlock POS register and store functions.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-slate-700"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
          </form>

          {/* Quick presets callout */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-600">
            <div className="font-medium text-slate-700 mb-2">Default demo accounts:</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                className="p-2 text-left bg-white border border-slate-200 rounded-lg hover:border-blue-700 hover:bg-blue-50/50 transition-colors"
              >
                <div className="font-semibold text-slate-900">Admin Account</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  admin / admin
                </div>
                <div className="text-[10px] text-blue-700 mt-1 font-medium">
                  Full access (Admin panel)
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('cashier')}
                className="p-2 text-left bg-white border border-slate-200 rounded-lg hover:border-blue-700 hover:bg-blue-50/50 transition-colors"
              >
                <div className="font-semibold text-slate-900">Cashier Account</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  cashier / 1234
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">
                  Register & sales only
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Offline SQLite POS billing engine · Fast thermal receipt printing
        </p>
      </div>
    </div>
  );
};
