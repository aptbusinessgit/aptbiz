import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import type {
  Customer,
  PaymentMethod,
  PrintJob,
  Product,
  ProductCategory,
  PurchaseEntry,
  PurchaseItem,
  Sale,
  SaleItem,
  StoreSettings,
  Vendor,
} from '../src/types/pos';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'pos.sqlite');

let db: Database | null = null;

function saveDatabase(): void {
  if (!db) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  initSchema(db);
  seedInitialData(db);
  saveDatabase();
  return db;
}

function initSchema(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      retail_price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 5,
      unit TEXT NOT NULL DEFAULT 'ea',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
      subtotal REAL NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'fixed',
      discount_value REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 8.5,
      tax_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      amount_tendered REAL NOT NULL,
      change_due REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'COMPLETED'
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS print_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      receipt_number TEXT NOT NULL,
      created_at TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'QUEUED'
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      tax_number TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      vendor_id INTEGER NOT NULL,
      vendor_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      received_date TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax_amount REAL NOT NULL DEFAULT 0,
      shipping_cost REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'PAID',
      notes TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id)
    );
  `);
}

function seedInitialData(database: Database): void {
  const settingsCountRes = database.exec('SELECT COUNT(*) as cnt FROM settings');
  const settingsCount = Number(settingsCountRes[0]?.values[0]?.[0] ?? 0);

  if (settingsCount === 0) {
    const defaultSettings: Record<string, string> = {
      storeName: 'Northside General Store',
      address: '418 Oakwood Ave, Suite 102, Portland, OR 97205',
      phone: '(503) 555-0194',
      taxId: 'EIN 84-2910482',
      taxRate: '8.5',
      currencySymbol: '$',
      receiptFooter: 'Thank you for shopping local! Returns accepted within 14 days with receipt.',
      paperWidth: '80mm',
      printerOnline: 'true',
      cashierName: 'Maya Lin',
    };

    const stmt = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(defaultSettings)) {
      stmt.run([k, v]);
    }
    stmt.free();
  }

  const usersCountRes = database.exec('SELECT COUNT(*) as cnt FROM users');
  const usersCount = Number(usersCountRes[0]?.values[0]?.[0] ?? 0);

  if (usersCount === 0) {
    const userStmt = database.prepare(
      'INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)'
    );
    // Default admin: admin / admin
    userStmt.run(['admin', 'admin', 'admin', 'Store Administrator']);
    // Default cashier: cashier / 1234
    userStmt.run(['cashier', '1234', 'cashier', 'Maya Lin (Cashier)']);
    userStmt.free();
  }

  const customersCountRes = database.exec('SELECT COUNT(*) as cnt FROM customers');
  const customersCount = Number(customersCountRes[0]?.values[0]?.[0] ?? 0);
  if (customersCount === 0) {
    const custStmt = database.prepare(
      'INSERT INTO customers (name, phone, email, address, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const now = new Date().toISOString();
    custStmt.run(['Walk-in Customer', '', '', '', 'Default retail walk-in', now]);
    custStmt.run(['Elena Vance', '(503) 555-0182', 'elena.vance@example.com', '742 Evergreen Terr, Portland, OR', 'Loyal weekly customer', now]);
    custStmt.run(['Marcus Brody', '(503) 555-0249', 'mbrody@museum.org', '1200 Museum Way, Portland, OR', 'Prefers sourdough and olive oil', now]);
    custStmt.free();
  }

  const vendorsCountRes = database.exec('SELECT COUNT(*) as cnt FROM vendors');
  const vendorsCount = Number(vendorsCountRes[0]?.values[0]?.[0] ?? 0);
  if (vendorsCount === 0) {
    const vendStmt = database.prepare(
      'INSERT INTO vendors (name, contact_person, phone, email, address, tax_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const now = new Date().toISOString();
    vendStmt.run(['Cascade Roast & Beverages', 'Sarah Jenkins', '(503) 555-4410', 'orders@cascaderoast.com', '108 Industrial Way, Portland, OR', 'TAX-992101', now]);
    vendStmt.run(['Willamette Artisan Bakery', 'Julian Cole', '(503) 555-8821', 'supply@willamettebakery.com', '54 Mill St, Eugene, OR', 'TAX-772910', now]);
    vendStmt.run(['Pacific Goods Supply Co.', 'David Park', '(206) 555-3392', 'pacific@goodsdist.com', '900 Harbor Ave, Seattle, WA', 'TAX-881920', now]);
    vendStmt.free();
  }

  const productCountRes = database.exec('SELECT COUNT(*) as cnt FROM products');
  const productCount = Number(productCountRes[0]?.values[0]?.[0] ?? 0);

  if (productCount === 0) {
    const now = new Date().toISOString();
    const initialProducts: Array<Omit<Product, 'id' | 'updatedAt'>> = [
      {
        sku: 'BEV-101',
        barcode: '890101001',
        name: 'Single-Origin Cold Brew 12oz',
        category: 'Beverages',
        costPrice: 1.85,
        retailPrice: 4.5,
        stock: 34,
        reorderLevel: 10,
        unit: 'btl',
      },
      {
        sku: 'BEV-102',
        barcode: '890101002',
        name: 'Sparkling Yuzu Mineral Water',
        category: 'Beverages',
        costPrice: 1.1,
        retailPrice: 2.75,
        stock: 48,
        reorderLevel: 12,
        unit: 'can',
      },
      {
        sku: 'BEV-103',
        barcode: '890101003',
        name: 'Organic Matcha Oat Latte 8oz',
        category: 'Beverages',
        costPrice: 2.1,
        retailPrice: 4.95,
        stock: 6,
        reorderLevel: 8,
        unit: 'can',
      },
      {
        sku: 'BEV-104',
        barcode: '890101004',
        name: 'Pressed Honeycrisp Apple Juice',
        category: 'Beverages',
        costPrice: 2.4,
        retailPrice: 5.5,
        stock: 19,
        reorderLevel: 6,
        unit: 'btl',
      },
      {
        sku: 'BAK-201',
        barcode: '890202001',
        name: 'Country Sourdough Boule',
        category: 'Bakery & Pantry',
        costPrice: 3.2,
        retailPrice: 7.5,
        stock: 12,
        reorderLevel: 5,
        unit: 'loaf',
      },
      {
        sku: 'BAK-202',
        barcode: '890202002',
        name: 'Cultured Sea Salt Butter 250g',
        category: 'Bakery & Pantry',
        costPrice: 3.6,
        retailPrice: 6.95,
        stock: 22,
        reorderLevel: 8,
        unit: 'pkg',
      },
      {
        sku: 'BAK-203',
        barcode: '890202003',
        name: 'Wildflower Raw Honey Jar 12oz',
        category: 'Bakery & Pantry',
        costPrice: 6.5,
        retailPrice: 13.5,
        stock: 4,
        reorderLevel: 6,
        unit: 'jar',
      },
      {
        sku: 'BAK-204',
        barcode: '890202004',
        name: 'Extra Virgin Olive Oil 500ml',
        category: 'Bakery & Pantry',
        costPrice: 9.8,
        retailPrice: 18.95,
        stock: 15,
        reorderLevel: 5,
        unit: 'btl',
      },
      {
        sku: 'SNK-301',
        barcode: '890303001',
        name: 'Dark Chocolate Sea Salt Bar 70%',
        category: 'Snacks',
        costPrice: 2.25,
        retailPrice: 4.95,
        stock: 41,
        reorderLevel: 10,
        unit: 'bar',
      },
      {
        sku: 'SNK-302',
        barcode: '890303002',
        name: 'Roasted Rosemary Almonds 150g',
        category: 'Snacks',
        costPrice: 3.1,
        retailPrice: 6.5,
        stock: 27,
        reorderLevel: 8,
        unit: 'bag',
      },
      {
        sku: 'SNK-303',
        barcode: '890303003',
        name: 'Kettle Cooked Jalapeno Chips',
        category: 'Snacks',
        costPrice: 1.65,
        retailPrice: 3.75,
        stock: 0,
        reorderLevel: 10,
        unit: 'bag',
      },
      {
        sku: 'SNK-304',
        barcode: '890303004',
        name: 'Dried Mango Slices Unsweetened',
        category: 'Snacks',
        costPrice: 2.9,
        retailPrice: 5.95,
        stock: 16,
        reorderLevel: 6,
        unit: 'bag',
      },
      {
        sku: 'HOU-401',
        barcode: '890404001',
        name: 'Beeswax Taper Candles (Pair)',
        category: 'Household',
        costPrice: 4.5,
        retailPrice: 11.0,
        stock: 18,
        reorderLevel: 6,
        unit: 'pair',
      },
      {
        sku: 'HOU-402',
        barcode: '890404002',
        name: 'Castile Lavender Dish Soap 16oz',
        category: 'Household',
        costPrice: 4.2,
        retailPrice: 8.95,
        stock: 21,
        reorderLevel: 6,
        unit: 'btl',
      },
      {
        sku: 'HOU-403',
        barcode: '890404003',
        name: 'Woven Linen Kitchen Towel',
        category: 'Household',
        costPrice: 5.5,
        retailPrice: 14.5,
        stock: 3,
        reorderLevel: 5,
        unit: 'ea',
      },
      {
        sku: 'STA-501',
        barcode: '890505001',
        name: 'Dot-Grid Hardcover Notebook A5',
        category: 'Stationery',
        costPrice: 6.0,
        retailPrice: 14.0,
        stock: 25,
        reorderLevel: 8,
        unit: 'ea',
      },
      {
        sku: 'STA-502',
        barcode: '890505002',
        name: 'Fine-Point Gel Ink Pen 0.5mm',
        category: 'Stationery',
        costPrice: 1.2,
        retailPrice: 3.25,
        stock: 54,
        reorderLevel: 15,
        unit: 'ea',
      },
      {
        sku: 'STA-503',
        barcode: '890505003',
        name: 'Heavyweight Kraft Gift Bag',
        category: 'Stationery',
        costPrice: 0.75,
        retailPrice: 2.25,
        stock: 60,
        reorderLevel: 15,
        unit: 'ea',
      },
    ];

    const stmt = database.prepare(`
      INSERT INTO products (sku, barcode, name, category, cost_price, retail_price, stock, reorder_level, unit, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of initialProducts) {
      stmt.run([
        p.sku,
        p.barcode,
        p.name,
        p.category,
        p.costPrice,
        p.retailPrice,
        p.stock,
        p.reorderLevel,
        p.unit,
        now,
      ]);
    }
    stmt.free();
  }

  const salesCountRes = database.exec('SELECT COUNT(*) as cnt FROM sales');
  const salesCount = Number(salesCountRes[0]?.values[0]?.[0] ?? 0);

  if (salesCount === 0) {
    const now = Date.now();
    const sampleSales = [
      {
        receiptNumber: 'RCP-2026-1001',
        createdAt: new Date(now - 3600 * 1000 * 3).toISOString(),
        cashierName: 'Maya Lin',
        customerName: 'Walk-in Customer',
        subtotal: 16.5,
        discountType: 'fixed',
        discountValue: 0,
        discountAmount: 0,
        taxRate: 8.5,
        taxAmount: 1.4,
        total: 17.9,
        paymentMethod: 'Card',
        amountTendered: 17.9,
        changeDue: 0,
        items: [
          { productId: 1, sku: 'BEV-101', productName: 'Single-Origin Cold Brew 12oz', quantity: 2, unitPrice: 4.5, lineTotal: 9.0 },
          { productId: 5, sku: 'BAK-201', productName: 'Country Sourdough Boule', quantity: 1, unitPrice: 7.5, lineTotal: 7.5 },
        ],
      },
      {
        receiptNumber: 'RCP-2026-1002',
        createdAt: new Date(now - 3600 * 1000 * 1.5).toISOString(),
        cashierName: 'Maya Lin',
        customerName: 'Elena Vance',
        subtotal: 28.95,
        discountType: 'fixed',
        discountValue: 0,
        discountAmount: 0,
        taxRate: 8.5,
        taxAmount: 2.46,
        total: 31.41,
        paymentMethod: 'Cash',
        amountTendered: 40.0,
        changeDue: 8.59,
        items: [
          { productId: 8, sku: 'BAK-204', productName: 'Extra Virgin Olive Oil 500ml', quantity: 1, unitPrice: 18.95, lineTotal: 18.95 },
          { productId: 9, sku: 'SNK-301', productName: 'Dark Chocolate Sea Salt Bar 70%', quantity: 2, unitPrice: 4.95, lineTotal: 9.9 },
        ],
      },
      {
        receiptNumber: 'RCP-2026-1003',
        createdAt: new Date(now - 1800 * 1000).toISOString(),
        cashierName: 'Maya Lin',
        customerName: 'Walk-in Customer',
        subtotal: 17.25,
        discountType: 'fixed',
        discountValue: 0,
        discountAmount: 0,
        taxRate: 8.5,
        taxAmount: 1.47,
        total: 18.72,
        paymentMethod: 'Card',
        amountTendered: 18.72,
        changeDue: 0,
        items: [
          { productId: 16, sku: 'STA-501', productName: 'Dot-Grid Hardcover Notebook A5', quantity: 1, unitPrice: 14.0, lineTotal: 14.0 },
          { productId: 17, sku: 'STA-502', productName: 'Fine-Point Gel Ink Pen 0.5mm', quantity: 1, unitPrice: 3.25, lineTotal: 3.25 },
        ],
      },
    ];

    for (const s of sampleSales) {
      database.run(
        `INSERT INTO sales (
          receipt_number, created_at, cashier_name, customer_name,
          subtotal, discount_type, discount_value, discount_amount,
          tax_rate, tax_amount, total, payment_method,
          amount_tendered, change_due, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')`,
        [
          s.receiptNumber,
          s.createdAt,
          s.cashierName,
          s.customerName,
          s.subtotal,
          s.discountType,
          s.discountValue,
          s.discountAmount,
          s.taxRate,
          s.taxAmount,
          s.total,
          s.paymentMethod,
          s.amountTendered,
          s.changeDue,
        ]
      );
      const idRes = database.exec('SELECT last_insert_rowid()');
      const saleId = Number(idRes[0].values[0][0]);
      for (const item of s.items) {
        database.run(
          `INSERT INTO sale_items (sale_id, product_id, sku, product_name, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [saleId, item.productId, item.sku, item.productName, item.quantity, item.unitPrice, item.lineTotal]
        );
      }
    }
  }
}

function mapProductRow(row: unknown[]): Product {
  return {
    id: Number(row[0]),
    sku: String(row[1]),
    barcode: String(row[2]),
    name: String(row[3]),
    category: String(row[4]) as ProductCategory,
    costPrice: Number(row[5]),
    retailPrice: Number(row[6]),
    stock: Number(row[7]),
    reorderLevel: Number(row[8]),
    unit: String(row[9]),
    updatedAt: String(row[10]),
  };
}

export async function listProducts(filters?: {
  search?: string;
  category?: string;
  stockStatus?: string;
}): Promise<Product[]> {
  const database = await getDb();
  const res = database.exec(
    `SELECT id, sku, barcode, name, category, cost_price, retail_price, stock, reorder_level, unit, updated_at
     FROM products ORDER BY name ASC`
  );
  if (!res[0]) return [];

  let products = res[0].values.map(mapProductRow);

  if (filters?.category && filters.category !== 'All') {
    products = products.filter((p) => p.category === filters.category);
  }

  if (filters?.stockStatus === 'low') {
    products = products.filter((p) => p.stock > 0 && p.stock <= p.reorderLevel);
  } else if (filters?.stockStatus === 'out') {
    products = products.filter((p) => p.stock <= 0);
  }

  if (filters?.search && filters.search.trim() !== '') {
    const q = filters.search.trim().toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
    );
  }

  return products;
}

export async function createProduct(
  input: Omit<Product, 'id' | 'updatedAt'>
): Promise<Product> {
  const database = await getDb();
  const now = new Date().toISOString();

  database.run(
    `INSERT INTO products (sku, barcode, name, category, cost_price, retail_price, stock, reorder_level, unit, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.sku.trim(),
      input.barcode.trim(),
      input.name.trim(),
      input.category,
      Number(input.costPrice),
      Number(input.retailPrice),
      Number(input.stock),
      Number(input.reorderLevel),
      input.unit.trim() || 'ea',
      now,
    ]
  );

  const idRes = database.exec('SELECT last_insert_rowid()');
  const newId = Number(idRes[0].values[0][0]);
  saveDatabase();

  const created = database.exec(
    `SELECT id, sku, barcode, name, category, cost_price, retail_price, stock, reorder_level, unit, updated_at
     FROM products WHERE id = ?`,
    [newId]
  );
  return mapProductRow(created[0].values[0]);
}

export async function updateProduct(
  id: number,
  input: Partial<Omit<Product, 'id' | 'updatedAt'>>
): Promise<Product | null> {
  const database = await getDb();
  const existingRes = database.exec(
    `SELECT id, sku, barcode, name, category, cost_price, retail_price, stock, reorder_level, unit, updated_at
     FROM products WHERE id = ?`,
    [id]
  );
  if (!existingRes[0]?.values[0]) return null;

  const current = mapProductRow(existingRes[0].values[0]);
  const now = new Date().toISOString();

  database.run(
    `UPDATE products
     SET sku = ?, barcode = ?, name = ?, category = ?, cost_price = ?, retail_price = ?, stock = ?, reorder_level = ?, unit = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.sku !== undefined ? input.sku.trim() : current.sku,
      input.barcode !== undefined ? input.barcode.trim() : current.barcode,
      input.name !== undefined ? input.name.trim() : current.name,
      input.category !== undefined ? input.category : current.category,
      input.costPrice !== undefined ? Number(input.costPrice) : current.costPrice,
      input.retailPrice !== undefined ? Number(input.retailPrice) : current.retailPrice,
      input.stock !== undefined ? Number(input.stock) : current.stock,
      input.reorderLevel !== undefined ? Number(input.reorderLevel) : current.reorderLevel,
      input.unit !== undefined ? input.unit.trim() : current.unit,
      now,
      id,
    ]
  );

  saveDatabase();

  const updatedRes = database.exec(
    `SELECT id, sku, barcode, name, category, cost_price, retail_price, stock, reorder_level, unit, updated_at
     FROM products WHERE id = ?`,
    [id]
  );
  return mapProductRow(updatedRes[0].values[0]);
}

export async function adjustProductStock(
  id: number,
  delta: number
): Promise<Product | null> {
  const database = await getDb();
  const existingRes = database.exec(
    `SELECT id, sku, barcode, name, category, cost_price, retail_price, stock, reorder_level, unit, updated_at
     FROM products WHERE id = ?`,
    [id]
  );
  if (!existingRes[0]?.values[0]) return null;

  const current = mapProductRow(existingRes[0].values[0]);
  const nextStock = Math.max(0, current.stock + delta);
  return updateProduct(id, { stock: nextStock });
}

export async function deleteProduct(id: number): Promise<boolean> {
  const database = await getDb();
  database.run('DELETE FROM products WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

export async function getSettings(): Promise<StoreSettings> {
  const database = await getDb();
  const res = database.exec('SELECT key, value FROM settings');
  const map: Record<string, string> = {};
  if (res[0]) {
    for (const row of res[0].values) {
      map[String(row[0])] = String(row[1]);
    }
  }

  return {
    storeName: map.storeName || 'Northside General Store',
    address: map.address || '',
    phone: map.phone || '',
    taxId: map.taxId || '',
    taxRate: Number(map.taxRate ?? 8.5),
    taxType: (map.taxType === 'inclusive' ? 'inclusive' : 'exclusive') as 'inclusive' | 'exclusive',
    currencySymbol: map.currencySymbol || '$',
    receiptFooter: map.receiptFooter || 'Thank you for your business!',
    paperWidth: map.paperWidth === '58mm' ? '58mm' : '80mm',
    printerOnline: map.printerOnline !== 'false',
    cashierName: map.cashierName || 'Cashier',
    posScreenLayout: (map.posScreenLayout as any) || 'standard',
    barcodeScanBeep: map.barcodeScanBeep !== 'false',
    allowNegativeStock: map.allowNegativeStock === 'true',
    roundTotalToFiveCents: map.roundTotalToFiveCents === 'true',
    autoPrintReceiptOnSale: map.autoPrintReceiptOnSale !== 'false',
    receiptBarcodeEnabled: map.receiptBarcodeEnabled !== 'false',
    enableStockAlertsOnCheckout: map.enableStockAlertsOnCheckout !== 'false',
    defaultCustomer: map.defaultCustomer || 'Walk-in Customer',
  };
}

export async function updateSettings(
  partial: Partial<StoreSettings>
): Promise<StoreSettings> {
  const database = await getDb();
  const stmt = database.prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  );

  for (const [k, v] of Object.entries(partial)) {
    if (v !== undefined) {
      stmt.run([k, String(v)]);
    }
  }
  stmt.free();
  saveDatabase();
  return getSettings();
}

export async function listSales(): Promise<Sale[]> {
  const database = await getDb();
  const salesRes = database.exec(
    `SELECT id, receipt_number, created_at, cashier_name, customer_name,
            subtotal, discount_type, discount_value, discount_amount,
            tax_rate, tax_amount, total, payment_method,
            amount_tendered, change_due, status
     FROM sales ORDER BY id DESC`
  );

  if (!salesRes[0]) return [];

  const itemsRes = database.exec(
    `SELECT id, sale_id, product_id, sku, product_name, quantity, unit_price, line_total
     FROM sale_items ORDER BY id ASC`
  );

  const itemsBySale = new Map<number, SaleItem[]>();
  if (itemsRes[0]) {
    for (const row of itemsRes[0].values) {
      const item: SaleItem = {
        id: Number(row[0]),
        saleId: Number(row[1]),
        productId: Number(row[2]),
        sku: String(row[3]),
        productName: String(row[4]),
        quantity: Number(row[5]),
        unitPrice: Number(row[6]),
        lineTotal: Number(row[7]),
      };
      const list = itemsBySale.get(item.saleId) || [];
      list.push(item);
      itemsBySale.set(item.saleId, list);
    }
  }

  return salesRes[0].values.map((row) => {
    const id = Number(row[0]);
    return {
      id,
      receiptNumber: String(row[1]),
      createdAt: String(row[2]),
      cashierName: String(row[3]),
      customerName: String(row[4]),
      subtotal: Number(row[5]),
      discountType: String(row[6]) === 'percent' ? 'percent' : 'fixed',
      discountValue: Number(row[7]),
      discountAmount: Number(row[8]),
      taxRate: Number(row[9]),
      taxAmount: Number(row[10]),
      total: Number(row[11]),
      paymentMethod: String(row[12]) as PaymentMethod,
      amountTendered: Number(row[13]),
      changeDue: Number(row[14]),
      status: String(row[15]) === 'VOIDED' ? 'VOIDED' : 'COMPLETED',
      items: itemsBySale.get(id) || [],
    };
  });
}

export interface CreateSaleInput {
  customerName?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
}

export async function createSale(input: CreateSaleInput): Promise<{
  sale: Sale;
  queuedOfflinePrint: boolean;
}> {
  const database = await getDb();
  const settings = await getSettings();

  if (!input.items || input.items.length === 0) {
    throw new Error('Cart cannot be empty.');
  }

  const resolvedItems: Array<{
    product: Product;
    quantity: number;
    lineTotal: number;
  }> = [];

  for (const reqItem of input.items) {
    const prodRes = database.exec(
      `SELECT id, sku, barcode, name, category, cost_price, retail_price, stock, reorder_level, unit, updated_at
       FROM products WHERE id = ?`,
      [reqItem.productId]
    );
    if (!prodRes[0]?.values[0]) {
      throw new Error(`Product #${reqItem.productId} not found.`);
    }
    const product = mapProductRow(prodRes[0].values[0]);
    if (reqItem.quantity <= 0) {
      throw new Error(`Invalid quantity for ${product.name}.`);
    }
    if (!settings.allowNegativeStock && product.stock < reqItem.quantity) {
      throw new Error(
        `Insufficient stock for ${product.name} (${product.stock} available).`
      );
    }
    const lineTotal = Number((product.retailPrice * reqItem.quantity).toFixed(2));
    resolvedItems.push({ product, quantity: reqItem.quantity, lineTotal });
  }

  const subtotal = Number(
    resolvedItems.reduce((acc, item) => acc + item.lineTotal, 0).toFixed(2)
  );

  let discountAmount = 0;
  if (input.discountValue > 0) {
    if (input.discountType === 'percent') {
      discountAmount = Number(
        ((subtotal * Math.min(100, input.discountValue)) / 100).toFixed(2)
      );
    } else {
      discountAmount = Number(Math.min(subtotal, input.discountValue).toFixed(2));
    }
  }

  const netAfterDiscount = Math.max(0, subtotal - discountAmount);
  let taxAmount = 0;
  let total = 0;

  if (settings.taxType === 'inclusive') {
    // Retail price already includes tax: Tax = Net - (Net / (1 + Rate/100))
    total = netAfterDiscount;
    taxAmount = Number((netAfterDiscount - netAfterDiscount / (1 + settings.taxRate / 100)).toFixed(2));
  } else {
    // Exclusive: Tax is added on top of net subtotal
    taxAmount = Number(((netAfterDiscount * settings.taxRate) / 100).toFixed(2));
    total = Number((netAfterDiscount + taxAmount).toFixed(2));
  }

  if (settings.roundTotalToFiveCents) {
    total = Number((Math.round(total * 20) / 20).toFixed(2));
  }

  const amountTendered =
    input.paymentMethod === 'Cash'
      ? Math.max(total, Number(input.amountTendered || total))
      : total;
  const changeDue =
    input.paymentMethod === 'Cash'
      ? Number(Math.max(0, amountTendered - total).toFixed(2))
      : 0;

  const now = new Date().toISOString();
  const countRes = database.exec('SELECT COUNT(*) FROM sales');
  const nextSeq = 1001 + Number(countRes[0]?.values[0]?.[0] ?? 0);
  const receiptNumber = `RCP-${new Date().getFullYear()}-${nextSeq}`;

  database.run(
    `INSERT INTO sales (
      receipt_number, created_at, cashier_name, customer_name,
      subtotal, discount_type, discount_value, discount_amount,
      tax_rate, tax_amount, total, payment_method,
      amount_tendered, change_due, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')`,
    [
      receiptNumber,
      now,
      settings.cashierName,
      (input.customerName || '').trim() || 'Walk-in Customer',
      subtotal,
      input.discountType,
      Number(input.discountValue || 0),
      discountAmount,
      settings.taxRate,
      taxAmount,
      total,
      input.paymentMethod,
      amountTendered,
      changeDue,
    ]
  );

  const idRes = database.exec('SELECT last_insert_rowid()');
  const saleId = Number(idRes[0].values[0][0]);

  const saleItems: SaleItem[] = [];
  for (const item of resolvedItems) {
    database.run(
      `INSERT INTO sale_items (sale_id, product_id, sku, product_name, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        item.product.id,
        item.product.sku,
        item.product.name,
        item.quantity,
        item.product.retailPrice,
        item.lineTotal,
      ]
    );
    const itemIdRes = database.exec('SELECT last_insert_rowid()');
    saleItems.push({
      id: Number(itemIdRes[0].values[0][0]),
      saleId,
      productId: item.product.id,
      sku: item.product.sku,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.retailPrice,
      lineTotal: item.lineTotal,
    });

    database.run('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?', [
      item.quantity,
      now,
      item.product.id,
    ]);
  }

  let queuedOfflinePrint = false;
  if (!settings.printerOnline) {
    database.run(
      `INSERT INTO print_queue (sale_id, receipt_number, created_at, total, status)
       VALUES (?, ?, ?, ?, 'QUEUED')`,
      [saleId, receiptNumber, now, total]
    );
    queuedOfflinePrint = true;
  }

  saveDatabase();

  const sale: Sale = {
    id: saleId,
    receiptNumber,
    createdAt: now,
    cashierName: settings.cashierName,
    customerName: (input.customerName || '').trim() || 'Walk-in Customer',
    subtotal,
    discountType: input.discountType,
    discountValue: Number(input.discountValue || 0),
    discountAmount,
    taxRate: settings.taxRate,
    taxAmount,
    total,
    paymentMethod: input.paymentMethod,
    amountTendered,
    changeDue,
    status: 'COMPLETED',
    items: saleItems,
  };

  return { sale, queuedOfflinePrint };
}

export async function voidSale(saleId: number): Promise<Sale | null> {
  const database = await getDb();
  const sales = await listSales();
  const target = sales.find((s) => s.id === saleId);
  if (!target) return null;
  if (target.status === 'VOIDED') return target;

  const now = new Date().toISOString();
  database.run("UPDATE sales SET status = 'VOIDED' WHERE id = ?", [saleId]);

  for (const item of target.items) {
    database.run('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?', [
      item.quantity,
      now,
      item.productId,
    ]);
  }

  saveDatabase();
  const updated = await listSales();
  return updated.find((s) => s.id === saleId) || null;
}

export async function listPrintQueue(): Promise<PrintJob[]> {
  const database = await getDb();
  const res = database.exec(
    `SELECT id, sale_id, receipt_number, created_at, total, status
     FROM print_queue WHERE status = 'QUEUED' ORDER BY id ASC`
  );
  if (!res[0]) return [];
  return res[0].values.map((row) => ({
    id: Number(row[0]),
    saleId: Number(row[1]),
    receiptNumber: String(row[2]),
    createdAt: String(row[3]),
    total: Number(row[4]),
    status: String(row[5]) as 'QUEUED' | 'PRINTED',
  }));
}

export async function flushPrintQueue(): Promise<void> {
  const database = await getDb();
  database.run("UPDATE print_queue SET status = 'PRINTED' WHERE status = 'QUEUED'");
  saveDatabase();
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<{ username: string; role: 'admin' | 'cashier'; displayName: string } | null> {
  const database = await getDb();
  const res = database.exec(
    'SELECT username, password, role, display_name FROM users WHERE username = ?',
    [username.trim()]
  );

  if (!res[0] || !res[0].values[0]) {
    // If table was newly created in existing pos.sqlite, ensure fallback for admin/admin
    if (username.trim() === 'admin' && password === 'admin') {
      return { username: 'admin', role: 'admin', displayName: 'Store Administrator' };
    }
    return null;
  }

  const row = res[0].values[0];
  const storedPassword = String(row[1]);
  if (storedPassword !== password) {
    return null;
  }

  return {
    username: String(row[0]),
    role: (String(row[2]) === 'admin' ? 'admin' : 'cashier') as 'admin' | 'cashier',
    displayName: String(row[3]),
  };
}

// ----------------- CUSTOMERS -----------------
export async function listCustomers(search?: string): Promise<Customer[]> {
  const database = await getDb();
  const res = database.exec(
    `SELECT id, name, phone, email, address, notes, created_at FROM customers ORDER BY name ASC`
  );
  if (!res[0]) return [];

  // Calculate total spent and orders count from sales table
  const salesRes = database.exec(
    `SELECT customer_name, total FROM sales WHERE status = 'COMPLETED'`
  );
  const spendingByCustomer = new Map<string, { total: number; count: number }>();
  if (salesRes[0]) {
    for (const r of salesRes[0].values) {
      const cName = String(r[0]);
      const tot = Number(r[1]);
      const cur = spendingByCustomer.get(cName) || { total: 0, count: 0 };
      spendingByCustomer.set(cName, { total: cur.total + tot, count: cur.count + 1 });
    }
  }

  let customers: Customer[] = res[0].values.map((r) => {
    const name = String(r[1]);
    const spentInfo = spendingByCustomer.get(name) || { total: 0, count: 0 };
    return {
      id: Number(r[0]),
      name,
      phone: String(r[2] || ''),
      email: String(r[3] || ''),
      address: String(r[4] || ''),
      notes: String(r[5] || ''),
      createdAt: String(r[6]),
      totalSpent: Number(spentInfo.total.toFixed(2)),
      ordersCount: spentInfo.count,
    };
  });

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    customers = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }

  return customers;
}

export async function createCustomer(input: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}): Promise<Customer> {
  const database = await getDb();
  const now = new Date().toISOString();
  database.run(
    `INSERT INTO customers (name, phone, email, address, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.name.trim(),
      (input.phone || '').trim(),
      (input.email || '').trim(),
      (input.address || '').trim(),
      (input.notes || '').trim(),
      now,
    ]
  );
  const idRes = database.exec('SELECT last_insert_rowid()');
  const id = Number(idRes[0].values[0][0]);
  saveDatabase();
  return {
    id,
    name: input.name.trim(),
    phone: (input.phone || '').trim(),
    email: (input.email || '').trim(),
    address: (input.address || '').trim(),
    notes: (input.notes || '').trim(),
    createdAt: now,
    totalSpent: 0,
    ordersCount: 0,
  };
}

export async function updateCustomer(
  id: number,
  input: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  }
): Promise<Customer | null> {
  const database = await getDb();
  const existingRes = database.exec(
    `SELECT id, name, phone, email, address, notes, created_at FROM customers WHERE id = ?`,
    [id]
  );
  if (!existingRes[0]?.values[0]) return null;
  const current = existingRes[0].values[0];

  database.run(
    `UPDATE customers
     SET name = ?, phone = ?, email = ?, address = ?, notes = ?
     WHERE id = ?`,
    [
      input.name !== undefined ? input.name.trim() : String(current[1]),
      input.phone !== undefined ? input.phone.trim() : String(current[2]),
      input.email !== undefined ? input.email.trim() : String(current[3]),
      input.address !== undefined ? input.address.trim() : String(current[4]),
      input.notes !== undefined ? input.notes.trim() : String(current[5]),
      id,
    ]
  );
  saveDatabase();
  const all = await listCustomers();
  return all.find((c) => c.id === id) || null;
}

export async function deleteCustomer(id: number): Promise<boolean> {
  const database = await getDb();
  database.run('DELETE FROM customers WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

// ----------------- VENDORS -----------------
export async function listVendors(search?: string): Promise<Vendor[]> {
  const database = await getDb();
  const res = database.exec(
    `SELECT id, name, contact_person, phone, email, address, tax_number, created_at FROM vendors ORDER BY name ASC`
  );
  if (!res[0]) return [];

  // Aggregate purchases
  const purchRes = database.exec(`SELECT vendor_id, total FROM purchases`);
  const purchasesByVendor = new Map<number, { total: number; count: number }>();
  if (purchRes[0]) {
    for (const r of purchRes[0].values) {
      const vId = Number(r[0]);
      const tot = Number(r[1]);
      const cur = purchasesByVendor.get(vId) || { total: 0, count: 0 };
      purchasesByVendor.set(vId, { total: cur.total + tot, count: cur.count + 1 });
    }
  }

  let vendors: Vendor[] = res[0].values.map((r) => {
    const id = Number(r[0]);
    const purchInfo = purchasesByVendor.get(id) || { total: 0, count: 0 };
    return {
      id,
      name: String(r[1]),
      contactPerson: String(r[2] || ''),
      phone: String(r[3] || ''),
      email: String(r[4] || ''),
      address: String(r[5] || ''),
      taxNumber: String(r[6] || ''),
      createdAt: String(r[7]),
      totalPurchased: Number(purchInfo.total.toFixed(2)),
      purchasesCount: purchInfo.count,
    };
  });

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    vendors = vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.contactPerson.toLowerCase().includes(q) ||
        v.phone.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q)
    );
  }

  return vendors;
}

