export type ProductCategory =
  | 'Beverages'
  | 'Bakery & Pantry'
  | 'Household'
  | 'Stationery'
  | 'Snacks';

export type UserRole = 'admin' | 'cashier';

export type TaxType = 'inclusive' | 'exclusive';

export type PosScreenLayout = 'standard' | 'touchscreen' | 'compact-scanner' | 'split-touch';

export interface UserSession {
  username: string;
  role: UserRole;
  displayName: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
  totalSpent: number;
  ordersCount: number;
}

export interface Vendor {
  id: number;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxNumber: string;
  createdAt: string;
  totalPurchased: number;
  purchasesCount: number;
}

export interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  category: ProductCategory;
  costPrice: number;
  retailPrice: number;
  stock: number;
  reorderLevel: number;
  unit: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type PaymentMethod = 'Cash' | 'Card' | 'Split';

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Sale {
  id: number;
  receiptNumber: string;
  createdAt: string;
  cashierName: string;
  customerName: string;
  customerId?: number | null;
  subtotal: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  discountAmount: number;
  taxType?: TaxType;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  changeDue: number;
  status: 'COMPLETED' | 'VOIDED';
  items: SaleItem[];
}

export interface PurchaseItem {
  id: number;
  purchaseId: number;
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseEntry {
  id: number;
  invoiceNumber: string;
  vendorId: number;
  vendorName: string;
  createdAt: string;
  receivedDate: string;
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  total: number;
  paymentStatus: 'PAID' | 'PENDING' | 'PARTIAL';
  notes: string;
  items: PurchaseItem[];
}

export interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
  taxId: string;
  taxRate: number;
  taxType: TaxType; // 'inclusive' (tax included in retail price) or 'exclusive' (tax added on top)
  currencySymbol: string;
  receiptFooter: string;
  paperWidth: '80mm' | '58mm';
  printerOnline: boolean;
  cashierName: string;

  // POS Screen & Layout Models
  posScreenLayout: PosScreenLayout;

  // Operational & Sales Settings
  barcodeScanBeep: boolean;
  allowNegativeStock: boolean;
  roundTotalToFiveCents: boolean;
  autoPrintReceiptOnSale: boolean;
  receiptBarcodeEnabled: boolean;
  enableStockAlertsOnCheckout: boolean;
  defaultCustomer: string;
}

export interface PrintJob {
  id: number;
  saleId: number;
  receiptNumber: string;
  createdAt: string;
  total: number;
  status: 'QUEUED' | 'PRINTED';
}
