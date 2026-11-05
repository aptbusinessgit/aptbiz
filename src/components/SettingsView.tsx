import React, { useState } from 'react';
import {
  Check,
  Printer,
  Sliders,
  Store,
  LayoutGrid,
  Receipt,
  Scan,
  ShieldAlert,
  Percent,
  Monitor
} from 'lucide-react';
import type { PosScreenLayout, PrintJob, StoreSettings, TaxType } from '../types/pos';

interface SettingsViewProps {
  settings: StoreSettings;
  printQueue: PrintJob[];
  onSaveSettings: (updated: StoreSettings) => Promise<void>;
  onFlushPrintQueue: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  printQueue,
  onSaveSettings,
  onFlushPrintQueue,
}) => {
  const [form, setForm] = useState<StoreSettings>(settings);
  const [activeSettingsSection, setActiveSettingsSection] = useState<
    'sales' | 'screen' | 'store' | 'printer'
  >('sales');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await onSaveSettings(form);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const screenModels: Array<{
    id: PosScreenLayout;
    title: string;
    description: string;
    badge: string;
  }> = [
    {
      id: 'standard',
      title: 'Standard Desktop Terminal',
      description: 'Balanced 3-column product catalog with side checkout ticket. Ideal for keyboard/mouse or barcode scanner setups.',
      badge: 'Recommended',
    },
    {
      id: 'touchscreen',
      title: 'Touchscreen Quick-Service Grid',
      description: 'Larger touch targets, bold product cards, category headers, and elevated quantity steppers for finger touch displays.',
      badge: 'Touch Optimized',
    },
    {
      id: 'compact-scanner',
      title: 'High-Speed Scanner Lane',
      description: 'Streamlined barcode scan lane prioritizing instant ticket feed, large total readouts, and cash tender speed.',
      badge: 'Grocery & Retail',
    },
    {
      id: 'split-touch',
      title: 'Dual Split Screen View',
      description: 'Side-by-side equal view of catalog visual tiles and extensive ticket itemization with customer ledger data.',
      badge: 'Boutique & Café',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Navigation tabs for settings sections */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto">
          {[
            { id: 'sales', label: 'Sales & Tax Settings', icon: Percent },
            { id: 'screen', label: 'POS Screen Models', icon: LayoutGrid },
            { id: 'store', label: 'Store & Receipt Info', icon: Store },
            { id: 'printer', label: 'Thermal Printer & Queue', icon: Printer },
          ].map((sec) => {
            const Icon = sec.icon;
            const active = activeSettingsSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSettingsSection(sec.id as any)}
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Settings Form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5 sm:space-y-6 text-xs shadow-xs"
          >
            {/* SECTION 1: SALES & TAX SETTINGS */}
            {activeSettingsSection === 'sales' && (
              <div className="space-y-5">
                <div className="border-b border-slate-200 pb-3">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-blue-700" />
                    <span>Sales & Taxation Architecture</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure tax inclusive/exclusive modes, rounding methods, and retail transaction rules.
                  </p>
                </div>

                {/* Tax Inclusion Toggle */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-900">
                      Tax Calculation Mode
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Choose whether retail shelf prices already include sales tax or if tax is computed and added on top at checkout.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, taxType: 'exclusive' })}
                      className={`p-3 text-left rounded-lg border transition-all ${
                        form.taxType === 'exclusive'
                          ? 'bg-white border-blue-700 ring-2 ring-blue-700/20 shadow-sm'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">Tax Exclusive (Added)</span>
                        {form.taxType === 'exclusive' && (
                          <span className="text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Tax is added on top of the subtotal at checkout (Standard in US & Canada).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm({ ...form, taxType: 'inclusive' })}
                      className={`p-3 text-left rounded-lg border transition-all ${
                        form.taxType === 'inclusive'
                          ? 'bg-white border-blue-700 ring-2 ring-blue-700/20 shadow-sm'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">Tax Inclusive (VAT/GST)</span>
                        {form.taxType === 'inclusive' && (
                          <span className="text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Retail price includes tax. Subtotal and extracted tax breakdown printed on receipt.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Standard Sales Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={form.taxRate}
                      onChange={(e) =>
                        setForm({ ...form, taxRate: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 tabular-nums focus:outline-none focus:border-blue-700"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Currency Symbol
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={form.currencySymbol}
                      onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                      className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Default Walk-in Customer Label
                    </label>
                    <input
                      type="text"
                      value={form.defaultCustomer}
                      onChange={(e) => setForm({ ...form, defaultCustomer: e.target.value })}
                      placeholder="Walk-in Customer"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Active Cashier Shift Name
                    </label>
                    <input
                      type="text"
                      value={form.cashierName}
                      onChange={(e) => setForm({ ...form, cashierName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                    />
                  </div>
                </div>

                {/* Operational Toggles */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider text-slate-500">
                    Checkout & Inventory Safeguards
                  </h3>

                  <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowNegativeStock}
                      onChange={(e) => setForm({ ...form, allowNegativeStock: e.target.checked })}
                      className="mt-0.5 rounded text-blue-700 focus:ring-blue-700"
                    />
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        Allow Negative Inventory Billing
                      </span>
                      <span className="text-[11px] text-slate-500">
                        When enabled, cashiers can complete sales even if SQLite stock count is zero or uncounted.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.roundTotalToFiveCents}
                      onChange={(e) =>
                        setForm({ ...form, roundTotalToFiveCents: e.target.checked })
                      }
                      className="mt-0.5 rounded text-blue-700 focus:ring-blue-700"
                    />
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        Cash Rounding to Nearest 5 Cents (Swedish Rounding)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Rounds checkout balance to $0.05 for countries eliminating 1-cent coins.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.barcodeScanBeep}
                      onChange={(e) => setForm({ ...form, barcodeScanBeep: e.target.checked })}
                      className="mt-0.5 rounded text-blue-700 focus:ring-blue-700"
                    />
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        Audio Beep Feedback on Barcode Scan
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Synthesizes a short POS scan tone via Web Audio API whenever an item is added to the cart.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* SECTION 2: POS SCREEN MODELS */}
            {activeSettingsSection === 'screen' && (
              <div className="space-y-5">
                <div className="border-b border-slate-200 pb-3">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-blue-700" />
                    <span>POS Screen Models & Layout Modes</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select the interface layout that best fits your retail hardware counter, touchscreen, or scanner lane.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {screenModels.map((model) => {
                    const isSelected = form.posScreenLayout === model.id;
                    return (
                      <div
                        key={model.id}
                        onClick={() => setForm({ ...form, posScreenLayout: model.id })}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-50/50 border-blue-700 ring-2 ring-blue-700/20 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900 text-sm">
                              {model.title}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                                isSelected
                                  ? 'bg-blue-700 text-white font-semibold'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {model.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                            {model.description}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span
                            className={
                              isSelected ? 'text-blue-700 font-semibold' : 'text-slate-400'
                            }
                          >
                            {isSelected ? '✓ Current Active Layout' : 'Click to Activate'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 3: STORE & RECEIPT INFO */}
            {activeSettingsSection === 'store' && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Store className="w-4 h-4 text-blue-700" />
                    <span>Store Profile & Receipt Branding</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Printed at the top and bottom of every customer thermal ticket.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">Store Name *</label>
                    <input
                      type="text"
                      required
                      value={form.storeName}
                      onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">
                      Store Address
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Business Tax ID / EIN
                    </label>
                    <input
                      type="text"
                      value={form.taxId}
                      onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                      className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">
                      Receipt Footer Policy & Return Notice
                    </label>
                    <textarea
                      rows={2}
                      value={form.receiptFooter}
                      onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 4: THERMAL PRINTER SETTINGS */}
            {activeSettingsSection === 'printer' && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Printer className="w-4 h-4 text-blue-700" />
                    <span>Thermal Printer & Paper Specifications</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select roll width format and configure offline auto-queueing.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Thermal Roll Width
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                      {(['80mm', '58mm'] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setForm({ ...form, paperWidth: w })}
                          className={`py-2 font-mono text-xs font-semibold rounded-md transition-colors ${
                            form.paperWidth === w
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {w} Roll
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Auto-Print Behavior
                    </label>
                    <div className="pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.autoPrintReceiptOnSale}
                          onChange={(e) =>
                            setForm({ ...form, autoPrintReceiptOnSale: e.target.checked })
                          }
                          className="rounded text-blue-700 focus:ring-blue-700"
                        />
                        <span className="text-slate-700 text-xs">
                          Open thermal receipt dialog immediately on sale checkout
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.receiptBarcodeEnabled}
                        onChange={(e) =>
                          setForm({ ...form, receiptBarcodeEnabled: e.target.checked })
                        }
                        className="rounded text-blue-700 focus:ring-blue-700"
                      />
                      <span className="text-slate-700 text-xs">
                        Print transaction barcode on receipts for return scanning
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Save Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div>
                {savedNotice && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <Check className="w-4 h-4" />
                    <span>Configuration saved to SQLite</span>
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                {saving ? 'Saving...' : 'Save All Settings'}
              </button>
            </div>
          </form>

          {/* Right Column: Printer Hardware & SQLite Status */}
          <div className="space-y-6">
            {/* Printer Online/Offline Status */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Thermal Hardware Status
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Toggle to Offline to queue receipts when replacing thermal paper or running disconnected.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...form, printerOnline: true };
                    setForm(next);
                    onSaveSettings(next);
                  }}
                  className={`py-2 text-xs font-medium rounded-md transition-colors ${
                    form.printerOnline
                      ? 'bg-white text-emerald-700 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Printer Online
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...form, printerOnline: false };
                    setForm(next);
                    onSaveSettings(next);
                  }}
                  className={`py-2 text-xs font-medium rounded-md transition-colors ${
                    !form.printerOnline
                      ? 'bg-white text-amber-700 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Printer Offline
                </button>
              </div>
            </div>

            {/* Offline Print Queue */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Offline Print Queue
                  </h3>
                  <p className="text-slate-500 mt-0.5 font-mono tabular-nums">
                    {printQueue.length} {printQueue.length === 1 ? 'job' : 'jobs'} pending
                  </p>
                </div>
                {printQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={onFlushPrintQueue}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print All</span>
                  </button>
                )}
              </div>

              {printQueue.length === 0 ? (
                <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  No queued offline print jobs.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {printQueue.map((job) => (
                    <div
                      key={job.id}
                      className="py-2.5 flex items-center justify-between font-mono"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {job.receiptNumber}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(job.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="font-semibold text-slate-900 tabular-nums">
                        {settings.currencySymbol}
                        {job.total.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Accounts Overview */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 text-xs shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">System Accounts</h3>
                <p className="text-slate-500 mt-0.5">
                  Stored in local SQLite database.
                </p>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-2.5 font-mono text-[11px]">
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200">
                  <div>
                    <span className="font-semibold text-slate-900">admin</span>
                    <span className="text-slate-400"> / </span>
                    <span className="text-slate-600">admin</span>
                  </div>
                  <span className="text-blue-700 font-sans font-medium text-xs">Admin Role</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200">
                  <div>
                    <span className="font-semibold text-slate-900">cashier</span>
                    <span className="text-slate-400"> / </span>
                    <span className="text-slate-600">1234</span>
                  </div>
                  <span className="text-slate-600 font-sans font-medium text-xs">Cashier Role</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
