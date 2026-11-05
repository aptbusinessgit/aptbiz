import React from 'react';
import { Download, Printer, X } from 'lucide-react';
import type { Sale, StoreSettings } from '../types/pos';

interface ThermalReceiptModalProps {
  sale: Sale;
  settings: StoreSettings;
  queuedOffline?: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      printReceipt: (options?: { silent?: boolean }) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  sale,
  settings,
  queuedOffline,
  onClose,
}) => {
  const c = settings.currencySymbol;
  const formattedDate = new Date(sale.createdAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrint = async () => {
    if (window.electronAPI?.isElectron) {
      await window.electronAPI.printReceipt({ silent: false });
    } else {
      window.print();
    }
  };

  const handleDownloadTxt = () => {
    const divider = '------------------------------------------';
    const lines: string[] = [
      settings.storeName.toUpperCase(),
      settings.address,
      `Tel: ${settings.phone} | ${settings.taxId}`,
      divider,
      `Receipt: ${sale.receiptNumber}`,
      `Date:    ${formattedDate}`,
      `Cashier: ${sale.cashierName}`,
      `Customer:${sale.customerName}`,
      sale.status === 'VOIDED' ? '*** VOIDED TRANSACTION ***' : '',
      divider,
      ...sale.items.flatMap((item) => [
        item.productName.slice(0, 42),
        `  ${item.quantity} x ${c}${item.unitPrice.toFixed(2)}`.padEnd(30) +
          `${c}${item.lineTotal.toFixed(2)}`.padStart(12),
      ]),
      divider,
      `Subtotal:`.padEnd(30) + `${c}${sale.subtotal.toFixed(2)}`.padStart(12),
      ...(sale.discountAmount > 0
        ? [`Discount:`.padEnd(30) + `-${c}${sale.discountAmount.toFixed(2)}`.padStart(12)]
        : []),
      `Tax (${sale.taxRate}%)${(sale.taxType || settings.taxType) === 'inclusive' ? ' [Incl.]' : ''}:`.padEnd(30) +
        `${c}${sale.taxAmount.toFixed(2)}`.padStart(12),
      `TOTAL:`.padEnd(30) + `${c}${sale.total.toFixed(2)}`.padStart(12),
      divider,
      `Payment (${sale.paymentMethod}):`.padEnd(30) +
        `${c}${sale.amountTendered.toFixed(2)}`.padStart(12),
      `Change Due:`.padEnd(30) + `${c}${sale.changeDue.toFixed(2)}`.padStart(12),
      divider,
      settings.receiptFooter,
      '',
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sale.receiptNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isInclusive = (sale.taxType || settings.taxType) === 'inclusive';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden">
        <div className="no-print px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="receipt-modal-title" className="text-base font-semibold text-slate-900">
              Thermal Receipt Preview
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {settings.paperWidth} roll format · {sale.receiptNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            aria-label="Close receipt preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {queuedOffline && (
          <div className="no-print px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
            Printer is set to Offline. Receipt saved to the Offline Print Queue in Settings.
          </div>
        )}

        <div className="p-6 bg-slate-100 flex justify-center max-h-[65vh] overflow-y-auto">
          <div
            className={`thermal-receipt-print-area bg-white text-slate-950 font-mono text-xs leading-relaxed p-5 border border-slate-200 shadow-sm ${
              settings.paperWidth === '58mm' ? 'w-[240px] paper-58mm' : 'w-[310px]'
            }`}
          >
            <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
              <div className="text-sm font-bold uppercase tracking-wide text-slate-950">
                {settings.storeName}
              </div>
              <div className="text-[11px] text-slate-700 mt-0.5">{settings.address}</div>
              <div className="text-[11px] text-slate-700">
                {settings.phone} · {settings.taxId}
              </div>
            </div>

            <div className="space-y-0.5 text-[11px] border-b border-dashed border-slate-300 pb-2.5 mb-2.5">
              <div className="flex justify-between">
                <span className="text-slate-600">Receipt:</span>
                <span className="font-semibold">{sale.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Date:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Cashier:</span>
                <span>{sale.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Customer:</span>
                <span>{sale.customerName}</span>
              </div>
            </div>

            {sale.status === 'VOIDED' && (
              <div className="text-center font-bold text-red-700 border border-red-300 py-1 mb-2.5 text-[11px]">
                VOIDED TRANSACTION
              </div>
            )}

            <div className="border-b border-dashed border-slate-300 pb-2.5 mb-2.5 space-y-2">
              {sale.items.map((item) => (
                <div key={item.id}>
                  <div className="font-medium text-slate-900 truncate">{item.productName}</div>
                  <div className="flex justify-between text-[11px] text-slate-700">
                    <span>
                      {item.quantity} x {c}
                      {item.unitPrice.toFixed(2)}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {c}
                      {item.lineTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2.5 mb-2.5">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span>
                  {c}
                  {sale.subtotal.toFixed(2)}
                </span>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>
                    Discount (
                    {sale.discountType === 'percent'
                      ? `${sale.discountValue}%`
                      : `${c}${sale.discountValue.toFixed(2)}`}
                    )
                  </span>
                  <span>
                    -{c}
                    {sale.discountAmount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">
                  Tax ({sale.taxRate}%){isInclusive ? ' (Incl.)' : ''}
                </span>
                <span>
                  {c}
                  {sale.taxAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-950 pt-1 border-t border-slate-200">
                <span>TOTAL</span>
                <span>
                  {c}
                  {sale.total.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-0.5 text-[11px] border-b border-dashed border-slate-300 pb-3 mb-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Paid ({sale.paymentMethod})</span>
                <span>
                  {c}
                  {sale.amountTendered.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Change Due</span>
                <span>
                  {c}
                  {sale.changeDue.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="text-center space-y-2">
              {settings.receiptBarcodeEnabled !== false && (
                <>
                  <svg
                    viewBox="0 0 180 28"
                    className="w-40 h-6 mx-auto text-slate-900"
                    aria-hidden="true"
                  >
                    {[
                      2, 5, 6, 10, 11, 14, 18, 19, 22, 26, 28, 31, 35, 36, 40, 42, 46, 48, 51,
                      55, 57, 60, 64, 65, 69, 72, 74, 78, 80, 84, 86, 89, 93, 95, 98, 102,
                      104, 108, 110, 114, 116, 120, 122, 126, 128, 132, 134, 138, 140, 144,
                      147, 150, 154, 156, 160, 163, 166, 170, 173, 176,
                    ].map((x, idx) => (
                      <rect
                        key={x}
                        x={x}
                        y="0"
                        width={idx % 3 === 0 ? '2.2' : '1.1'}
                        height="28"
                        fill="currentColor"
                      />
                    ))}
                  </svg>
                  <div className="text-[10px] text-slate-500 tracking-widest">
                    {sale.receiptNumber}
                  </div>
                </>
              )}
              <p className="text-[11px] text-slate-700 leading-snug pt-1">
                {settings.receiptFooter}
              </p>
            </div>
          </div>
        </div>

        <div className="no-print px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save Offline (.TXT)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Done
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
