export interface BulkPricingTier {
  minQty: number;
  maxQty: number | null;
  pricePerUnit: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number; // Unit price in USD
  bulkPricingEnabled: boolean;
  tiers: BulkPricingTier[];
  instructions: string;
  badge: string; // e.g., '🔥 HOT', '⭐ BEST', '📄 PDF', '📖 PRINT'
  isActive: boolean;
  createdAt: string;
  bookFormat?: 'pdf' | 'printed' | 'both';
  author?: string;
  pages?: number;
  fileSize?: string; // e.g., '14.5 MB'
  pdfDownloadUrl?: string; // For PDF delivery
  publisher?: string;
  isbn?: string;
  coverImage?: string;
  samplePreviewText?: string;
  sampleQuestions?: SampleQuestion[];
  updatedAt?: string;
  editHistory?: EditHistoryEntry[];
}

export interface SampleQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

export interface EditHistoryEntry {
  timestamp: string;
  action: string;
  note: string;
  previousData?: Record<string, any>;
}

export interface BackupRecord {
  filename: string;
  timestamp: string;
  sizeKb: number;
  note?: string;
  itemCount: {
    products: number;
    orders: number;
    stock: number;
    customers: number;
    coupons: number;
  };
}

export type StockStatus = 'available' | 'reserved' | 'sold';

export interface StockItem {
  id: string;
  productId: string;
  content: string; // PDF Access token/link or Hardcopy Book Serial / Barcode
  status: StockStatus;
  reservedUntil: number | null; // Timestamp ms
  orderId: string | null;
  addedAt: string;
  soldAt: string | null;
  updatedAt?: string;
  editHistory?: EditHistoryEntry[];
}

export interface Customer {
  id: string;
  telegramId: number;
  username: string;
  firstName: string;
  lastName?: string;
  joinedAt: string;
  totalOrders: number;
  totalSpent: number;
  referredBy: string | null; // Telegram ID of referrer
  referralCode: string;
  walletBalance: number; // Commission balance in USD
  phone?: string;
  phoneNumber?: string;
  defaultShippingAddress?: string;
  updatedAt?: string;
  editHistory?: EditHistoryEntry[];
  isBlocked?: boolean;
  botBlockedAt?: string;
}

export type OrderStatus = 'pending' | 'completed' | 'expired' | 'stock_depleted_refund_needed' | 'rejected';

export interface Order {
  id: string; // ORD-XXXXXX
  referenceId: string;
  telegramId: string;
  telegramUsername: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  couponCode: string | null;
  totalAmount: number;
  status: OrderStatus;
  paymentProvider: 'cutluy' | 'manual';
  cutluyPaymentId: string | null;
  checkoutUrl: string | null;
  qrString: string | null;
  qrImageDataUrl?: string | null;
  expiresAt: string;
  deliveredItems: string[];
  referralTelegramId: string | null;
  commissionEarned: number;
  createdAt: string;
  completedAt: string | null;
  errorMessage?: string;
  bookFormat?: 'pdf' | 'printed' | 'both';
  shippingRecipient?: string;
  shippingPhone?: string;
  shippingAddress?: string;
  shippingStatus?: 'pending' | 'preparing' | 'shipped' | 'delivered';
  shippingFee?: number;
  shippingSpeed?: 'standard' | 'express';
  shippingNotes?: string;
  shippingLocation?: { latitude: number; longitude: number; googleMapsUrl?: string };
  province?: string;
  branch?: string;
  courierService?: string;
  totalAmountKhr?: number;
  items?: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; bookFormat?: string }>;
  receiptDataUrl?: string;
  trackingNumber?: string;
  pdfDownloadUrl?: string;
  paymentSlipUrl?: string | null;
  adminNotes?: string | null;
  updatedAt?: string;
  editHistory?: EditHistoryEntry[];
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderAmount: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  updatedAt?: string;
  editHistory?: EditHistoryEntry[];
}

export interface BotSettings {
  botToken: string;
  botUsername: string;
  channelId: string;
  adminTelegramId?: string;
  adminGroupId?: string;
  supportUsername: string;
  supportPhone?: string;
  welcomeMessage: string;
  postPurchaseInstructions: string;
  cutluyApiKey: string;
  qrExpiryMinutes: number;
  referralEnabled: boolean;
  referralCommissionPerAccount: number;
  alertAdminOnNewStock: boolean;
  broadcastOnNewStock: boolean;
  stockDepletedPolicyMessage: string;
  isPollingActive: boolean;
  shippingFeePhnomPenh?: number;
  shippingFeeSameDay?: number;
  shippingFeeProvince?: number;
  freeShippingThreshold?: number;
  khrExchangeRate?: number;
  webhookUrl?: string;
  webhookEnabled?: boolean;
  webhookSecretToken?: string;
  lastWebhookSync?: string;
  paymentLink?: string;
  accountHolderName?: string;
}

export interface KnownGroup {
  id: string | number;
  title?: string;
  type?: 'group' | 'supergroup' | 'channel' | string;
  addedAt: string;
}

export interface AppStoreData {
  products: Product[];
  stock: StockItem[];
  customers: Customer[];
  orders: Order[];
  coupons: Coupon[];
  settings: BotSettings;
  knownGroups?: KnownGroup[];
}

export interface DashboardStats {
  totalRevenue: number;
  completedOrdersCount: number;
  soldAccountsCount: number;
  totalStockAvailable: number;
  totalStockReserved: number;
  totalCustomers: number;
  recentOrders: Order[];
  revenueByDay: { date: string; amount: number; count: number }[];
  salesByProduct: { productName: string; count: number; revenue: number }[];
}

export interface BotSimulatorMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  photoUrl?: string;
  inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>>;
  replyKeyboard?: Array<Array<string>>;
}