export async function createVendor(input: {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
}): Promise<Vendor> {
  const database = await getDb();
  const now = new Date().toISOString();
  database.run(
    `INSERT INTO vendors (name, contact_person, phone, email, address, tax_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name.trim(),
      (input.contactPerson || '').trim(),
      (input.phone || '').trim(),
      (input.email || '').trim(),
      (input.address || '').trim(),
      (input.taxNumber || '').trim(),
      now,
    ]
  );
  const idRes = database.exec('SELECT last_insert_rowid()');
  const id = Number(idRes[0].values[0][0]);
  saveDatabase();
  return {
    id,
    name: input.name.trim(),
    contactPerson: (input.contactPerson || '').trim(),
    phone: (input.phone || '').trim(),
    email: (input.email || '').trim(),
    address: (input.address || '').trim(),
    taxNumber: (input.taxNumber || '').trim(),
    createdAt: now,
    totalPurchased: 0,
    purchasesCount: 0,
  };
}

export async function updateVendor(
  id: number,
  input: {
    name?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    taxNumber?: string;
  }
): Promise<Vendor | null> {
  const database = await getDb();
  const existingRes = database.exec(
    `SELECT id, name, contact_person, phone, email, address, tax_number, created_at FROM vendors WHERE id = ?`,
    [id]
  );
  if (!existingRes[0]?.values[0]) return null;
  const current = existingRes[0].values[0];

  database.run(
    `UPDATE vendors
     SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, tax_number = ?
     WHERE id = ?`,
    [
      input.name !== undefined ? input.name.trim() : String(current[1]),
      input.contactPerson !== undefined ? input.contactPerson.trim() : String(current[2]),
      input.phone !== undefined ? input.phone.trim() : String(current[3]),
      input.email !== undefined ? input.email.trim() : String(current[4]),
      input.address !== undefined ? input.address.trim() : String(current[5]),
      input.taxNumber !== undefined ? input.taxNumber.trim() : String(current[6]),
      id,
    ]
  );
  saveDatabase();
  const all = await listVendors();
  return all.find((v) => v.id === id) || null;
}

export async function deleteVendor(id: number): Promise<boolean> {
  const database = await getDb();
  database.run('DELETE FROM vendors WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

// ----------------- PURCHASE ENTRY -----------------
export async function listPurchases(): Promise<PurchaseEntry[]> {
  const database = await getDb();
  const res = database.exec(
    `SELECT id, invoice_number, vendor_id, vendor_name, created_at, received_date, subtotal, tax_amount, shipping_cost, total, payment_status, notes
     FROM purchases ORDER BY id DESC`
  );
  if (!res[0]) return [];

  const itemsRes = database.exec(
    `SELECT id, purchase_id, product_id, sku, product_name, quantity, unit_cost, line_total
     FROM purchase_items ORDER BY id ASC`
  );
  const itemsByPurchase = new Map<number, PurchaseItem[]>();
  if (itemsRes[0]) {
    for (const row of itemsRes[0].values) {
      const item: PurchaseItem = {
        id: Number(row[0]),
        purchaseId: Number(row[1]),
        productId: Number(row[2]),
        sku: String(row[3]),
        productName: String(row[4]),
        quantity: Number(row[5]),
        unitCost: Number(row[6]),
        lineTotal: Number(row[7]),
      };
      const list = itemsByPurchase.get(item.purchaseId) || [];
      list.push(item);
      itemsByPurchase.set(item.purchaseId, list);
    }
  }

  return res[0].values.map((row) => {
    const id = Number(row[0]);
    return {
      id,
      invoiceNumber: String(row[1]),
      vendorId: Number(row[2]),
      vendorName: String(row[3]),
      createdAt: String(row[4]),
      receivedDate: String(row[5]),
      subtotal: Number(row[6]),
      taxAmount: Number(row[7]),
      shippingCost: Number(row[8]),
      total: Number(row[9]),
      paymentStatus: String(row[10]) as 'PAID' | 'PENDING' | 'PARTIAL',
      notes: String(row[11] || ''),
      items: itemsByPurchase.get(id) || [],
    };
  });
}

export interface CreatePurchaseInput {
  invoiceNumber: string;
  vendorId: number;
  receivedDate?: string;
  taxAmount?: number;
  shippingCost?: number;
  paymentStatus?: 'PAID' | 'PENDING' | 'PARTIAL';
  notes?: string;
  updateCostPrices?: boolean;
  items: Array<{
    productId: number;
    quantity: number;
    unitCost: number;
  }>;
}

export async function createPurchaseEntry(
  input: CreatePurchaseInput
): Promise<PurchaseEntry> {
  const database = await getDb();
  if (!input.items || input.items.length === 0) {
    throw new Error('Purchase entry must contain at least one item.');
  }

  // Look up vendor
  const vendorRes = database.exec('SELECT id, name FROM vendors WHERE id = ?', [
    input.vendorId,
  ]);
  if (!vendorRes[0]?.values[0]) {
    throw new Error('Vendor not found.');
  }
  const vendorName = String(vendorRes[0].values[0][1]);

  const resolvedItems: Array<{
    productId: number;
    sku: string;
    productName: string;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }> = [];

  for (const item of input.items) {
    const prodRes = database.exec(
      'SELECT id, sku, name, cost_price FROM products WHERE id = ?',
      [item.productId]
    );
    if (!prodRes[0]?.values[0]) {
      throw new Error(`Product #${item.productId} not found.`);
    }
    const sku = String(prodRes[0].values[0][1]);
    const name = String(prodRes[0].values[0][2]);
    const qty = Math.max(1, parseInt(String(item.quantity), 10) || 1);
    const cost = Math.max(0, Number(item.unitCost) || 0);
    const lineTotal = Number((qty * cost).toFixed(2));
    resolvedItems.push({
      productId: item.productId,
      sku,
      productName: name,
      quantity: qty,
      unitCost: cost,
      lineTotal,
    });
  }

  const subtotal = Number(
    resolvedItems.reduce((acc, it) => acc + it.lineTotal, 0).toFixed(2)
  );
  const tax = Number(Number(input.taxAmount || 0).toFixed(2));
  const shipping = Number(Number(input.shippingCost || 0).toFixed(2));
  const total = Number((subtotal + tax + shipping).toFixed(2));
  const now = new Date().toISOString();
  const receivedDate = input.receivedDate || now.slice(0, 10);

  database.run(
    `INSERT INTO purchases (
      invoice_number, vendor_id, vendor_name, created_at, received_date,
      subtotal, tax_amount, shipping_cost, total, payment_status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.invoiceNumber.trim(),
      input.vendorId,
      vendorName,
      now,
      receivedDate,
      subtotal,
      tax,
      shipping,
      total,
      input.paymentStatus || 'PAID',
      (input.notes || '').trim(),
    ]
  );

  const purchIdRes = database.exec('SELECT last_insert_rowid()');
  const purchaseId = Number(purchIdRes[0].values[0][0]);

  const purchaseItems: PurchaseItem[] = [];
  for (const it of resolvedItems) {
    database.run(
      `INSERT INTO purchase_items (purchase_id, product_id, sku, product_name, quantity, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [purchaseId, it.productId, it.sku, it.productName, it.quantity, it.unitCost, it.lineTotal]
    );
    const itemIdRes = database.exec('SELECT last_insert_rowid()');
    purchaseItems.push({
      id: Number(itemIdRes[0].values[0][0]),
      purchaseId,
      productId: it.productId,
      sku: it.sku,
      productName: it.productName,
      quantity: it.quantity,
      unitCost: it.unitCost,
      lineTotal: it.lineTotal,
    });

    // Automatically increase inventory stock on hand!
    if (input.updateCostPrices) {
      database.run(
        'UPDATE products SET stock = stock + ?, cost_price = ?, updated_at = ? WHERE id = ?',
        [it.quantity, it.unitCost, now, it.productId]
      );
    } else {
      database.run(
        'UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?',
        [it.quantity, now, it.productId]
      );
    }
  }

  saveDatabase();

  return {
    id: purchaseId,
    invoiceNumber: input.invoiceNumber.trim(),
    vendorId: input.vendorId,
    vendorName,
    createdAt: now,
    receivedDate,
    subtotal,
    taxAmount: tax,
    shippingCost: shipping,
    total,
    paymentStatus: input.paymentStatus || 'PAID',
    notes: (input.notes || '').trim(),
    items: purchaseItems,
  };
}


