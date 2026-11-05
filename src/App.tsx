import React, { useCallback, useEffect, useState } from 'react';
import { TopBar, type NavTab } from './components/TopBar';
import { RegisterView } from './components/RegisterView';
import { InventoryView } from './components/InventoryView';
import { PurchasesView } from './components/PurchasesView';
import { CustomersView } from './components/CustomersView';
import { VendorsView } from './components/VendorsView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { SettingsView } from './components/SettingsView';
import { ThermalReceiptModal } from './components/ThermalReceiptModal';
import { LoginForm } from './components/LoginForm';
import {
  ShoppingBag,
  Package,
  FileText,
  Receipt,
  Settings as SettingsIcon,
} from 'lucide-react';
import type {
  Customer,
  PrintJob,
  Product,
  PurchaseEntry,
  Sale,
  StoreSettings,
  UserSession,
  Vendor,
} from './types/pos';

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Northside General Store',
  address: '418 Oakwood Ave, Suite 102, Portland, OR 97205',
  phone: '(503) 555-0194',
  taxId: 'EIN 84-2910482',
  taxRate: 8.5,
  currencySymbol: '$',
  receiptFooter: 'Thank you for shopping local!',
  paperWidth: '80mm',
  printerOnline: true,
  cashierName: 'Maya Lin',
  taxType: 'exclusive',
  posScreenLayout: 'standard',
  barcodeScanBeep: true,
  allowNegativeStock: false,
  roundTotalToFiveCents: false,
  autoPrintReceiptOnSale: true,
  receiptBarcodeEnabled: true,
  enableStockAlertsOnCheckout: true,
  defaultCustomer: 'Walk-in Customer',
};

