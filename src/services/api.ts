import type {
  AppStoreData,
  Product,
  StockItem,
  Customer,
  Order,
  Coupon,
  BotSettings,
  DashboardStats,
  BackupRecord
} from '../types/store';

export const api = {
  // Stats
  async getStats(): Promise<DashboardStats> {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  // Products
  async getProducts(): Promise<Product[]> {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (!res.ok) throw new Error('Failed to create product');
    return res.json();
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update product');
    return res.json();
  },

  async deleteProduct(id: string): Promise<boolean> {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  // Stock
  async getStock(productId?: string, status?: string): Promise<StockItem[]> {
    const params = new URLSearchParams();
    if (productId) params.append('productId', productId);
    if (status) params.append('status', status);
    const res = await fetch(`/api/stock?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch stock');
    return res.json();
  },

  async bulkAddStock(productId: string, lines: string): Promise<{ count: number; items: StockItem[] }> {
    const res = await fetch('/api/stock/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, lines })
    });
    if (!res.ok) throw new Error('Failed to import stock');
    return res.json();
  },

  async addStockItem(productId: string, content: string): Promise<StockItem> {
    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, content })
    });
    if (!res.ok) throw new Error('Failed to add stock item');
    return res.json();
  },

  async updateStockItem(id: string, updates: Partial<StockItem>): Promise<StockItem> {
    const res = await fetch(`/api/stock/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update stock item');
    return res.json();
  },

  async deleteStockItem(id: string): Promise<boolean> {
    const res = await fetch(`/api/stock/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  // Orders
  async getOrders(search?: string, status?: string): Promise<Order[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    const res = await fetch(`/api/orders?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<{ success: boolean; order?: Order }> {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update order');
    return res.json();
  },

  async deleteOrder(orderId: string): Promise<boolean> {
    const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    return res.ok;
  },

  async fulfillOrder(orderId: string): Promise<{ success: boolean; order?: Order; error?: string }> {
    const res = await fetch(`/api/orders/${orderId}/fulfill`, { method: 'POST' });
    return res.json();
  },

  async cancelOrder(orderId: string): Promise<{ success: boolean; order?: Order }> {
    const res = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
    return res.json();
  },

  async updateOrderShipping(
    orderId: string,
    shippingData: {
      shippingStatus?: string;
      trackingNumber?: string;
      shippingRecipient?: string;
      shippingPhone?: string;
      shippingAddress?: string;
    }
  ): Promise<{ success: boolean; order?: Order }> {
    const res = await fetch(`/api/orders/${orderId}/shipping`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shippingData)
    });
    return res.json();
  },

  // Customers
  async getCustomers(): Promise<Customer[]> {
    const res = await fetch('/api/customers');
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update customer');
    return res.json();
  },

  async deleteCustomer(id: string): Promise<boolean> {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  async updateCustomerBalance(telegramId: number, delta: number): Promise<Customer> {
    const res = await fetch(`/api/customers/${telegramId}/balance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta })
    });
    if (!res.ok) throw new Error('Failed to update customer balance');
    return res.json();
  },

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    const res = await fetch('/api/coupons');
    if (!res.ok) throw new Error('Failed to fetch coupons');
    return res.json();
  },

  async createCoupon(coupon: Partial<Coupon>): Promise<Coupon> {
    const res = await fetch('/api/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coupon)
    });
    if (!res.ok) throw new Error('Failed to create coupon');
    return res.json();
  },

  async updateCoupon(id: string, updates: Partial<Coupon>): Promise<Coupon> {
    const res = await fetch(`/api/coupons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update coupon');
    return res.json();
  },

  async deleteCoupon(id: string): Promise<boolean> {
    const res = await fetch(`/api/coupons/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  // Settings
  async getSettings(): Promise<BotSettings> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(settings: Partial<BotSettings>): Promise<BotSettings> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  // Broadcast
  async sendBroadcast(message: string): Promise<{ total: number; sent: number; failed: number }> {
    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    if (!res.ok) throw new Error('Failed to send broadcast');
    return res.json();
  },

  // Simulator
  async simulatorSendMessage(text: string, telegramId = 99881122, username = 'sim_customer', firstName = 'Tester'): Promise<void> {
    await fetch('/api/simulator/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, telegramId, username, firstName })
    });
  },

  async simulatorSendCallback(callbackData: string, telegramId = 99881122, username = 'sim_customer', firstName = 'Tester'): Promise<void> {
    await fetch('/api/simulator/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callbackData, telegramId, username, firstName })
    });
  },

  async simulatorMockPay(orderId: string): Promise<{ success: boolean; order?: Order }> {
    const res = await fetch(`/api/simulator/mock-pay/${orderId}`, { method: 'POST' });
    return res.json();
  },

  async simulatorSendSlip(slipUrl?: string, telegramId = 99881122, username = 'sim_customer', firstName = 'Tester', caption?: string): Promise<{ success: boolean }> {
    const res = await fetch('/api/simulator/send-slip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slipUrl, telegramId, username, firstName, caption })
    });
    return res.json();
  },

  // Real Telegram Bot verification & webhook
  async verifyTelegramToken(token?: string): Promise<{ ok: boolean; bot?: any; error?: string }> {
    const res = await fetch('/api/telegram/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    return res.json();
  },

  async getTelegramWebhookInfo(token?: string): Promise<{ ok: boolean; info?: any; error?: string }> {
    const res = await fetch('/api/telegram/webhook-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    return res.json();
  },

  async setTelegramWebhook(url: string, token?: string): Promise<{ ok: boolean; description?: string }> {
    const res = await fetch('/api/telegram/set-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token })
    });
    return res.json();
  },

  async deleteTelegramWebhook(token?: string): Promise<{ ok: boolean; description?: string }> {
    const res = await fetch('/api/telegram/delete-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    return res.json();
  },

  // Backups & Data Protection
  async getBackups(): Promise<BackupRecord[]> {
    const res = await fetch('/api/backups');
    if (!res.ok) throw new Error('Failed to fetch backups');
    return res.json();
  },

  async createBackup(note?: string): Promise<BackupRecord> {
    const res = await fetch('/api/backups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    if (!res.ok) throw new Error('Failed to create backup');
    return res.json();
  },

  async restoreBackup(filename: string): Promise<{ success: boolean; message: string; backup: string }> {
    const res = await fetch(`/api/backups/restore/${encodeURIComponent(filename)}`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to restore backup');
    }
    return res.json();
  }
};
