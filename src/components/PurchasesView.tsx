import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import type {
  Product,
  PurchaseEntry,
  StoreSettings,
  Vendor
} from '../types/pos';

interface PurchasesViewProps {
  purchases: PurchaseEntry[];
  vendors: Vendor[];
  products: Product[];
  settings: StoreSettings;
  onRefreshPurchases: () => Promise<void>;
  onRefreshProducts: () => Promise<void>;
  onNavigateToVendors: () => void;
}

interface NewPurchaseItemRow {
  productId: number;
  quantity: number;
  unitCost: number;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  purchases,
  vendors,
  products,
  settings,
  onRefreshPurchases,
  onRefreshProducts,
  onNavigateToVendors,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseEntry | null>(null);

  // Form states
  const [vendorId, setVendorId] = useState<number>(vendors[0]?.id || 0);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [taxAmount, setTaxAmount] = useState('0.00');
  const [shippingCost, setShippingCost] = useState('0.00');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING' | 'PARTIAL'>('PAID');
  const [notes, setNotes] = useState('');
  const [updateCostPrices, setUpdateCostPrices] = useState(true);
  const [items, setItems] = useState<NewPurchaseItemRow[]>([
    { productId: products[0]?.id || 0, quantity: 10, unitCost: products[0]?.costPrice || 0 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const c = settings.currencySymbol;

  const stats = useMemo(() => {
    const totalPurchases = purchases.length;
    const totalAmount = purchases.reduce((sum, p) => sum + p.total, 0);
    const pendingAmount = purchases
      .filter((p) => p.paymentStatus !== 'PAID')
      .reduce((sum, p) => sum + p.total, 0);
    const unitsProcured = purchases.reduce(
      (sum, p) => sum + p.items.reduce((acc, it) => acc + it.quantity, 0),
      0
    );
    return { totalPurchases, totalAmount, pendingAmount, unitsProcured };
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (statusFilter !== 'ALL' && p.paymentStatus !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          p.invoiceNumber.toLowerCase().includes(q) ||
          p.vendorName.toLowerCase().includes(q) ||
          (p.notes && p.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [purchases, statusFilter, search]);

  const openNewPurchaseModal = () => {
    const seq = 101 + purchases.length;
    setInvoiceNumber(`PO-${new Date().getFullYear()}-${seq}`);
    setVendorId(vendors[0]?.id || 0);
    setReceivedDate(new Date().toISOString().slice(0, 10));
    setTaxAmount('0.00');
    setShippingCost('0.00');
    setPaymentStatus('PAID');
    setNotes('');
    setUpdateCostPrices(true);
    if (products.length > 0) {
      setItems([
        {
          productId: products[0].id,
          quantity: 10,
          unitCost: products[0].costPrice,
        },
      ]);
    } else {
      setItems([]);
    }
    setFormError(null);
    setModalOpen(true);
  };

  const addItemRow = () => {
    const nextProd = products.find((p) => !items.some((it) => it.productId === p.id)) || products[0];
    if (!nextProd) return;
    setItems((prev) => [
      ...prev,
      { productId: nextProd.id, quantity: 10, unitCost: nextProd.costPrice },
    ]);
  };

  const removeItemRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItemRow = (idx: number, patch: Partial<NewPurchaseItemRow>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, ...patch };
        if (patch.productId !== undefined) {
          const selectedProd = products.find((p) => p.id === patch.productId);
          if (selectedProd) {
            updated.unitCost = selectedProd.costPrice;
          }
        }
        return updated;
      })
    );
  };

  const formSubtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity || 0) * (it.unitCost || 0), 0);
  }, [items]);

  const formTotal = useMemo(() => {
    const tax = Number(taxAmount) || 0;
    const ship = Number(shippingCost) || 0;
    return formSubtotal + tax + ship;
  }, [formSubtotal, taxAmount, shippingCost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!invoiceNumber.trim()) {
      setFormError('PO / Invoice Number is required.');
      return;
    }
    if (!vendorId) {
      setFormError('Please select a vendor supplier.');
      return;
    }
    if (items.length === 0) {
      setFormError('Please add at least one line item to this purchase.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: invoiceNumber.trim(),
          vendorId,
          receivedDate,
          taxAmount: Number(taxAmount) || 0,
          shippingCost: Number(shippingCost) || 0,
          paymentStatus,
          notes: notes.trim(),
          updateCostPrices,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: Math.max(1, it.quantity),
            unitCost: Math.max(0, it.unitCost),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record purchase entry.');
      }

      await Promise.all([onRefreshPurchases(), onRefreshProducts()]);
      setModalOpen(false);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Invoice #',
      'Vendor',
      'Received Date',
      'Items Count',
      'Subtotal',
      'Tax',
      'Shipping',
      'Total',
      'Payment Status',
    ];
    const rows = filteredPurchases.map((p) => [
      `"${p.invoiceNumber}"`,
      `"${p.vendorName.replace(/"/g, '""')}"`,
      p.receivedDate,
      p.items.length,
      p.subtotal.toFixed(2),
      p.taxAmount.toFixed(2),
      p.shippingCost.toFixed(2),
      p.total.toFixed(2),
      p.paymentStatus,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-entries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Total Purchase Orders</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {stats.totalPurchases}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Gross Procurement</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums truncate">
            {c}
            {stats.totalAmount.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Units Procured</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            +{stats.unitsProcured}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Pending Payables</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-amber-700 tabular-nums truncate">
            {c}
            {stats.pendingAmount.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice # or vendor..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-700"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(['ALL', 'PAID', 'PENDING'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === status
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status === 'ALL' ? 'All Purchases' : status === 'PAID' ? 'Settled (Paid)' : 'Pending'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={openNewPurchaseModal}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>New Purchase</span>
            </button>
          </div>
        </div>

        {/* Mobile Purchases Cards View (< md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredPurchases.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No purchase orders recorded yet. Click "New Purchase" to receive stock.
            </div>
          ) : (
            filteredPurchases.map((p) => {
              const totalUnits = p.items.reduce((sum, it) => sum + it.quantity, 0);

              return (
                <div key={p.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{p.invoiceNumber}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{p.vendorName}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded shrink-0 ${
                        p.paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700'
                          : p.paymentStatus === 'PARTIAL'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {p.paymentStatus === 'PAID' ? 'Paid' : p.paymentStatus}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div className="text-[11px] text-slate-500 font-mono">
                      {p.receivedDate} · {p.items.length} lines ({totalUnits} pcs)
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {c}{p.total.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedPurchase(p)}
                        className="p-1 text-slate-600 hover:text-blue-700 border border-slate-200 rounded"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Invoice / PO #</th>
                <th className="py-2.5 px-4">Vendor Supplier</th>
                <th className="py-2.5 px-4">Received Date</th>
                <th className="py-2.5 px-4 text-right">Items & Units</th>
                <th className="py-2.5 px-4 text-right">Invoice Total</th>
                <th className="py-2.5 px-4">Payment</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No purchase orders recorded yet. Click "New Purchase Entry" to receive stock.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => {
                  const totalUnits = p.items.reduce((sum, it) => sum + it.quantity, 0);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{p.invoiceNumber}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{p.vendorName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{p.receivedDate}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 whitespace-nowrap tabular-nums">
                        {p.items.length} {p.items.length === 1 ? 'line' : 'lines'} ({totalUnits} pcs)
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                        {c}
                        {p.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            p.paymentStatus === 'PAID'
                              ? 'text-emerald-700'
                              : p.paymentStatus === 'PARTIAL'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          {p.paymentStatus === 'PAID' ? 'Paid in Full' : p.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedPurchase(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-blue-700 hover:text-blue-700 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Entry Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchase-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full overflow-hidden shadow-2xl my-6">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 id="purchase-modal-title" className="text-base font-semibold text-slate-900">
                  New Purchase Entry (Receive Stock)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Receiving items automatically increments current inventory stock in SQLite.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Vendor & Invoice Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700">Vendor Supplier *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setModalOpen(false);
                        onNavigateToVendors();
                      }}
                      className="text-[11px] text-blue-700 hover:underline"
                    >
                      + Add New Vendor
                    </button>
                  </div>
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:border-blue-700"
                  >
                    {vendors.length === 0 ? (
                      <option value={0}>No vendors registered</option>
                    ) : (
                      vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Invoice / PO Number *</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g., INV-9921"
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Date Received</label>
                  <input
                    type="date"
                    required
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="flex items-center justify-between pb-1">
                  <span className="font-semibold text-slate-900 text-xs">Procured Line Items</span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center"
                    >
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] text-slate-500 mb-0.5">Product</label>
                        <select
                          value={it.productId}
                          onChange={(e) =>
                            updateItemRow(idx, { productId: Number(e.target.value) })
                          }
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-slate-900 bg-white text-xs"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) — Stock: {p.stock}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:contents">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={it.quantity}
                            onChange={(e) =>
                              updateItemRow(idx, { quantity: parseInt(e.target.value, 10) || 1 })
                            }
                            className="w-full px-2 py-1.5 font-mono border border-slate-200 rounded text-slate-900 text-right tabular-nums text-xs"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Unit Cost ({c})</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            required
                            value={it.unitCost}
                            onChange={(e) =>
                              updateItemRow(idx, { unitCost: parseFloat(e.target.value) || 0 })
                            }
                            className="w-full px-2 py-1.5 font-mono border border-slate-200 rounded text-slate-900 text-right tabular-nums text-xs"
                          />
                        </div>

                        <div className="sm:col-span-3 flex items-center justify-between sm:justify-end gap-2 pl-1">
                          <div className="text-right">
                            <span className="block text-[10px] text-slate-400 sm:hidden">Total</span>
                            <span className="font-mono font-semibold text-slate-900 tabular-nums text-xs">
                              {c}
                              {((it.quantity || 0) * (it.unitCost || 0)).toFixed(2)}
                            </span>
                          </div>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100"
                              title="Remove line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost sync & Additional charges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-start">
                <div className="space-y-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Payment Status</label>
                    <select
                      value={paymentStatus}
                      onChange={(e) =>
                        setPaymentStatus(e.target.value as 'PAID' | 'PENDING' | 'PARTIAL')
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="PAID">Paid in Full</option>
                      <option value="PENDING">Pending (Accounts Payable)</option>
                      <option value="PARTIAL">Partially Paid</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={updateCostPrices}
                      onChange={(e) => setUpdateCostPrices(e.target.checked)}
                      className="rounded text-blue-700 focus:ring-blue-700"
                    />
                    <span className="text-slate-700 text-xs">
                      Update product default cost price with these rates
                    </span>
                  </label>
                </div>

                <div className="sm:col-span-2 space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {c}
                      {formSubtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-600">Tax / Freight Duties:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-slate-500">{c}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(e.target.value)}
                        className="w-24 px-2 py-1 font-mono text-right border border-slate-200 rounded bg-white tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-600">Shipping & Handling:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-slate-500">{c}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={shippingCost}
                        onChange={(e) => setShippingCost(e.target.value)}
                        className="w-24 px-2 py-1 font-mono text-right border border-slate-200 rounded bg-white tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                    <span>Grand Total:</span>
                    <span className="font-mono tabular-nums">
                      {c}
                      {formTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Notes / Receiving Memo</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Received via Freight Logistics pallet 3, inspected by admin"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{saving ? 'Recording Stock...' : 'Confirm & Increment Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {selectedPurchase && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 id="detail-modal-title" className="text-base font-semibold text-slate-900">
                  Purchase Invoice {selectedPurchase.invoiceNumber}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vendor: {selectedPurchase.vendorName} · Received {selectedPurchase.receivedDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Cost</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPurchase.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-2.5 font-medium text-slate-900">
                          {it.productName}
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {it.sku}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono tabular-nums">
                          {it.quantity}
                        </td>
                        <td className="p-2.5 text-right font-mono tabular-nums">
                          {c}
                          {it.unitCost.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold tabular-nums">
                          {c}
                          {it.lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-right text-xs pt-1">
                <div className="text-slate-600">
                  Subtotal: <span className="font-mono font-semibold">{c}{selectedPurchase.subtotal.toFixed(2)}</span>
                </div>
                {selectedPurchase.taxAmount > 0 && (
                  <div className="text-slate-600">
                    Tax / Duties: <span className="font-mono">{c}{selectedPurchase.taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {selectedPurchase.shippingCost > 0 && (
                  <div className="text-slate-600">
                    Shipping: <span className="font-mono">{c}{selectedPurchase.shippingCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="text-sm font-bold text-slate-900 pt-1 border-t border-slate-100">
                  Grand Total: <span className="font-mono">{c}{selectedPurchase.total.toFixed(2)}</span>
                </div>
              </div>

              {selectedPurchase.notes && (
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-700">
                  <span className="font-medium">Memo: </span>
                  {selectedPurchase.notes}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
