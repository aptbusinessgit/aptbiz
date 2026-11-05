import React, { useState } from 'react';
import {
  Printer,
  Plus,
  LogOut,
  ShieldCheck,
  User,
  LogIn,
  KeyRound,
  X,
  AlertCircle,
  Menu,
  ShoppingBag,
  Package,
  FileText,
  Users,
  Building2,
  Receipt,
  Settings as SettingsIcon,
  ChevronRight,
} from 'lucide-react';
import type { UserSession } from '../types/pos';

export type NavTab =
  | 'register'
  | 'inventory'
  | 'purchases'
  | 'customers'
  | 'vendors'
  | 'sales'
  | 'settings';

interface TopBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  hasLastSale: boolean;
  onPrintLastReceipt: () => void;
  currentUser: UserSession | null;
  onLogout: () => void;
  onLogin: (user: UserSession) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  hasLastSale,
  onPrintLastReceipt,
  currentUser,
  onLogout,
  onLogin,
}) => {
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [modalUsername, setModalUsername] = useState('admin');
  const [modalPassword, setModalPassword] = useState('admin');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Navigation items: Admin gets Purchases, Customers, Vendors, Inventory, Settings
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
  }> = [
    { id: 'register', label: 'Register', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package, adminOnly: true },
    { id: 'purchases', label: 'Purchases', icon: FileText, adminOnly: true },
    { id: 'customers', label: 'Customers', icon: Users, adminOnly: true },
    { id: 'vendors', label: 'Vendors', icon: Building2, adminOnly: true },
    { id: 'sales', label: 'Sales History', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, adminOnly: true },
  ];

  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin);

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!modalUsername.trim() || !modalPassword) {
      setModalError('Username and password are required.');
      return;
    }

    setModalLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: modalUsername.trim(), password: modalPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }
      onLogin(data.user);
      setShowSwitchModal(false);
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleQuickPreset = (role: 'admin' | 'cashier') => {
    if (role === 'admin') {
      setModalUsername('admin');
      setModalPassword('admin');
    } else {
      setModalUsername('cashier');
      setModalPassword('1234');
    }
    setModalError(null);
  };

  const handleSelectMobileTab = (tab: NavTab) => {
    onSelectTab(tab);
    setShowMobileDrawer(false);
  };

  return (
    <>
      <header className="no-print h-14 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-6 shrink-0 z-20">
        {/* Zone 1: Brand title & Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowMobileDrawer(true)}
            className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('register')}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded"
          >
            Counterline
          </button>
        </div>

        {/* Zone 2: Desktop Navigation Links (hidden on < lg screens) */}
        <nav
          className="hidden lg:flex items-center gap-4 xl:gap-6 h-full overflow-x-auto"
          aria-label="Primary Navigation"
        >
          {visibleNav.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative h-full flex items-center text-xs xl:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                  isActive ? 'text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions + User Status */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {currentUser ? (
            <>
              {/* User badge (compact on mobile) */}
              <button
                type="button"
                onClick={() => {
                  handleQuickPreset(isAdmin ? 'cashier' : 'admin');
                  setShowSwitchModal(true);
                }}
                title="Click to switch user"
                className={`flex items-center gap-1 sm:gap-1.5 text-xs border rounded-lg px-2 sm:px-2.5 py-1 sm:py-1.5 transition-colors ${
                  isAdmin
                    ? 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isAdmin ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                ) : (
                  <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
                <span className="font-semibold max-w-[70px] sm:max-w-none truncate">
                  {currentUser.username}
                </span>
                <span className="hidden sm:inline text-slate-400">·</span>
                <span className="hidden sm:inline text-[11px] capitalize">{currentUser.role}</span>
              </button>

              {/* Action Button: Reprint / New Sale */}
              {activeTab === 'register' && hasLastSale ? (
                <button
                  type="button"
                  onClick={onPrintLastReceipt}
                  title="Reprint last completed receipt"
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reprint</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectTab('register')}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Sale</span>
                </button>
              )}

              {/* Desktop Switch User & Logout */}
              <button
                type="button"
                onClick={() => {
                  handleQuickPreset(isAdmin ? 'cashier' : 'admin');
                  setShowSwitchModal(true);
                }}
                title="Switch account"
                className="hidden md:inline-flex px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Switch
              </button>

              <button
                type="button"
                onClick={onLogout}
                title="Log out"
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                handleQuickPreset('admin');
                setShowSwitchModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Slide-over Mobile Navigation Drawer */}
      {showMobileDrawer && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setShowMobileDrawer(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-display text-base font-bold text-slate-900">Counterline POS</div>
                <div className="text-xs text-slate-500">Retail Terminal & Inventory</div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileDrawer(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Session Info inside Drawer */}
            {currentUser && (
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        isAdmin ? 'bg-blue-700 text-white' : 'bg-slate-300 text-slate-800'
                      }`}
                    >
                      {currentUser.username[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-xs">
                        {currentUser.username}
                      </div>
                      <div className="text-[11px] text-slate-500 capitalize">
                        {currentUser.role} Account
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileDrawer(false);
                      handleQuickPreset(isAdmin ? 'cashier' : 'admin');
                      setShowSwitchModal(true);
                    }}
                    className="text-xs text-blue-700 font-medium hover:underline"
                  >
                    Switch
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Tabs List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">
                Terminal Navigation
              </div>
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectMobileTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-800 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${isActive ? 'text-blue-700' : 'text-slate-400'}`}
                      />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </button>
                );
              })}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 space-y-2 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setShowMobileDrawer(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out of Terminal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch User / Quick Login Modal */}
      {showSwitchModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-user-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 id="switch-user-modal-title" className="text-base font-semibold text-slate-900">
                  {currentUser ? 'Switch POS User' : 'Sign In to Terminal'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter credentials to access Admin Panel or Register.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-5 space-y-3.5">
              {modalError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={modalUsername}
                  onChange={(e) => setModalUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={modalPassword}
                  onChange={(e) => setModalPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-700"
                />
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickPreset('admin')}
                  className="flex-1 py-1.5 px-2 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 text-center"
                >
                  Admin (admin/admin)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('cashier')}
                  className="flex-1 py-1.5 px-2 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 text-center"
                >
                  Cashier (cashier/1234)
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSwitchModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg shadow-sm"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{modalLoading ? 'Signing in...' : 'Sign In'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
