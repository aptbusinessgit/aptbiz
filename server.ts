import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  adjustProductStock,
  authenticateUser,
  createCustomer,
  createProduct,
  createPurchaseEntry,
  createSale,
  createVendor,
  deleteCustomer,
  deleteProduct,
  deleteVendor,
  flushPrintQueue,
  getDb,
  getSettings,
  listCustomers,
  listPrintQueue,
  listProducts,
  listPurchases,
  listSales,
  listVendors,
  updateCustomer,
  updateProduct,
  updateSettings,
  updateVendor,
  voidSale,
} from './server/db';

async function startServer() {
  await getDb();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, engine: 'sqlite' });
  });

  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required.' });
        return;
      }
      const user = await authenticateUser(String(username), String(password));
      if (!user) {
        res.status(401).json({ error: 'Invalid username or password.' });
        return;
      }
      res.json({ ok: true, user });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/products', async (req, res) => {
    try {
      const products = await listProducts({
        search: req.query.search as string | undefined,
        category: req.query.category as string | undefined,
        stockStatus: req.query.stockStatus as string | undefined,
      });
      res.json(products);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/products', async (req, res) => {
    try {
      const product = await createProduct(req.body);
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put('/api/products/:id', async (req, res) => {
    try {
      const updated = await updateProduct(Number(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/products/:id/stock', async (req, res) => {
    try {
      const delta = Number(req.body.delta ?? 0);
      const updated = await adjustProductStock(Number(req.params.id), delta);
      if (!updated) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/products/:id', async (req, res) => {
    try {
      await deleteProduct(Number(req.params.id));
      res.json({ deleted: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/sales', async (_req, res) => {
    try {
      const sales = await listSales();
      res.json(sales);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/sales', async (req, res) => {
    try {
      const result = await createSale(req.body);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/sales/:id/void', async (req, res) => {
    try {
      const updated = await voidSale(Number(req.params.id));
      if (!updated) {
        res.status(404).json({ error: 'Sale not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/settings', async (_req, res) => {
    try {
      const settings = await getSettings();
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/settings', async (req, res) => {
    try {
      const settings = await updateSettings(req.body);
      res.json(settings);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/print-queue', async (_req, res) => {
    try {
      const queue = await listPrintQueue();
      res.json(queue);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/print-queue/flush', async (_req, res) => {
    try {
      await flushPrintQueue();
      res.json({ flushed: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ----------------- CUSTOMERS API -----------------
  app.get('/api/customers', async (req, res) => {
    try {
      const customers = await listCustomers(req.query.search as string | undefined);
      res.json(customers);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/customers', async (req, res) => {
    try {
      const customer = await createCustomer(req.body);
      res.status(201).json(customer);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put('/api/customers/:id', async (req, res) => {
    try {
      const updated = await updateCustomer(Number(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/customers/:id', async (req, res) => {
    try {
      await deleteCustomer(Number(req.params.id));
      res.json({ deleted: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // ----------------- VENDORS API -----------------
  app.get('/api/vendors', async (req, res) => {
    try {
      const vendors = await listVendors(req.query.search as string | undefined);
      res.json(vendors);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/vendors', async (req, res) => {
    try {
      const vendor = await createVendor(req.body);
      res.status(201).json(vendor);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put('/api/vendors/:id', async (req, res) => {
    try {
      const updated = await updateVendor(Number(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Vendor not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/vendors/:id', async (req, res) => {
    try {
      await deleteVendor(Number(req.params.id));
      res.json({ deleted: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // ----------------- PURCHASES API -----------------
  app.get('/api/purchases', async (_req, res) => {
    try {
      const purchases = await listPurchases();
      res.json(purchases);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/purchases', async (req, res) => {
    try {
      const purchase = await createPurchaseEntry(req.body);
      res.status(201).json(purchase);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Counterline POS server running on http://localhost:${PORT}`);
  });
}

startServer();
