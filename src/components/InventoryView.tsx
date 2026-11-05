import React, { useMemo, useState } from 'react';
import { Download, Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import type { Product, ProductCategory, StoreSettings } from '../types/pos';

interface InventoryViewProps {
  products: Product[];
  settings: StoreSettings;
  onRefreshProducts: () => Promise<void>;
}

const CATEGORIES: ProductCategory[] = [
  'Beverages',
  'Bakery & Pantry',
  'Snacks',
  'Household',
  'Stationery',
];

interface ProductFormState {
  sku: string;
  barcode: string;
  name: string;
  category: ProductCategory;
  costPrice: string;
  retailPrice: string;
  stock: string;
  reorderLevel: string;
  unit: string;
}

const EMPTY_FORM: ProductFormState = {
  sku: '',
  barcode: '',
  name: '',
  category: 'Beverages',
  costPrice: '',
  retailPrice: '',
  stock: '0',
  reorderLevel: '5',
  unit: 'ea',
};

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  settings,
  onRefreshProducts,
}) => {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const c = settings.currencySymbol;

  const metrics = useMemo(() => {
    const totalSkus = products.length;
    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
    const alertCount = products.filter((p) => p.stock <= p.reorderLevel).length;
    const retailValuation = products.reduce(
      (sum, p) => sum + p.retailPrice * p.stock,
      0
    );
    return { totalSkus, totalUnits, alertCount, retailValuation };
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (stockFilter === 'low' && !(p.stock > 0 && p.stock <= p.reorderLevel)) {
        return false;
      }
      if (stockFilter === 'out' && p.stock > 0) {
        return false;
      }
      if (search.trim() !== '') {
        const q = search.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, stockFilter, search]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setForm({
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      category: product.category,
      costPrice: product.costPrice.toFixed(2),
      retailPrice: product.retailPrice.toFixed(2),
      stock: String(product.stock),
      reorderLevel: String(product.reorderLevel),
      unit: product.unit,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim() || !form.sku.trim() || !form.barcode.trim()) {
      setFormError('Product name, SKU, and barcode are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        name: form.name.trim(),
        category: form.category,
        costPrice: Math.max(0, Number(form.costPrice) || 0),
        retailPrice: Math.max(0, Number(form.retailPrice) || 0),
        stock: Math.max(0, parseInt(form.stock, 10) || 0),
        reorderLevel: Math.max(0, parseInt(form.reorderLevel, 10) || 0),
        unit: form.unit.trim() || 'ea',
      };

      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save product.');
      }

      await onRefreshProducts();
      setModalOpen(false);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStock = async (productId: number, delta: number) => {
    await fetch(`/api/products/${productId}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta }),
    });
    await onRefreshProducts();
  };

  const handleDeleteProduct = async (product: Product) => {
    await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
    await onRefreshProducts();
  };

  const handleExportCsv = () => {
    const headers = [
      'SKU',
      'Barcode',
      'Name',
      'Category',
      'Cost Price',
      'Retail Price',
      'Stock',
      'Reorder Level',
      'Unit',
    ];
    const rows = filteredProducts.map((p) => [
      p.sku,
      p.barcode,
      `"${p.name.replace(/"/g, '""')}"`,
      p.category,
      p.costPrice.toFixed(2),
      p.retailPrice.toFixed(2),
      p.stock,
      p.reorderLevel,
      p.unit,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50">
      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Active SKUs</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.totalSkus}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Units on Hand</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.totalUnits}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Reorder Alerts</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-amber-700 tabular-nums">
            {metrics.alertCount}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Inventory Valuation</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums truncate">
            {c}
            {metrics.retailValuation.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Toolbar & Content */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, SKU, or barcode..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-700"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All Stock' },
                  { id: 'low', label: 'Low Stock' },
                  { id: 'out', label: 'Out of Stock' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStockFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    stockFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
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
              onClick={openCreateModal}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Mobile Inventory Cards View (< md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No inventory items match the current filter.
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isOut = p.stock <= 0;
              const isLow = p.stock > 0 && p.stock <= p.reorderLevel;

              return (
                <div key={p.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-xs leading-snug">
                        {p.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {p.sku} · {p.barcode}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded shrink-0 ${
                        isOut
                          ? 'bg-red-50 text-red-700'
                          : isLow
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div className="space-y-0.5">
                      <div className="text-[11px] text-slate-500">
                        Retail: <span className="font-mono font-bold text-slate-900">{c}{p.retailPrice.toFixed(2)}</span>
                        {' '}(Cost: <span className="font-mono">{c}{p.costPrice.toFixed(2)}</span>)
                      </div>
                      <div className="text-xs font-semibold text-slate-900 font-mono">
                        Stock: {p.stock} {p.unit}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleQuickStock(p.id, -1)}
                        disabled={p.stock <= 0}
                        className="px-2 py-1 font-mono text-xs font-semibold border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40"
                        title="Deduct 1 unit"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickStock(p.id, 10)}
                        className="px-2 py-1 font-mono text-xs font-semibold border border-slate-200 rounded hover:bg-slate-100"
                        title="Add 10 units"
                      >
                        +10
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="p-1.5 text-slate-600 hover:text-blue-700 rounded hover:bg-slate-100"
                        aria-label={`Edit ${p.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
                <th className="py-2.5 px-4">SKU / Barcode</th>
                <th className="py-2.5 px-4">Product Name</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4 text-right">Cost</th>
                <th className="py-2.5 px-4 text-right">Retail</th>
                <th className="py-2.5 px-4 text-right">On Hand</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Quick Adjust & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No inventory items match the current filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.stock <= 0;
                  const isLow = p.stock > 0 && p.stock <= p.reorderLevel;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{p.sku}</div>
                        <div className="text-[11px] text-slate-400">{p.barcode}</div>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                        {p.category}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {c}
                        {p.costPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {c}
                        {p.retailPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {p.stock} {p.unit}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            isOut
                              ? 'text-red-700'
                              : isLow
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickStock(p.id, -1)}
                            disabled={p.stock <= 0}
                            className="px-2 py-1 font-mono text-[11px] font-medium border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40"
                            title="Deduct 1 unit"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickStock(p.id, 10)}
                            className="px-2 py-1 font-mono text-[11px] font-medium border border-slate-200 rounded hover:bg-slate-100"
                            title="Restock +10 units"
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 rounded hover:bg-slate-100"
                            aria-label={`Edit ${p.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100"
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 id="product-modal-title" className="text-base font-semibold text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Single-Origin Cold Brew 12oz"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="BEV-105"
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    required
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="890101005"
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as ProductCategory })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:border-blue-700"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="ea, btl, pkg"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Cost Price ({c})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 tabular-nums focus:outline-none focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Retail Price ({c})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.retailPrice}
                    onChange={(e) => setForm({ ...form, retailPrice: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 tabular-nums focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 tabular-nums focus:outline-none focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Low Stock Reorder Level
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.reorderLevel}
                    onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 tabular-nums focus:outline-none focus:border-blue-700"
                  />
                </div>
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
                  className="px-4 py-2 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
