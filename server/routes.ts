import { Router } from 'express';
import { db } from './db';
import { TelegramBotService } from './telegram';
import type { DashboardStats, Product, StockItem, Coupon } from '../src/types/store';

export const apiRouter = Router();

// ==========================================
// 1. STATS & ANALYTICS
// ==========================================
apiRouter.get('/stats', (req, res) => {
  const products = db.getProducts();
  const stock = db.getStock();
  const orders = db.getOrders();
  const customers = db.getCustomers();

  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const soldAccountsCount = stock.filter(s => s.status === 'sold').length;
  const totalStockAvailable = stock.filter(s => s.status === 'available').length;
  const totalStockReserved = stock.filter(s => s.status === 'reserved').length;

  // Revenue by day (last 7 days)
  const daysMap: Record<string, { amount: number; count: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(5, 10); // MM-DD
    daysMap[key] = { amount: 0, count: 0 };
  }

  for (const ord of completedOrders) {
    const key = ord.createdAt.slice(5, 10);
    if (daysMap[key]) {
      daysMap[key].amount = Number((daysMap[key].amount + ord.totalAmount).toFixed(2));
      daysMap[key].count += 1;
    }
  }

  const revenueByDay = Object.entries(daysMap).map(([date, data]) => ({
    date,
    amount: data.amount,
    count: data.count
  }));

  // Sales by product
  const prodSalesMap: Record<string, { count: number; revenue: number }> = {};
  for (const ord of completedOrders) {
    if (!prodSalesMap[ord.productName]) {
      prodSalesMap[ord.productName] = { count: 0, revenue: 0 };
    }
    prodSalesMap[ord.productName].count += ord.quantity;
    prodSalesMap[ord.productName].revenue = Number((prodSalesMap[ord.productName].revenue + ord.totalAmount).toFixed(2));
  }

  const salesByProduct = Object.entries(prodSalesMap).map(([productName, data]) => ({
    productName,
    count: data.count,
    revenue: data.revenue
  }));

  const stats: DashboardStats = {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    completedOrdersCount: completedOrders.length,
    soldAccountsCount,
    totalStockAvailable,
    totalStockReserved,
    totalCustomers: customers.length,
    recentOrders: orders.slice(0, 10),
    revenueByDay,
    salesByProduct
  };

  res.json(stats);
});

// ==========================================
// 2. PRODUCTS
// ==========================================
apiRouter.get('/products', (req, res) => {
  res.json(db.getProducts());
});

apiRouter.post('/products', (req, res) => {
  const body = req.body;
  const newProduct: Product = {
    id: body.id || `prod_${Date.now()}`,
    name: body.name || 'New Book',
    category: body.category || 'General',
    description: body.description || '',
    price: Number(body.price) || 1.0,
    bulkPricingEnabled: Boolean(body.bulkPricingEnabled),
    tiers: Array.isArray(body.tiers) ? body.tiers : [],
    instructions: body.instructions || '',
    badge: body.badge || (body.bookFormat === 'printed' ? '📖 ព្រីន' : '📄 PDF'),
    isActive: body.isActive !== false,
    createdAt: new Date().toISOString(),
    bookFormat: body.bookFormat || 'pdf',
    author: body.author || '',
    pages: body.pages ? Number(body.pages) : undefined,
    fileSize: body.fileSize || '',
    pdfDownloadUrl: body.pdfDownloadUrl || '',
    publisher: body.publisher || '',
    isbn: body.isbn || ''
  };

  const created = db.addProduct(newProduct);
  res.status(201).json(created);
});

apiRouter.put('/products/:id', (req, res) => {
  const updated = db.updateProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Product not found' });
  res.json(updated);
});

apiRouter.delete('/products/:id', (req, res) => {
  const success = db.deleteProduct(req.params.id);
  if (!success) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true });
});

// ==========================================
// 3. STOCK
// ==========================================
apiRouter.get('/stock', (req, res) => {
  let stock = db.getStock();
  const { productId, status } = req.query;

  if (productId) {
    stock = stock.filter(s => s.productId === String(productId));
  }
  if (status) {
    stock = stock.filter(s => s.status === String(status));
  }

  res.json(stock);
});

