import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { StockView } from './components/StockView';
import { OrdersView } from './components/OrdersView';
import { CustomersView } from './components/CustomersView';
import { CouponsView } from './components/CouponsView';
import { BroadcastView } from './components/BroadcastView';
import { SettingsView } from './components/SettingsView';
import { TelegramSimulatorModal } from './components/TelegramSimulatorModal';
import { QuickActivateBotModal } from './components/QuickActivateBotModal';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { api } from './services/api';
import type {
  DashboardStats,
  Product,
  StockItem,
  Order,
  Customer,
  Coupon,
  BotSettings
} from './types/store';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [settings, setSettings] = useState<BotSettings | null>(null);

  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch all core application data
  const loadAllData = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const [
        statsData,
        productsData,
        stockData,
        ordersData,
        customersData,
        couponsData,
        settingsData
      ] = await Promise.all([
        api.getStats(),
        api.getProducts(),
        api.getStock(),
        api.getOrders(),
        api.getCustomers(),
        api.getCoupons(),
        api.getSettings()
      ]);

      setStats(statsData);
      setProducts(productsData);
      setStock(stockData);
      setOrders(ordersData);
      setCustomers(customersData);
      setCoupons(couponsData);
      setSettings(settingsData);
      setErrorMessage(null);
    } catch (err: any) {
      if (!quiet) {
        console.warn('Initial store data load pending:', err?.message || err);
        setErrorMessage('កំពុងភ្ជាប់ទៅកាន់ Server... សូមរង់ចាំបន្តិច ឬចុច Reload');
      }
    } finally {
      if (!quiet) setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Background auto-refresh polling every 5 seconds to keep stats and orders live
  useEffect(() => {
    const timer = setInterval(() => {
      loadAllData(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [loadAllData]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts(prev => [...prev, { id: `t_${Date.now()}_${Math.random()}`, type, title, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Product Handlers
  const handleCreateProduct = async (prod: Partial<Product>) => {
    try {
      await api.createProduct(prod);
      showToast('success', 'បង្កើតទំនិញជោគជ័យ!', `បានបន្ថែម "${prod.name}" ចូលក្នុងបញ្ជីលក់`);
      await loadAllData(true);
    } catch {
      showToast('error', 'បង្កើតទំនិញបរាជ័យ');
    }
  };

  const handleUpdateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      await api.updateProduct(id, updates);
      showToast('success', 'កែប្រែទំនិញជោគជ័យ!');
      await loadAllData(true);
    } catch {
      showToast('error', 'កែប្រែទំនិញបរាជ័យ');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      showToast('info', 'បានលុបទំនិញរួចរាល់');
      await loadAllData(true);
    } catch {
      showToast('error', 'លុបទំនិញបរាជ័យ');
    }
  };

  // Stock Handlers
  const handleBulkAddStock = async (productId: string, lines: string) => {
    try {
      const res = await api.bulkAddStock(productId, lines);
      showToast('success', 'បញ្ចូលស្តុកជោគជ័យ!', `បានបញ្ចូលចំនួន ${res.count} accounts`);
      await loadAllData(true);
    } catch {
      showToast('error', 'បញ្ចូលស្តុកបរាជ័យ');
    }
  };

  const handleAddStockItem = async (productId: string, content: string) => {
    try {
      await api.addStockItem(productId, content);
      showToast('success', 'បានបន្ថែម Account ចូលស្តុក');
      await loadAllData(true);
    } catch {
      showToast('error', 'បន្ថែមស្តុកបរាជ័យ');
    }
  };

  const handleDeleteStockItem = async (id: string) => {
    try {
      await api.deleteStockItem(id);
      showToast('info', 'បានលុប Account ចេញពីស្តុក');
      await loadAllData(true);
    } catch {
      showToast('error', 'លុបស្តុកបរាជ័យ');
    }
  };

  // Order Handlers
  const handleFulfillOrder = async (orderId: string) => {
    try {
      const res = await api.fulfillOrder(orderId);
      if (!res.success) {
        showToast('error', 'ការ Fulfill បរាជ័យ', res.error || 'ស្តុកមិនគ្រប់គ្រាន់');
      } else {
        showToast('success', 'Fulfill ជោគជ័យ! ⚡', `បានប្រគល់ Account ទៅកាន់ Telegram អតិថិជនរួចរាល់ (#${orderId})`);
      }
      await loadAllData(true);
    } catch {
      showToast('error', 'មានបញ្ហាក្នុងការ Fulfill');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await api.cancelOrder(orderId);
      showToast('info', `បានបោះបង់ Order #${orderId}`, 'ស្តុកដែលកក់ត្រូវបានដោះលែងវិញ');
      await loadAllData(true);
    } catch {
      showToast('error', 'មិនអាចបោះបង់ Order បានទេ');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const ok = await api.deleteOrder(orderId);
      if (ok) {
        showToast('info', 'បានលុបការបញ្ជាទិញរួចរាល់', `Order #${orderId} ត្រូវបានលុបចេញពីប្រព័ន្ធ`);
        await loadAllData(true);
      } else {
        showToast('error', 'លុបការបញ្ជាទិញបរាជ័យ');
      }
    } catch {
      showToast('error', 'មានបញ្ហាក្នុងការលុប Order');
    }
  };

  const handleUpdateOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
      const res = await api.updateOrder(orderId, updates);
      if (res.success) {
        showToast('success', 'កែប្រែ Order ជោគជ័យ!', `បានធ្វើបច្ចុប្បន្នភាព Order #${orderId}`);
        await loadAllData(true);
      } else {
        showToast('error', 'កែប្រែ Order បរាជ័យ');
      }
    } catch {
      showToast('error', 'មានបញ្ហាក្នុងការកែប្រែ Order');
    }
  };

  const handleUpdateShipping = async (orderId: string, shippingData: any) => {
    try {
      await api.updateOrderShipping(orderId, shippingData);
      showToast('success', 'បានធ្វើបច្ចុប្បន្នភាពដឹកជញ្ជូន!', `វិក្កយបត្រ #${orderId}`);
      await loadAllData(true);
    } catch {
      showToast('error', 'មិនអាចកែប្រែព័ត៌មានដឹកជញ្ជូនបានទេ');
    }
  };

  const handleUpdateStockItem = async (id: string, updates: Partial<StockItem>) => {
    try {
      await api.updateStockItem(id, updates);
      showToast('success', 'កែប្រែទិន្នន័យស្តុកជោគជ័យ!');
      await loadAllData(true);
    } catch {
      showToast('error', 'កែប្រែស្តុកបរាជ័យ');
    }
  };

  // Customer Handlers
  const handleUpdateBalance = async (telegramId: number, delta: number) => {
    try {
      await api.updateCustomerBalance(telegramId, delta);
      showToast('success', 'បានកែប្រែសមតុល្យកម្រៃជើងសារ');
      await loadAllData(true);
    } catch {
      showToast('error', 'កែប្រែសមតុល្យបរាជ័យ');
    }
  };

  const handleUpdateCustomer = async (id: string, updates: Partial<Customer>) => {
    try {
      await api.updateCustomer(id, updates);
      showToast('success', 'កែប្រែព័ត៌មានអតិថិជនជោគជ័យ!');
      await loadAllData(true);
    } catch {
      showToast('error', 'កែប្រែអតិថិជនបរាជ័យ');
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      await api.deleteCustomer(id);
      showToast('info', 'បានលុបអតិថិជនចេញពីបញ្ជី');
      await loadAllData(true);
    } catch {
      showToast('error', 'លុបអតិថិជនបរាជ័យ');
    }
  };

  // Coupon Handlers
  const handleCreateCoupon = async (coupon: Partial<Coupon>) => {
    try {
      await api.createCoupon(coupon);
      showToast('success', 'បង្កើត Coupon ជោគជ័យ!', `កូដ ${coupon.code} ត្រូវបានដាក់ឲ្យប្រើប្រាស់`);
      await loadAllData(true);
    } catch {
      showToast('error', 'បង្កើត Coupon បរាជ័យ');
    }
  };

  const handleUpdateCoupon = async (id: string, updates: Partial<Coupon>) => {
    try {
      await api.updateCoupon(id, updates);
      showToast('success', 'កែប្រែ Coupon ជោគជ័យ!');
      await loadAllData(true);
    } catch {
      showToast('error', 'កែប្រែ Coupon បរាជ័យ');
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      await api.deleteCoupon(id);
      showToast('info', 'បានលុប Coupon');
      await loadAllData(true);
    } catch {
      showToast('error', 'លុប Coupon បរាជ័យ');
    }
  };

  // Settings Handlers
  const handleUpdateSettings = async (newSettings: Partial<BotSettings>) => {
    try {
      const updated = await api.updateSettings(newSettings);
      setSettings(updated);
      showToast('success', 'រក្សាទុកការកំណត់ជោគជ័យ!');
      await loadAllData(true);
    } catch {
      showToast('error', 'រក្សាទុកការកំណត់បរាជ័យ');
    }
  };

  // Broadcast Handlers
  const handleSendBroadcast = async (message: string) => {
    try {
      const res = await api.sendBroadcast(message);
      showToast('success', 'ការផ្សាយដំណឹងបានបញ្ចប់!', `ផ្ញើបាន ${res.sent}/${res.total} នាក់`);
      await loadAllData(true);
      return res;
    } catch {
      showToast('error', 'ផ្សាយដំណឹងបរាជ័យ');
      throw new Error('Broadcast failed');
    }
  };

  // Stock count helper by product
  const stockCounts: Record<string, number> = {};
  for (const s of stock) {
    if (s.status === 'available') {
      stockCounts[s.productId] = (stockCounts[s.productId] || 0) + 1;
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openSimulator={() => setIsSimulatorOpen(true)}
        openActivateModal={() => setIsActivateModalOpen(true)}
        settings={settings}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          stats={stats}
          settings={settings}
          onRefresh={() => loadAllData(false)}
          openSimulator={() => setIsSimulatorOpen(true)}
          onNavigateTab={setActiveTab}
          isRefreshing={isRefreshing}
        />

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="bg-rose-950/80 border-b border-rose-800 text-rose-200 px-6 py-2 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Dynamic View Tab Routing */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              onNavigateTab={setActiveTab}
              openSimulator={() => setIsSimulatorOpen(true)}
            />
          )}

          {activeTab === 'products' && (
            <ProductsView
              products={products}
              onCreateProduct={handleCreateProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              stockCounts={stockCounts}
            />
          )}

          {activeTab === 'stock' && (
            <StockView
              products={products}
              stock={stock}
              onBulkAddStock={handleBulkAddStock}
              onAddStockItem={handleAddStockItem}
              onUpdateStockItem={handleUpdateStockItem}
              onDeleteStockItem={handleDeleteStockItem}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              orders={orders}
              onFulfillOrder={handleFulfillOrder}
              onCancelOrder={handleCancelOrder}
              onDeleteOrder={handleDeleteOrder}
              onUpdateOrder={handleUpdateOrder}
              onUpdateShipping={handleUpdateShipping}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              customers={customers}
              onUpdateBalance={handleUpdateBalance}
              onUpdateCustomer={handleUpdateCustomer}
              onDeleteCustomer={handleDeleteCustomer}
            />
          )}

          {activeTab === 'coupons' && (
            <CouponsView
              coupons={coupons}
              onCreateCoupon={handleCreateCoupon}
              onUpdateCoupon={handleUpdateCoupon}
              onDeleteCoupon={handleDeleteCoupon}
            />
          )}

          {activeTab === 'broadcast' && (
            <BroadcastView
              customers={customers}
              onSendBroadcast={handleSendBroadcast}
            />
          )}

          {activeTab === 'settings' && settings && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
            />
          )}
        </main>
      </div>

      {/* Interactive Telegram Bot Phone Simulator Modal */}
      <TelegramSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        settings={settings}
        onDataChanged={() => loadAllData(true)}
      />

      {/* Quick 1-Click Bot Activation Modal */}
      <QuickActivateBotModal
        isOpen={isActivateModalOpen}
        onClose={() => setIsActivateModalOpen(false)}
        settings={settings}
        onActivated={async () => {
          await loadAllData(false);
        }}
      />

      {/* Floating Modern Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
