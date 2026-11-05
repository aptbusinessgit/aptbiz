import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Minus,
  Plus,
  Search,
  Trash2,
  Barcode,
  CheckCircle2,
  AlertCircle,
  Volume2,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import type {
  CartItem,
  Customer,
  PaymentMethod,
  Product,
  ProductCategory,
  Sale,
  StoreSettings,
} from '../types/pos';

interface RegisterViewProps {
  products: Product[];
  customers?: Customer[];
  settings: StoreSettings;
  onSaleCompleted: (sale: Sale, queuedOffline: boolean) => void;
}

const CATEGORIES: Array<'All' | ProductCategory> = [
  'All',
  'Beverages',
  'Bakery & Pantry',
  'Snacks',
  'Household',
  'Stationery',
];

// Audio beep synthesizer using Web Audio API for scanner feedback
function playScannerBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // High pitch retail scanner beep
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // AudioContext not allowed or muted
  }
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  products,
  customers = [],
  settings,
  onSaleCompleted,
}) => {
  const [mobileTab, setMobileTab] = useState<'catalog' | 'ticket'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ProductCategory>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState(settings.defaultCustomer || 'Walk-in Customer');
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'info'; text: string } | null>(
    null
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const c = settings.currencySymbol;
  const layout = settings.posScreenLayout || 'standard';

  // Auto-focus helper to ensure barcode scanner focus is always maintained
  const focusBarcodeField = () => {
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  };

  // Auto-focus on initial mount and when POS screen becomes active
  useEffect(() => {
    focusBarcodeField();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'F2' || (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA')) {
        e.preventDefault();
        focusBarcodeField();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  const addToCart = (product: Product) => {
    setFeedback(null);
    if (!settings.allowNegativeStock && product.stock <= 0) {
      setFeedback({ type: 'error', text: `${product.name} is currently out of stock.` });
      return;
    }

    if (settings.barcodeScanBeep) {
      playScannerBeep();
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (!settings.allowNegativeStock && existing.quantity >= product.stock) {
          setFeedback({
            type: 'error',
            text: `Maximum available stock (${product.stock}) reached for ${product.name}.`,
          });
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, nextQty: number) => {
    setFeedback(null);
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const clamped = settings.allowNegativeStock
          ? nextQty
          : Math.min(nextQty, item.product.stock);

        if (!settings.allowNegativeStock && nextQty > item.product.stock) {
          setFeedback({
            type: 'error',
            text: `Only ${item.product.stock} units of ${item.product.name} in stock.`,
          });
        }
        return { ...item, quantity: clamped };
      })
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName(settings.defaultCustomer || 'Walk-in Customer');
    setDiscountValue('');
    setCashTendered('');
    setFeedback(null);
    focusBarcodeField();
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      focusBarcodeField();
      return;
    }

    const exactMatch = products.find(
      (p) => p.barcode.toLowerCase() === q || p.sku.toLowerCase() === q
    );

    if (exactMatch) {
      addToCart(exactMatch);
      setSearchQuery('');
      focusBarcodeField();
    } else if (filteredProducts.length === 1) {
      addToCart(filteredProducts[0]);
      setSearchQuery('');
      focusBarcodeField();
    } else {
      setFeedback({ type: 'info', text: `No exact barcode or SKU match for "${searchQuery}".` });
      focusBarcodeField();
    }
  };

  const subtotal = useMemo(
    () =>
      Number(
        cart
          .reduce((sum, item) => sum + item.product.retailPrice * item.quantity, 0)
          .toFixed(2)
      ),
    [cart]
  );

  const numericDiscount = Math.max(0, Number(discountValue) || 0);
  const discountAmount = useMemo(() => {
    if (numericDiscount <= 0) return 0;
    if (discountType === 'percent') {
      return Number(((subtotal * Math.min(100, numericDiscount)) / 100).toFixed(2));
    }
    return Number(Math.min(subtotal, numericDiscount).toFixed(2));
  }, [subtotal, discountType, numericDiscount]);

  // Tax Inclusive vs Exclusive Computation
  const netAfterDiscount = Math.max(0, subtotal - discountAmount);

  const { taxAmount, calculatedTotal } = useMemo(() => {
    if (settings.taxType === 'inclusive') {
      // Inclusive: Retail price already contains tax
      // Tax = Total - (Total / (1 + Rate/100))
      const totalAmount = netAfterDiscount;
      const computedTax =
        settings.taxRate > 0
          ? Number((totalAmount - totalAmount / (1 + settings.taxRate / 100)).toFixed(2))
          : 0;
      return { taxAmount: computedTax, calculatedTotal: totalAmount };
    } else {
      // Exclusive: Tax added on top of net subtotal
      const computedTax = Number(((netAfterDiscount * settings.taxRate) / 100).toFixed(2));
      return { taxAmount: computedTax, calculatedTotal: Number((netAfterDiscount + computedTax).toFixed(2)) };
    }
  }, [netAfterDiscount, settings.taxType, settings.taxRate]);

  // Optional Swedish rounding to 5 cents
  const total = useMemo(() => {
    if (settings.roundTotalToFiveCents) {
      return Number((Math.round(calculatedTotal * 20) / 20).toFixed(2));
    }
    return calculatedTotal;
  }, [calculatedTotal, settings.roundTotalToFiveCents]);

  const tenderedNum =
    paymentMethod === 'Cash'
      ? cashTendered === ''
        ? total
        : Math.max(0, Number(cashTendered) || 0)
      : total;
  const changeDue =
    paymentMethod === 'Cash' ? Number(Math.max(0, tenderedNum - total).toFixed(2)) : 0;

  const canCheckout =
    cart.length > 0 &&
    !isSubmitting &&
    (paymentMethod !== 'Cash' || cashTendered === '' || tenderedNum >= total);

  const handleCompleteSale = async () => {
    if (!canCheckout) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim() || settings.defaultCustomer || 'Walk-in Customer',
          discountType,
          discountValue: numericDiscount,
          paymentMethod,
          amountTendered: tenderedNum,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete sale.');
      }

      clearCart();
      onSaleCompleted(data.sale, Boolean(data.queuedOfflinePrint));
    } catch (err) {
      setFeedback({ type: 'error', text: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine layout grid columns based on chosen POS Screen Model
  const gridClasses = useMemo(() => {
    switch (layout) {
      case 'touchscreen':
        return 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4';
      case 'compact-scanner':
        return 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5';
      case 'split-touch':
        return 'grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-2 gap-3.5';
      case 'standard':
      default:
        return 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5';
    }
  }, [layout]);

  const asideWidthClass = useMemo(() => {
    switch (layout) {
      case 'split-touch':
        return 'w-full lg:w-[480px] xl:w-[520px]';
      case 'compact-scanner':
        return 'w-full lg:w-[380px] xl:w-[400px]';
      case 'touchscreen':
      case 'standard':
      default:
        return 'w-full lg:w-[420px] xl:w-[450px]';
    }
  }, [layout]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
      {/* Mobile Segmented View Switcher (< lg) */}
      <div className="lg:hidden p-2 bg-white border-b border-slate-200 flex items-center gap-1.5 shrink-0 z-10">
        <button
          type="button"
          onClick={() => {
            setMobileTab('catalog');
            focusBarcodeField();
          }}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'catalog'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Catalog ({filteredProducts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('ticket')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'ticket'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>
            Ticket ({cart.reduce((s, i) => s + i.quantity, 0)}) · {c}{total.toFixed(2)}
          </span>
        </button>
      </div>

      {/* Left / Center: Catalog & Barcode Scanner */}
      <section
        className={`flex-1 flex-col min-w-0 bg-slate-50 overflow-hidden ${
          mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {/* Top Search & Category Filter */}
        <div className="p-3 sm:p-5 pb-3 sm:pb-4 bg-white border-b border-slate-200 space-y-2.5 sm:space-y-3.5 shrink-0">
          <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode, SKU, or name (/ or F2)"
                className="w-full pl-9 sm:pl-10 pr-16 sm:pr-24 py-2 sm:py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
              />
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-mono text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Barcode className="w-3.5 h-3.5" />
                <span>Enter</span>
              </span>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  focusBarcodeField();
                }}
                className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg bg-white whitespace-nowrap shrink-0"
              >
                Clear
              </button>
            )}
          </form>

          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
            role="tablist"
            aria-label="Product Categories"
          >
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedCategory(cat);
                    focusBarcodeField();
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                >
                  {cat === 'All' ? 'All Items' : cat}
                </button>
              );
            })}
          </div>
        </div>

        {feedback && (
          <div
            className={`mx-3 sm:mx-5 mt-3 sm:mt-4 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border text-xs flex items-center justify-between ${
              feedback.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-medium underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-slate-300 rounded-xl bg-white p-6">
              <p className="text-sm font-medium text-slate-900">No matching products found</p>
              <p className="text-xs text-slate-500 mt-1">
                Try clearing your search filter or switching categories.
              </p>
            </div>
          ) : (
            <div className={gridClasses}>
              {filteredProducts.map((product) => {
                const isOut = !settings.allowNegativeStock && product.stock <= 0;
                const isLow = product.stock > 0 && product.stock <= product.reorderLevel;
                const inCartQty =
                  cart.find((item) => item.product.id === product.id)?.quantity || 0;

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={isOut}
                    onClick={() => addToCart(product)}
                    className={`text-left p-3 sm:p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      layout === 'touchscreen' ? 'min-h-[128px] sm:min-h-[136px]' : 'min-h-[110px] sm:min-h-[116px]'
                    } ${
                      isOut
                        ? 'bg-slate-100/80 border-slate-200 opacity-60 cursor-not-allowed'
                        : 'bg-white border-slate-200 hover:border-blue-700 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 active:scale-[0.99]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                          {product.name}
                        </h3>
                        {inCartQty > 0 && (
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                            ×{inCartQty}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 font-mono">
                        <span>{product.sku}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            isOut
                              ? 'text-red-700 font-medium'
                              : isLow
                              ? 'text-amber-700 font-medium'
                              : 'text-slate-600'
                          }
                        >
                          {isOut
                            ? 'Out of stock'
                            : isLow
                            ? `Low (${product.stock})`
                            : `${product.stock} ${product.unit}`}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs text-slate-500 truncate mr-2">
                        {product.category}
                      </span>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                          {c}
                          {product.retailPrice.toFixed(2)}
                        </span>
                        {settings.taxType === 'inclusive' && (
                          <span className="block text-[9px] sm:text-[10px] text-slate-400">
                            incl. tax
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Floating Mobile Checkout CTA if cart has items */}
        {cart.length > 0 && (
          <div className="lg:hidden p-3 bg-white/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-between gap-3 shadow-lg shrink-0 z-10">
            <div className="min-w-0">
              <div className="text-[11px] text-slate-500 truncate">
                {cart.reduce((s, i) => s + i.quantity, 0)} items in ticket
              </div>
              <div className="font-mono text-base font-bold text-slate-900 tabular-nums">
                {c}{total.toFixed(2)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileTab('ticket')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 shadow-sm"
            >
              <span>Review & Pay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* Right: Current Ticket & Checkout */}
      <aside
        className={`${asideWidthClass} bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex-col shrink-0 min-h-0 ${
          mobileTab === 'ticket' ? 'flex flex-1' : 'hidden lg:flex'
        }`}
      >
        {/* Mobile Header in Ticket View */}
        <div className="lg:hidden px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              setMobileTab('catalog');
              focusBarcodeField();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Products</span>
          </button>
          <span className="text-xs font-semibold text-blue-700 font-mono tabular-nums">
            Total: {c}{total.toFixed(2)}
          </span>
        </div>

        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">Current Ticket</h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {cart.reduce((s, i) => s + i.quantity, 0)} items · Shift: {settings.cashierName}
            </p>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-medium text-slate-500 hover:text-red-700 transition-colors"
            >
              Clear Ticket
            </button>
          )}
        </div>

        {/* Cart Line Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-4 sm:px-5">
          {cart.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-slate-700">Ticket is empty</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                Scan barcode or select items from catalog to start billing.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const lineTotal = item.product.retailPrice * item.quantity;
              return (
                <div key={item.product.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {item.product.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5 tabular-nums">
                      {c}
                      {item.product.retailPrice.toFixed(2)} / {item.product.unit}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                      aria-label={`Decrease quantity of ${item.product.name}`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={settings.allowNegativeStock ? 99999 : item.product.stock}
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.product.id, parseInt(e.target.value, 10) || 1)
                      }
                      className="w-11 h-7 text-center font-mono text-xs font-semibold border border-slate-200 rounded text-slate-900 tabular-nums focus:outline-none focus:border-blue-700"
                      aria-label={`Quantity of ${item.product.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                      aria-label={`Increase quantity of ${item.product.name}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-20 text-right font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {c}
                    {lineTotal.toFixed(2)}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                    aria-label={`Remove ${item.product.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Totals & Payment Controls */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-4 shrink-0">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Customer (Optional)
              </label>
              <input
                type="text"
                list="registered-customers-list"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
              />
              <datalist id="registered-customers-list">
                {customers?.map((cust) => (
                  <option key={cust.id} value={cust.name}>
                    {cust.phone ? `${cust.phone} · ` : ''}{cust.email || ''}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Discount</label>
              <div className="flex">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-l-lg text-slate-900 tabular-nums focus:outline-none focus:border-blue-700"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDiscountType((prev) => (prev === 'fixed' ? 'percent' : 'fixed'))
                  }
                  className="px-2.5 py-1.5 text-xs font-mono font-semibold bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-slate-700 hover:bg-slate-200"
                  title="Toggle fixed amount or percentage discount"
                >
                  {discountType === 'fixed' ? c : '%'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs border-t border-slate-200 pt-3">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">
                {c}
                {subtotal.toFixed(2)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>Discount</span>
                <span className="font-mono tabular-nums">
                  -{c}
                  {discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>
                Tax ({settings.taxRate}%)
                <span className="text-[10px] text-slate-400 ml-1">
                  ({settings.taxType === 'inclusive' ? 'Inclusive' : 'Added'})
                </span>
              </span>
              <span className="font-mono tabular-nums">
                {c}
                {taxAmount.toFixed(2)}
              </span>
            </div>
            {settings.roundTotalToFiveCents && (
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>5¢ Cash Rounding</span>
                <span className="font-mono tabular-nums">
                  {total > calculatedTotal ? '+' : ''}{c}{(total - calculatedTotal).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-900 pt-1.5 border-t border-slate-200">
              <span>Total Due</span>
              <span className="font-mono tabular-nums text-lg text-blue-700">
                {c}
                {total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-lg">
              {(['Cash', 'Card', 'Split'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    paymentMethod === method
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {paymentMethod === 'Cash' && cart.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-slate-600 shrink-0">
                    Cash Tendered
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={total.toFixed(2)}
                    className="w-32 px-3 py-1.5 text-right font-mono text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-900 tabular-nums focus:outline-none focus:border-blue-700"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'Exact', val: total },
                    { label: `${c}10`, val: 10 },
                    { label: `${c}20`, val: 20 },
                    { label: `${c}50`, val: 50 },
                    { label: `${c}100`, val: 100 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setCashTendered(preset.val.toFixed(2))}
                      className="flex-1 py-1 text-xs font-mono font-medium bg-white border border-slate-200 hover:border-slate-300 rounded text-slate-700"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs font-medium pt-0.5">
                  <span className="text-slate-600">Change Due</span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      cashTendered !== '' && tenderedNum < total
                        ? 'text-red-600'
                        : 'text-emerald-700'
                    }`}
                  >
                    {cashTendered !== '' && tenderedNum < total
                      ? `Short ${c}${(total - tenderedNum).toFixed(2)}`
                      : `${c}${changeDue.toFixed(2)}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!canCheckout}
            onClick={handleCompleteSale}
            className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Processing Sale...'
                : `Complete Sale · ${c}${total.toFixed(2)}`}
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
};