export function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const stored = sessionStorage.getItem('counterline_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<NavTab>('register');
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchases, setPurchases] = useState<PurchaseEntry[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [printQueue, setPrintQueue] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReceipt, setActiveReceipt] = useState<{
    sale: Sale;
    queuedOffline?: boolean;
  } | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [
        prodRes,
        salesRes,
        setRes,
        queueRes,
        custRes,
        vendRes,
        purchRes,
      ] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/sales'),
        fetch('/api/settings'),
        fetch('/api/print-queue'),
        fetch('/api/customers'),
        fetch('/api/vendors'),
        fetch('/api/purchases'),
      ]);

      if (prodRes.ok) setProducts(await prodRes.json());
      if (salesRes.ok) setSales(await salesRes.json());
      if (setRes.ok) setSettings(await setRes.json());
      if (queueRes.ok) setPrintQueue(await queueRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      if (vendRes.ok) setVendors(await vendRes.json());
      if (purchRes.ok) setPurchases(await purchRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchAll();
    } else {
      setLoading(false);
    }
  }, [currentUser, fetchAll]);

  const handleLoginSuccess = (user: UserSession) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('counterline_user', JSON.stringify(user));
    } catch {
      // storage disabled
    }
    if (user.role === 'admin') {
      setActiveTab('inventory');
    } else {
      setActiveTab('register');
    }
    setLoading(true);
    fetchAll();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('counterline_user');
    } catch {
      // ignore
    }
  };

  const refreshProducts = async () => {
    const res = await fetch('/api/products');
    if (res.ok) setProducts(await res.json());
  };

  const refreshCustomers = async () => {
    const res = await fetch('/api/customers');
    if (res.ok) setCustomers(await res.json());
  };

  const refreshVendors = async () => {
    const res = await fetch('/api/vendors');
    if (res.ok) setVendors(await res.json());
  };

  const refreshPurchases = async () => {
    const res = await fetch('/api/purchases');
    if (res.ok) setPurchases(await res.json());
  };

  const handleSaleCompleted = async (sale: Sale, queuedOffline: boolean) => {
    if (settings.autoPrintReceiptOnSale !== false) {
      setActiveReceipt({ sale, queuedOffline });
    }
    await fetchAll();
  };

  const handleVoidSale = async (saleId: number) => {
    const res = await fetch(`/api/sales/${saleId}/void`, { method: 'POST' });
    if (res.ok) {
      await fetchAll();
    }
  };

  const handleSaveSettings = async (updated: StoreSettings) => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      setSettings(await res.json());
    }
  };

  const handleFlushPrintQueue = async () => {
    if (window.electronAPI?.isElectron) {
      await window.electronAPI.printReceipt({ silent: true });
    } else {
      window.print();
    }
    await fetch('/api/print-queue/flush', { method: 'POST' });
    const queueRes = await fetch('/api/print-queue');
    if (queueRes.ok) setPrintQueue(await queueRes.json());
  };

  // If user is not logged in, render the Login Form on startup
  if (!currentUser) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  const lastCompletedSale = sales.find((s) => s.status === 'COMPLETED') || sales[0] || null;
  const isAdmin = currentUser.role === 'admin';

  // Ensure cashiers cannot remain on admin tabs if role changes
  const adminTabs: NavTab[] = ['inventory', 'purchases', 'customers', 'vendors', 'settings'];
  const effectiveTab: NavTab = !isAdmin && adminTabs.includes(activeTab) ? 'register' : activeTab;

  const mobileNavTabs: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = isAdmin
    ? [
        { id: 'register', label: 'Register', icon: ShoppingBag },
        { id: 'inventory', label: 'Inventory', icon: Package },
        { id: 'purchases', label: 'Purchases', icon: FileText },
        { id: 'sales', label: 'Sales', icon: Receipt },
        { id: 'settings', label: 'Settings', icon: SettingsIcon },
      ]
    : [
        { id: 'register', label: 'Register', icon: ShoppingBag },
        { id: 'sales', label: 'Sales', icon: Receipt },
      ];

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      <TopBar
        activeTab={effectiveTab}
        onSelectTab={setActiveTab}
        hasLastSale={Boolean(lastCompletedSale)}
        onPrintLastReceipt={() => {
          if (lastCompletedSale) {
            setActiveReceipt({ sale: lastCompletedSale });
          }
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        onLogin={handleLoginSuccess}
      />

      {loading ? (
        <main className="flex-1 flex items-center justify-center">
          <div className="text-sm text-slate-500">Loading POS terminal...</div>
        </main>
      ) : (
        <main className="flex-1 flex min-h-0 overflow-hidden">
          {effectiveTab === 'register' && (
            <RegisterView
              products={products}
              customers={customers}
              settings={settings}
              onSaleCompleted={handleSaleCompleted}
            />
          )}

          {effectiveTab === 'inventory' && isAdmin && (
            <InventoryView
              products={products}
              settings={settings}
              onRefreshProducts={refreshProducts}
            />
          )}

          {effectiveTab === 'purchases' && isAdmin && (
            <PurchasesView
              purchases={purchases}
              vendors={vendors}
              products={products}
              settings={settings}
              onRefreshPurchases={refreshPurchases}
              onRefreshProducts={refreshProducts}
              onNavigateToVendors={() => setActiveTab('vendors')}
            />
          )}

          {effectiveTab === 'customers' && isAdmin && (
            <CustomersView
              customers={customers}
              settings={settings}
              onRefresh={refreshCustomers}
            />
          )}

          {effectiveTab === 'vendors' && isAdmin && (
            <VendorsView
              vendors={vendors}
              settings={settings}
              onRefresh={refreshVendors}
            />
          )}

          {effectiveTab === 'sales' && (
            <SalesHistoryView
              sales={sales}
              settings={settings}
              onReprintSale={(sale) => setActiveReceipt({ sale })}
              onVoidSale={handleVoidSale}
            />
          )}

          {effectiveTab === 'settings' && isAdmin && (
            <SettingsView
              settings={settings}
              printQueue={printQueue}
              onSaveSettings={handleSaveSettings}
              onFlushPrintQueue={handleFlushPrintQueue}
            />
          )}
        </main>
      )}

      {/* Mobile Bottom Navigation Bar (< lg screens) */}
      <nav
        className="no-print lg:hidden h-14 bg-white border-t border-slate-200 flex items-stretch shrink-0 z-20"
        aria-label="Mobile Bottom Navigation"
      >
        {mobileNavTabs.map((item) => {
          const Icon = item.icon;
          const isActive = effectiveTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors min-w-0 ${
                isActive ? 'text-blue-700 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
              <span className="text-[10px] tracking-tight mt-0.5 truncate px-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {activeReceipt && (
        <ThermalReceiptModal
          sale={activeReceipt.sale}
          settings={settings}
          queuedOffline={activeReceipt.queuedOffline}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </div>
  );
}

export default App;
