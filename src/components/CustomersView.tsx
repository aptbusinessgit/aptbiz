import React, { useMemo, useState } from 'react';
import {
  Download,
  Edit2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X
} from 'lucide-react';
import type { Customer, StoreSettings } from '../types/pos';

interface CustomersViewProps {
  customers: Customer[];
  settings: StoreSettings;
  onRefresh: () => Promise<void>;
}

interface CustomerFormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const EMPTY_FORM: CustomerFormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  settings,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const c = settings.currencySymbol;

  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter(
      (cust) =>
        cust.name.toLowerCase().includes(q) ||
        cust.phone.toLowerCase().includes(q) ||
        cust.email.toLowerCase().includes(q) ||
        cust.address.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const stats = useMemo(() => {
    const totalCount = customers.length;
    const totalSpent = customers.reduce((sum, cust) => sum + (cust.totalSpent || 0), 0);
    const avgSpent = totalCount > 0 ? totalSpent / totalCount : 0;
    return { totalCount, totalSpent, avgSpent };
  }, [customers]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setForm({
      name: cust.name,
      phone: cust.phone,
      email: cust.email,
      address: cust.address,
      notes: cust.notes,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Customer name is required.');
      return;
    }

    setSaving(true);
    try {
      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save customer.');
      }

      await onRefresh();
      setModalOpen(false);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cust: Customer) => {
    if (cust.name === 'Walk-in Customer') {
      setActionNotice('Default Walk-in Customer cannot be removed.');
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }
    await fetch(`/api/customers/${cust.id}`, { method: 'DELETE' });
    await onRefresh();
  };

  const handleExportCsv = () => {
    const headers = ['Name', 'Phone', 'Email', 'Address', 'Total Spent', 'Orders Count', 'Notes'];
    const rows = filtered.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${c.email}"`,
      `"${c.address.replace(/"/g, '""')}"`,
      c.totalSpent.toFixed(2),
      c.ordersCount,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50">
      {actionNotice && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
          {actionNotice}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Registered Customers</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {stats.totalCount}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Cumulative Revenue</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {c}
            {stats.totalSpent.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Average Lifetime Value</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {c}
            {stats.avgSpent.toFixed(2)}
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
              placeholder="Search customer name, phone, or email..."
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
              <span>New Customer</span>
            </button>
          </div>
        </div>

        {/* Mobile Customer Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No customer accounts found. Click "New Customer" to register one.
            </div>
          ) : (
            filtered.map((cust) => (
              <div key={cust.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{cust.name}</span>
                    </div>
                    {cust.phone && (
                      <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                        {cust.phone}
                      </div>
                    )}
                    {cust.email && (
                      <div className="text-[11px] text-slate-500 truncate">
                        {cust.email}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(cust)}
                      className="p-1.5 text-slate-600 hover:text-blue-700 rounded hover:bg-slate-100"
                      aria-label={`Edit ${cust.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {cust.name !== 'Walk-in Customer' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(cust)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100"
                        aria-label={`Delete ${cust.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {cust.ordersCount} {cust.ordersCount === 1 ? 'order' : 'orders'}
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {c}{cust.totalSpent.toFixed(2)}
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
                <th className="py-2.5 px-4">Customer Name</th>
                <th className="py-2.5 px-4">Phone</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Address</th>
                <th className="py-2.5 px-4 text-right">Orders</th>
                <th className="py-2.5 px-4 text-right">Total Spent</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No customer accounts found. Click "New Customer" to register one.
                  </td>
                </tr>
              ) : (
                filtered.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{cust.name}</span>
                      </div>
                      {cust.notes && (
                        <div className="text-[11px] text-slate-400 pl-6 line-clamp-1">
                          {cust.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {cust.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{cust.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {cust.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{cust.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {cust.address ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{cust.address}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {cust.ordersCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {c}
                      {cust.totalSpent.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(cust)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded transition-colors"
                          aria-label={`Edit ${cust.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {cust.name !== 'Walk-in Customer' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(cust)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-colors"
                            aria-label={`Delete ${cust.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 id="customer-modal-title" className="text-base font-semibold text-slate-900">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
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
                <label className="block font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Marcus Vance"
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
                    placeholder="(503) 555-0199"
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Billing / Delivery Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Street, City, State, ZIP"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Preferences & Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Loyalty preferences, store credit notes, or special instructions"
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
                  className="px-4 py-2 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
