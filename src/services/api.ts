import type {
  Product,
  StockItem,
  Customer,
  Order,
  Coupon,
  BotSettings,
  DashboardStats,
  BackupRecord
} from '../types/store';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const contentType = res.headers.get('content-type') || '';
  
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    throw new Error(`Expected JSON but received ${contentType || 'non-JSON'} (status ${res.status}): ${text.slice(0, 80)}`);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}: Failed to fetch ${url}`);
  }
  return data as T;
}

async function requestOk(url: string, init?: RequestInit): Promise<boolean> {
  try {
    const res = await fetch(url, init);
    return res.ok;
  } catch {
    return false;
  }
}

export const api = {
  // Stats
  async getStats(): Promise<DashboardStats> {
    return requestJson<DashboardStats>('/api/stats');
  },

  // Products
  async getProducts(): Promise<Product[]> {
    return requestJson<Product[]>('/api/products');
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    return requestJson<Product>('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    return requestJson<Product>(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  },

  async deleteProduct(id: string): Promise<boolean> {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete product');
    }
    return true;
  },

  // Stock
  async getStock(productId?: string, status?: string): Promise<StockItem[]> {
    const params = new URLSearchParams();
    if (productId) params.append('productId', productId);
    if (status) params.append('status', status);
    return requestJson<StockItem[]>(`/api/stock?${params.toString()}`);
  },

  async bulkAddStock(productId: string, lines: string): Promise<{ count: number; items: StockItem[] }> {
    return requestJson<{ count: number; items: StockItem[] }>('/api/stock/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, lines })
    });
  },

  async addStockItem(productId: string, content: string): Promise<StockItem> {
    return requestJson<StockItem>('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, content })
    });
  },

  async updateStockItem(id: string, updates: Partial<StockItem>): Promise<StockItem> {
    return requestJson<StockItem>(`/api/stock/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  },

  async deleteStockItem(id: string): Promise<boolean> {
    return requestOk(`/api/stock/${id}`, { method: 'DELETE' });
  },

  // Orders
  async getOrders(search?: string, status?: string): Promise<Order[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    return requestJson<Order[]>(`/api/orders?${params.toString()}`);
  },

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<{ success: boolean; order?: Order }> {
    return requestJson<{ success: boolean; order?: Order }>(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  },

  async deleteOrder(orderId: string): Promise<boolean> {
    return requestOk(`/api/orders/${orderId}`, { method: 'DELETE' });
  },

  async fulfillOrder(orderId: string): Promise<{ success: boolean; order?: Order; error?: string }> {
    return requestJson<{ success: boolean; order?: Order; error?: string }>(`/api/orders/${orderId}/fulfill`, {
      method: 'POST'
    });
  },

  async cancelOrder(orderId: string): Promise<{ success: boolean; order?: Order }> {
    return requestJson<{ success: boolean; order?: Order }>(`/api/orders/${orderId}/cancel`, {
      method: 'POST'
    });
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
    return requestJson<{ success: boolean; order?: Order }>(`/api/orders/${orderId}/shipping`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shippingData)
    });
  },

  // Customers
  async getCustomers(): Promise<Customer[]> {
    return requestJson<Customer[]>('/api/customers');
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    return requestJson<Customer>(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  },

  async deleteCustomer(id: string): Promise<boolean> {
    return requestOk(`/api/customers/${id}`, { method: 'DELETE' });
  },

  async updateCustomerBalance(telegramId: number, delta: number): Promise<Customer> {
    return requestJson<Customer>(`/api/customers/${telegramId}/balance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta })
    });
  },

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    return requestJson<Coupon[]>('/api/coupons');
  },

  async createCoupon(coupon: Partial<Coupon>): Promise<Coupon> {
    return requestJson<Coupon>('/api/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coupon)
    });
  },

  async updateCoupon(id: string, updates: Partial<Coupon>): Promise<Coupon> {
    return requestJson<Coupon>(`/api/coupons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  },

  async deleteCoupon(id: string): Promise<boolean> {
    return requestOk(`/api/coupons/${id}`, { method: 'DELETE' });
  },

  // Settings
  async getSettings(): Promise<BotSettings> {
    return requestJson<BotSettings>('/api/settings');
  },

  async updateSettings(settings: Partial<BotSettings>): Promise<BotSettings> {
    return requestJson<BotSettings>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  },

  // Broadcast
  async getBroadcastTargets(): Promise<{ usersCount: number; groupsCount: number; totalCount: number; groups: any[] }> {
    return requestJson<{ usersCount: number; groupsCount: number; totalCount: number; groups: any[] }>('/api/broadcast/targets');
  },

  async sendBroadcast(
    message: string,
    target: 'all' | 'users' | 'groups' = 'all',
    photoUrl?: string
  ): Promise<{ total: number; sent: number; failed: number; target: string }> {
    return requestJson<{ total: number; sent: number; failed: number; target: string }>('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, target, photoUrl })
    });
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
    return requestJson<{ success: boolean; order?: Order }>(`/api/simulator/mock-pay/${orderId}`, {
      method: 'POST'
    });
  },

  async simulatorSendSlip(slipUrl?: string, telegramId = 99881122, username = 'sim_customer', firstName = 'Tester', caption?: string): Promise<{ success: boolean }> {
    return requestJson<{ success: boolean }>('/api/simulator/send-slip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slipUrl, telegramId, username, firstName, caption })
    });
  },

  // Real Telegram Bot verification & webhook
  async verifyTelegramToken(token?: string): Promise<{ ok: boolean; bot?: any; error?: string }> {
    return requestJson<{ ok: boolean; bot?: any; error?: string }>('/api/telegram/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
  },

  async getTelegramWebhookInfo(token?: string): Promise<{ ok: boolean; info?: any; error?: string }> {
    return requestJson<{ ok: boolean; info?: any; error?: string }>('/api/telegram/webhook-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
  },

  async setTelegramWebhook(url: string, token?: string): Promise<{ ok: boolean; description?: string }> {
    return requestJson<{ ok: boolean; description?: string }>('/api/telegram/set-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token })
    });
  },

  async deleteTelegramWebhook(token?: string): Promise<{ ok: boolean; description?: string }> {
    return requestJson<{ ok: boolean; description?: string }>('/api/telegram/delete-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
  },

  // Backups & Data Protection
  async getBackups(): Promise<BackupRecord[]> {
    return requestJson<BackupRecord[]>('/api/backups');
  },

  async createBackup(note?: string): Promise<BackupRecord> {
    return requestJson<BackupRecord>('/api/backups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
  },

  async restoreBackup(filename: string): Promise<{ success: boolean; message: string; backup: string }> {
    return requestJson<{ success: boolean; message: string; backup: string }>(`/api/backups/restore/${encodeURIComponent(filename)}`, {
      method: 'POST'
    });
  }
};
