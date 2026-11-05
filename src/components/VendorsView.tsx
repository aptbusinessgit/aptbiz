import React, { useMemo, useState } from 'react';
import {
  Building2,
  Download,
  Edit2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import type { StoreSettings, Vendor } from '../types/pos';

interface VendorsViewProps {
  vendors: Vendor[];
  settings: StoreSettings;
  onRefresh: () => Promise<void>;
}

interface VendorFormState {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxNumber: string;
}

const EMPTY_FORM: VendorFormState = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  taxNumber: '',
};

export const VendorsView: React.FC<VendorsViewProps> = ({
  vendors,
  settings,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const c = settings.currencySymbol;

  const [vendorNotice, setVendorNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return vendors;
    const q = search.trim().toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.contactPerson.toLowerCase().includes(q) ||
        v.phone.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q) ||
        v.taxNumber.toLowerCase().includes(q)
    );
  }, [vendors, search]);

  const stats = useMemo(() => {
    const totalCount = vendors.length;
    const totalPurchased = vendors.reduce(
      (sum, v) => sum + (v.totalPurchased || 0),
      0
    );
    const totalInvoices = vendors.reduce(
      (sum, v) => sum + (v.purchasesCount || 0),
      0
    );
    return { totalCount, totalPurchased, totalInvoices };
  }, [vendors]);

  const openCreateModal = () => {
    setEditingVendor(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (vend: Vendor) => {
    setEditingVendor(vend);
    setForm({
      name: vend.name,
      contactPerson: vend.contactPerson,
      phone: vend.phone,
      email: vend.email,
      address: vend.address,
      taxNumber: vend.taxNumber,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Supplier / Vendor name is required.');
      return;
    }

    setSaving(true);
    try {
      const url = editingVendor ? `/api/vendors/${editingVendor.id}` : '/api/vendors';
      const method = editingVendor ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save vendor.');
      }

      await onRefresh();
      setModalOpen(false);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vend: Vendor) => {
    if (vend.purchasesCount > 0) {
      setVendorNotice(
        `Vendor "${vend.name}" is linked to ${vend.purchasesCount} purchase orders. Delete the purchases first.`
      );
      setTimeout(() => setVendorNotice(null), 4000);
      return;
    }
    await fetch(`/api/vendors/${vend.id}`, { method: 'DELETE' });
    await onRefresh();
  };

  const handleExportCsv = () => {
    const headers = [
      'Vendor Name',
      'Contact Person',
      'Phone',
      'Email',
      'Address',
      'Tax Number',
      'Total Purchased',
      'Invoices Count',
    ];
    const rows = filtered.map((v) => [
      `"${v.name.replace(/"/g, '""')}"`,
      `"${v.contactPerson.replace(/"/g, '""')}"`,
      `"${v.phone}"`,
      `"${v.email}"`,
      `"${v.address.replace(/"/g, '""')}"`,
      `"${v.taxNumber}"`,
      v.totalPurchased.toFixed(2),
      v.purchasesCount,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50">
      {vendorNotice && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
          {vendorNotice}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Active Suppliers</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {stats.totalCount}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Total Purchase Volume</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {c}
            {stats.totalPurchased.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Recorded PO Invoices</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {stats.totalInvoices}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor name, contact, or phone..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-700"
            />
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
              <span>New Vendor</span>
            </button>
          </div>
        </div>

        {/* Mobile Vendors Cards View (< md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No suppliers registered yet. Click "New Vendor" to add one.
            </div>
          ) : (
            filtered.map((vend) => (
              <div key={vend.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{vend.name}</span>
                    </div>
                    {vend.contactPerson && (
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Contact: {vend.contactPerson}
                      </div>
                    )}
                    {vend.phone && (
                      <div className="text-[11px] text-slate-500 font-mono">
                        {vend.phone}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(vend)}
                      className="p-1.5 text-slate-600 hover:text-blue-700 rounded hover:bg-slate-100"
                      aria-label={`Edit ${vend.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(vend)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100"
                      aria-label={`Delete ${vend.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {vend.purchasesCount} {vend.purchasesCount === 1 ? 'invoice' : 'invoices'}
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {c}{vend.totalPurchased.toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Vendor Company</th>
                <th className="py-2.5 px-4">Contact Person</th>
                <th className="py-2.5 px-4">Contact Details</th>
                <th className="py-2.5 px-4">Tax / EIN</th>
                <th className="py-2.5 px-4 text-right">Invoices</th>
                <th className="py-2.5 px-4 text-right">Total Purchased</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No vendor suppliers found. Click "New Vendor" to register a supplier.
                  </td>
                </tr>
              ) : (
                filtered.map((vend) => (
                  <tr key={vend.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{vend.name}</span>
                      </div>
                      {vend.address && (
                        <div className="text-[11px] text-slate-400 pl-6 flex items-center gap-1 mt-0.5 truncate max-w-xs">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{vend.address}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {vend.contactPerson || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <div className="space-y-0.5">
                        {vend.phone && (
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{vend.phone}</span>
                          </div>
                        )}
                        {vend.email && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{vend.email}</span>
                          </div>
                        )}
                        {!vend.phone && !vend.email && <span>—</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {vend.taxNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {vend.purchasesCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {c}
                      {vend.totalPurchased.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(vend)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded transition-colors"
                          aria-label={`Edit ${vend.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(vend)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-colors"
                          aria-label={`Delete ${vend.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vendor-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 id="vendor-modal-title" className="text-base font-semibold text-slate-900">
                {editingVendor ? 'Edit Vendor Supplier' : 'Add New Vendor Supplier'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">Company / Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Cascade Roast & Beverages"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Contact Representative</label>
                <input
                  type="text"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  placeholder="e.g., Sarah Jenkins (Account Manager)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(503) 555-4410"
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="orders@cascaderoast.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tax ID / Business EIN</label>
                  <input
                    type="text"
                    value={form.taxNumber}
                    onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                    placeholder="TAX-992101"
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">City / State</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Portland, OR"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
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
                  {saving ? 'Saving...' : editingVendor ? 'Save Changes' : 'Create Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
