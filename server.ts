import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes';
import { TelegramBotService } from './server/telegram';
import { db } from './server/db';

import { renderCheckoutHtml } from './server/checkoutPage';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

async function createServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount API routes
  app.use('/api', apiRouter);

  // ACLEDA Direct Payment Page (Showing exact total price)
  app.get('/acleda', async (req, res) => {
    const amount = parseFloat(String(req.query.amount || req.query.purchaseAmount || req.query.val || '3.50')) || 3.50;
    const orderId = String(req.query.order_id || req.query.orderId || req.query.invoice_id || '');
    const paymentData = String(req.query.payment_data || 'mJzyzR6n');
    const order = orderId ? db.getOrders().find(o => o.id === orderId) : undefined;
    const html = await renderCheckoutHtml({
      orderId: order?.id || orderId,
      amount: order?.totalAmount || amount,
      productName: order?.productName,
      customerName: order?.customerName,
      paymentData
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  // Dedicated order payment route
  app.get('/pay/:orderId', async (req, res) => {
    const order = db.getOrders().find(o => o.id === req.params.orderId);
    if (!order) {
      return res.redirect('/acleda');
    }
    const html = await renderCheckoutHtml({
      orderId: order.id,
      amount: order.totalAmount,
      productName: order.productName,
      customerName: order.customerName
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Explicit 404 handler for any unhandled /api/* route to prevent Vite SPA HTML fallback
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Global JSON error handler for /api
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[API Error]:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  // Start background workers for payment checking & stock cleanup
  TelegramBotService.startBackgroundWorkers();

  // Auto-connect Telegram bot connection
  const settings = db.getSettings();
  if (settings.botToken) {
    if (settings.webhookUrl && settings.webhookEnabled) {
      console.log(`[Telegram] Auto-synchronizing 24/7 Webhook: ${settings.webhookUrl}`);
      TelegramBotService.setWebhook(settings.webhookUrl, settings.botToken).catch(err => {
        console.warn('[Telegram] Auto webhook sync warning:', err.message);
      });
    } else {
      console.log(`[Telegram] Auto-connecting live bot polling for @${settings.botUsername || 'qcmstore_bot'}`);
      TelegramBotService.startPolling();
    }
  }

  if (!isProd) {
    // Development mode: mount Vite middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CutLuy KHQR Telegram Digital Store running at http://0.0.0.0:${PORT}`);
  });
}

createServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