apiRouter.post('/stock/bulk', (req, res) => {
  const { productId, lines } = req.body;
  if (!productId || typeof lines !== 'string') {
    return res.status(400).json({ error: 'Missing productId or lines' });
  }

  const rawLines = lines
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  if (rawLines.length === 0) {
    return res.status(400).json({ error: 'No valid lines provided' });
  }

  const now = new Date().toISOString();
  const items: StockItem[] = rawLines.map((content: string, idx: number) => ({
    id: `stk_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
    productId,
    content,
    status: 'available',
    reservedUntil: null,
    orderId: null,
    addedAt: now,
    soldAt: null
  }));

  db.addStockItems(items);

  // If settings alert is enabled, notify admin channel
  const settings = db.getSettings();
  if (settings.alertAdminOnNewStock && settings.channelId) {
    const prod = db.getProducts().find(p => p.id === productId);
    TelegramBotService.sendMessage(
      settings.channelId,
      `📦 <b>បានបញ្ចូលស្តុកថ្មី (Stock Added)!</b>\nទំនិញ៖ <b>${prod?.name || productId}</b>\nចំនួន៖ <b>+${items.length} Accounts</b>\nស្តុកសរុបបច្ចុប្បន្ន៖ ${db.getAvailableStockCount(productId)}`
    ).catch(() => {});
  }

  res.status(201).json({ count: items.length, items });
});

apiRouter.post('/stock', (req, res) => {
  const { productId, content } = req.body;
  if (!productId || !content) {
    return res.status(400).json({ error: 'Missing productId or content' });
  }

  const newItem: StockItem = {
    id: `stk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    productId,
    content: String(content).trim(),
    status: 'available',
    reservedUntil: null,
    orderId: null,
    addedAt: new Date().toISOString(),
    soldAt: null
  };

  db.addStockItems([newItem]);
  res.status(201).json(newItem);
});

apiRouter.put('/stock/:id', (req, res) => {
  const updated = db.updateStockItem(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Stock item not found' });
  res.json(updated);
});

apiRouter.delete('/stock/:id', (req, res) => {
  const success = db.deleteStockItem(req.params.id);
  if (!success) return res.status(404).json({ error: 'Stock item not found' });
  res.json({ success: true });
});

// Helper to escape CSV cell content
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Export Orders & Shipment Dispatch List as CSV (Excel compatible)
apiRouter.get('/orders/export-csv', (req, res) => {
  const { format, status } = req.query;
  let orders = db.getOrders();
  if (format === 'printed') {
    orders = orders.filter(o => o.bookFormat === 'printed');
  } else if (format === 'pdf') {
    orders = orders.filter(o => o.bookFormat === 'pdf');
  }

  if (status && status !== 'all') {
    orders = orders.filter(o => o.status === String(status));
  }

  const headers = [
    'Order ID',
    'កាលបរិច្ឆេទ (Date)',
    'សៀវភៅ (Book)',
    'ប្រភេទ (Format)',
    'ចំនួន (Qty)',
    'តម្លៃសរុប USD (Total)',
    'ស្ថានភាពទូទាត់ (Payment)',
    'ឈ្មោះអ្នកទទួល (Recipient)',
    'លេខទូរស័ព្ទ (Phone)',
    'អាសយដ្ឋានដឹកជញ្ជូន (Address)',
    'ស្ថានភាពដឹកជញ្ជូន (Shipping Status)',
    'លេខកូដតាមដាន (Tracking Code)',
    'Telegram User',
    'Telegram ID'
  ];

  const rows = orders.map(o => [
    o.id,
    o.createdAt ? new Date(o.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' }) : '',
    o.productName,
    o.bookFormat === 'printed' ? 'សៀវភៅព្រីន (Hardcopy)' : 'សៀវភៅ PDF (E-Book)',
    o.quantity,
    o.totalAmount.toFixed(2),
    o.status,
    o.shippingRecipient || o.customerName || '',
    o.shippingPhone || '',
    o.shippingAddress || '',
    o.shippingStatus || (o.status === 'completed' && o.bookFormat === 'printed' ? 'preparing' : ''),
    o.trackingNumber || '',
    `@${o.telegramUsername}`,
    o.telegramId
  ]);

  // UTF-8 BOM so Excel opens Khmer characters with perfect rendering
  const bom = '\uFEFF';
  const csvContent = bom + [
    headers.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(','))
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="shipment_dispatch_${Date.now()}.csv"`);
  res.send(csvContent);
});

apiRouter.get('/orders', (req, res) => {
  let orders = db.getOrders();
  const { search, status } = req.query;

  if (status && status !== 'all') {
    orders = orders.filter(o => o.status === String(status));
  }

  if (search) {
    const q = String(search).toLowerCase();
    orders = orders.filter(o =>
      o.id.toLowerCase().includes(q) ||
      o.telegramUsername.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.productName.toLowerCase().includes(q)
    );
  }

  res.json(orders);
});

apiRouter.put('/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const updated = db.updateOrder(orderId, req.body);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json({ success: true, order: updated });
});

apiRouter.delete('/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const success = db.deleteOrder(orderId);
  if (!success) return res.status(404).json({ error: 'Order not found' });
  res.json({ success: true });
});

apiRouter.post('/orders/:id/fulfill', async (req, res) => {
  const orderId = req.params.id;
  const success = await TelegramBotService.fulfillOrder(orderId);
  if (!success) {
    const ord = db.getOrders().find(o => o.id === orderId);
    return res.status(400).json({ error: ord?.errorMessage || 'Could not fulfill order (insufficient stock or already completed)' });
  }
  res.json({ success: true, order: db.getOrders().find(o => o.id === orderId) });
});

apiRouter.post('/orders/:id/cancel', (req, res) => {
  const orderId = req.params.id;
  const success = db.cancelOrder(orderId);
  if (!success) {
    return res.status(400).json({ error: 'Could not cancel order' });
  }
  res.json({ success: true, order: db.getOrders().find(o => o.id === orderId) });
});

apiRouter.put('/orders/:id/shipping', async (req, res) => {
  const orderId = req.params.id;
  const { shippingStatus, trackingNumber, shippingRecipient, shippingPhone, shippingAddress } = req.body;
  const existing = db.getOrders().find(o => o.id === orderId);
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const updated = db.updateOrder(orderId, {
    shippingStatus: shippingStatus || existing.shippingStatus,
    trackingNumber: trackingNumber !== undefined ? trackingNumber : existing.trackingNumber,
    shippingRecipient: shippingRecipient || existing.shippingRecipient,
    shippingPhone: shippingPhone || existing.shippingPhone,
    shippingAddress: shippingAddress || existing.shippingAddress
  });

  // Notify customer on Telegram if tracking number was updated
  if (trackingNumber && trackingNumber !== existing.trackingNumber && existing.telegramId) {
    const notifyMsg = `🚚 <b>ដំណឹងដឹកជញ្ជូនសៀវភៅ (#${orderId})</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `📖 <b>សៀវភៅ៖</b> ${existing.productName}\n` +
      `📦 <b>លេខកូដតាមដានកញ្ចប់អីវ៉ាន់ (Tracking):</b> <code>${trackingNumber}</code>\n` +
      `📍 <b>ស្ថានភាព៖</b> ${shippingStatus === 'shipped' ? 'កំពុងដឹកជញ្ជូន' : shippingStatus === 'delivered' ? 'បានប្រគល់ជូនរួច' : 'កំពុងរៀបចំ'}\n\n` +
      `សូមរង់ចាំទទួលទូរស័ព្ទពីខាងអ្នកដឹកជញ្ជូន។ សូមអរគុណ! 🙏`;
    await TelegramBotService.sendMessage(existing.telegramId, notifyMsg, { parse_mode: 'HTML' });
  }

  res.json({ success: true, order: updated });
});

// ==========================================
// 5. CUSTOMERS
// ==========================================
apiRouter.get('/customers', (req, res) => {
  res.json(db.getCustomers());
});

apiRouter.put('/customers/:id', (req, res) => {
  const updated = db.updateCustomer(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Customer not found' });
  res.json(updated);
});

apiRouter.delete('/customers/:id', (req, res) => {
  const success = db.deleteCustomer(req.params.id);
  if (!success) return res.status(404).json({ error: 'Customer not found' });
  res.json({ success: true });
});

apiRouter.put('/customers/:telegramId/balance', (req, res) => {
  const numId = parseInt(req.params.telegramId, 10);
  const delta = Number(req.body.delta) || 0;
  const updated = db.updateCustomerBalance(numId, delta);
  if (!updated) return res.status(404).json({ error: 'Customer not found' });
  res.json(updated);
});

// ==========================================
// 6. COUPONS
// ==========================================
apiRouter.get('/coupons', (req, res) => {
  res.json(db.getCoupons());
});

apiRouter.post('/coupons', (req, res) => {
  const body = req.body;
  const newCoupon: Coupon = {
    id: `cpn_${Date.now()}`,
    code: (body.code || 'PROMO').toUpperCase().trim(),
    type: body.type === 'percentage' ? 'percentage' : 'fixed',
    value: Number(body.value) || 1,
    minOrderAmount: Number(body.minOrderAmount) || 0,
    maxUses: Number(body.maxUses) || 100,
    usedCount: 0,
    expiresAt: body.expiresAt || null,
    isActive: body.isActive !== false
  };

  const created = db.addCoupon(newCoupon);
  res.status(201).json(created);
});

apiRouter.put('/coupons/:id', (req, res) => {
  const updated = db.updateCoupon(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Coupon not found' });
  res.json(updated);
});

apiRouter.delete('/coupons/:id', (req, res) => {
  const success = db.deleteCoupon(req.params.id);
  if (!success) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ success: true });
});

// ==========================================
// 7. SETTINGS
// ==========================================
apiRouter.get('/settings', (req, res) => {
  res.json(db.getSettings());
});

apiRouter.put('/settings', (req, res) => {
  const oldSettings = db.getSettings();
  const updated = db.updateSettings(req.body);

  // If polling status changed
  if (req.body.isPollingActive !== undefined) {
    if (req.body.isPollingActive && !oldSettings.isPollingActive) {
      TelegramBotService.startPolling();
    } else if (!req.body.isPollingActive && oldSettings.isPollingActive) {
      TelegramBotService.stopPolling();
    }
  }

  res.json(updated);
});

// ==========================================
// 8. BROADCAST
// ==========================================
apiRouter.post('/broadcast', async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message content is required' });
  }

  const allCustomers = db.getCustomers();
  const activeCustomers = allCustomers.filter(c => !c.isBlocked);
  let successCount = 0;
  let failCount = 0;

  for (const cust of activeCustomers) {
    try {
      const sent = await TelegramBotService.sendMessage(cust.telegramId, message, { parse_mode: 'HTML' });
      if (sent) successCount++;
      else failCount++;
      // Brief rate-limit protection
      await new Promise(r => setTimeout(r, 100));
    } catch {
      failCount++;
    }
  }

  res.json({ total: allCustomers.length, eligible: activeCustomers.length, sent: successCount, failed: failCount });
});

// ==========================================
// 9. INTERACTIVE BOT SIMULATOR
// ==========================================
apiRouter.post('/simulator/send', async (req, res) => {
  const { text, username, firstName, telegramId } = req.body;
  const simUserId = telegramId || 99881122;
  const simUsername = username || 'sim_customer';
  const simFirstName = firstName || 'Tester';

  // Process text message through the bot router
  await TelegramBotService.handleTextMessage(`sim_${simUserId}`, text || '', {
    id: simUserId,
    username: simUsername,
    first_name: simFirstName
  });

  res.json({ success: true });
});

apiRouter.post('/simulator/callback', async (req, res) => {
  const { callbackData, username, firstName, telegramId } = req.body;
  const simUserId = telegramId || 99881122;

  await TelegramBotService.handleCallbackQuery({
    id: `sim_cb_${Date.now()}`,
    data: callbackData,
    from: {
      id: simUserId,
      username: username || 'sim_customer',
      first_name: firstName || 'Tester'
    },
    message: {
      chat: { id: `sim_${simUserId}` },
      message_id: 1
    }
  });

  res.json({ success: true });
});

apiRouter.post('/simulator/mock-pay/:orderId', async (req, res) => {
  const orderId = req.params.orderId;
  const order = db.getOrders().find(o => o.id === orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Trigger fulfillment pipeline
  const fulfilled = await TelegramBotService.fulfillOrder(orderId);
  res.json({ success: fulfilled, order: db.getOrders().find(o => o.id === orderId) });
});

apiRouter.post('/simulator/send-slip', async (req, res) => {
  const { slipUrl, telegramId, username, firstName, caption } = req.body;
  const simUserId = telegramId || 99881122;
  const simUsername = username || 'sim_customer';
  const simFirstName = firstName || 'Tester';

  await TelegramBotService.handleIncomingPaymentSlip(
    `sim_${simUserId}`,
    slipUrl || 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=60',
    {
      id: simUserId,
      username: simUsername,
      first_name: simFirstName
    },
    caption
  );

  res.json({ success: true });
});

// ==========================================
// 10. REAL TELEGRAM BOT WEBHOOK & VERIFICATION
// ==========================================
// Webhook endpoint for live Telegram Bot updates (wakes up Cloud Run on demand 24/7)
apiRouter.post('/telegram/webhook', async (req, res) => {
  // Respond to Telegram immediately with 200 OK so Telegram doesn't retry
  res.status(200).json({ ok: true });

  try {
    const update = req.body;
    if (update) {
      await TelegramBotService.handleUpdate(update);
    }
  } catch (err) {
    console.error('Error handling Telegram webhook update:', err);
  }
});

// Verify token and get bot details from Telegram getMe
apiRouter.post('/telegram/verify', async (req, res) => {
  const { token } = req.body;
  const result = await TelegramBotService.getMe(token);
  if (result.ok && result.bot?.username) {
    // Auto-update bot username in db settings if matching
    db.updateSettings({ botUsername: result.bot.username });
  }
  res.json(result);
});

// Get live webhook diagnostic info from Telegram
apiRouter.post('/telegram/webhook-info', async (req, res) => {
  const { token } = req.body;
  const result = await TelegramBotService.getWebhookInfo(token);
  res.json(result);
});

// Set live webhook on Telegram & persist configuration
apiRouter.post('/telegram/set-webhook', async (req, res) => {
  const { url, token } = req.body;
  const result = await TelegramBotService.setWebhook(url, token);
  if (result.ok) {
    db.updateSettings({
      webhookUrl: url,
      webhookEnabled: true,
      isPollingActive: false,
      lastWebhookSync: new Date().toISOString()
    });
    // Stop polling loop because Telegram disallows polling while webhook is set
    TelegramBotService.stopPolling();
  }
  res.json(result);
});

// Delete webhook to enable long polling
apiRouter.post('/telegram/delete-webhook', async (req, res) => {
  const { token } = req.body;
  const result = await TelegramBotService.deleteWebhook(token);
  if (result.ok) {
    db.updateSettings({
      webhookEnabled: false,
      isPollingActive: true
    });
    TelegramBotService.startPolling();
  }
  res.json(result);
});

// ==========================================
// 11. DATA SAFETY & AUTO-BACKUP API
// ==========================================
apiRouter.get('/backups', (req, res) => {
  res.json(db.getBackups());
});

apiRouter.post('/backups/create', (req, res) => {
  const backup = db.createManualBackup();
  res.status(201).json(backup);
});

apiRouter.post('/backups/restore/:filename', (req, res) => {
  const success = db.restoreBackup(req.params.filename);
  if (!success) return res.status(400).json({ error: 'Failed to restore backup' });
  res.json({ success: true });
});

apiRouter.get('/backups/download', (req, res) => {
  const data = db.getData();
  res.setHeader('Content-Disposition', `attachment; filename="store_backup_${Date.now()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});
