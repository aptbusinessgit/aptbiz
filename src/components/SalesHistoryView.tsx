import React, { useMemo, useState } from 'react';
import { Printer, RotateCcw, Search } from 'lucide-react';
import type { Sale, StoreSettings } from '../types/pos';

interface SalesHistoryViewProps {
  sales: Sale[];
  settings: StoreSettings;
  onReprintSale: (sale: Sale) => void;
  onVoidSale: (saleId: number) => Promise<void>;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  sales,
  settings,
  onReprintSale,
  onVoidSale,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'VOIDED'>('ALL');
  const [voidingId, setVoidingId] = useState<number | null>(null);

  const c = settings.currencySymbol;

  const summary = useMemo(() => {
    const completed = sales.filter((s) => s.status === 'COMPLETED');
    const grossSales = completed.reduce((sum, s) => sum + s.total, 0);
    const avgTicket = completed.length > 0 ? grossSales / completed.length : 0;
    const voidedCount = sales.filter((s) => s.status === 'VOIDED').length;
    return {
      grossSales,
      completedCount: completed.length,
      avgTicket,
      voidedCount,
    };
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (search.trim() !== '') {
        const q = search.trim().toLowerCase();
        return (
          s.receiptNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.cashierName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sales, statusFilter, search]);

  const handleVoid = async (saleId: number) => {
    setVoidingId(saleId);
    try {
      await onVoidSale(saleId);
    } finally {
      setVoidingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Gross Sales</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {c}
            {summary.grossSales.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Completed Tickets</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {summary.completedCount}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Average Ticket</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {c}
            {summary.avgTicket.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs font-medium text-slate-500">Voided Tickets</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-600 tabular-nums">
            {summary.voidedCount}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipt #, customer, or cashier..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-700"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(['ALL', 'COMPLETED', 'VOIDED'] as const).map((status) => (
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
                {status === 'ALL'
                  ? 'All Receipts'
                  : status === 'COMPLETED'
                  ? 'Completed'
                  : 'Voided'}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Sales Cards View (< md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredSales.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No sales transactions found.
            </div>
          ) : (
            filteredSales.map((sale) => {
              const itemCount = sale.items.reduce((sum, i) => sum + i.quantity, 0);
              const dateStr = new Date(sale.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={sale.id} className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono font-semibold text-slate-900 text-xs">
                        {sale.receiptNumber}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {dateStr} · {sale.customerName}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded shrink-0 ${
                        sale.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {sale.status === 'COMPLETED' ? 'Completed' : 'Voided'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div className="text-[11px] text-slate-600">
                      {itemCount} items · {sale.paymentMethod}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {c}{sale.total.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onReprintSale(sale)}
                        className="p-1 text-slate-600 hover:text-blue-700 border border-slate-200 rounded"
                        title="Reprint receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {sale.status === 'COMPLETED' && (
                        <button
                          type="button"
                          disabled={voidingId === sale.id}
                          onClick={() => handleVoid(sale.id)}
                          className="p-1 text-slate-400 hover:text-red-700 border border-slate-200 rounded disabled:opacity-40"
                          title="Void transaction"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                <th className="py-2.5 px-4">Receipt #</th>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Customer</th>
                <th className="py-2.5 px-4">Items</th>
                <th className="py-2.5 px-4">Payment</th>
                <th className="py-2.5 px-4 text-right">Total</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No sales transactions found.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const itemCount = sale.items.reduce((sum, i) => sum + i.quantity, 0);
                  const dateStr = new Date(sale.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {sale.receiptNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 text-slate-900">
                        <div>{sale.customerName}</div>
                        <div className="text-[11px] text-slate-400">
                          Cashier: {sale.cashierName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono tabular-nums whitespace-nowrap">
                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {sale.paymentMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {c}
                        {sale.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            sale.status === 'VOIDED'
                              ? 'text-red-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {sale.status === 'VOIDED' ? 'Voided' : 'Paid'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onReprintSale(sale)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-blue-700 hover:text-blue-700 rounded-lg transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                          {sale.status === 'COMPLETED' && (
                            <button
                              type="button"
                              disabled={voidingId === sale.id}
                              onClick={() => handleVoid(sale.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Void sale and restore inventory"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Void</span>
                            </button>
                          )}
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
    </div>
  );
};
