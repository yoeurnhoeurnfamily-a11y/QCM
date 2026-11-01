import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Zap,
  ExternalLink,
  Copy,
  Check,
  Eye,
  X,
  QrCode,
  BookOpen,
  FileText,
  Truck,
  Download,
  Phone,
  MapPin,
  Package,
  Pencil,
  Trash2,
  History,
  Printer,
  Navigation
} from 'lucide-react';
import type { Order } from '../types/store';

interface OrdersViewProps {
  orders: Order[];
  onFulfillOrder: (orderId: string) => Promise<void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  onDeleteOrder?: (orderId: string) => Promise<void>;
  onUpdateOrder?: (orderId: string, updates: Partial<Order>) => Promise<void>;
  onUpdateShipping?: (orderId: string, shippingData: {
    shippingStatus?: string;
    trackingNumber?: string;
    courierService?: string;
    shippingNotes?: string;
    shippingRecipient?: string;
    shippingPhone?: string;
    shippingAddress?: string;
  }) => Promise<void>;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  onFulfillOrder,
  onCancelOrder,
  onDeleteOrder,
  onUpdateOrder,
  onUpdateShipping
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [waybillOrder, setWaybillOrder] = useState<Order | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Shipping edit states
  const [editTracking, setEditTracking] = useState('');
  const [editStatus, setEditStatus] = useState<string>('preparing');
  const [editCourier, setEditCourier] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingShipping, setIsSavingShipping] = useState(false);

  // Edit Order modal state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editTelegramUsername, setEditTelegramUsername] = useState('');
  const [editOrderStatus, setEditOrderStatus] = useState<Order['status']>('pending');
  const [editTotalAmount, setEditTotalAmount] = useState('0');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editBookFormat, setEditBookFormat] = useState<'pdf' | 'printed' | 'both'>('pdf');
  const [editShippingRecipient, setEditShippingRecipient] = useState('');
  const [editShippingPhone, setEditShippingPhone] = useState('');
  const [editShippingAddress, setEditShippingAddress] = useState('');
  const [editOrderTracking, setEditOrderTracking] = useState('');
  const [editOrderShippingStatus, setEditOrderShippingStatus] = useState<'preparing' | 'shipped' | 'delivered'>('preparing');
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (formatFilter !== 'all' && (o.bookFormat || 'pdf') !== formatFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        o.id.toLowerCase().includes(q) ||
        o.telegramUsername.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(text);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  const handleManualFulfill = async (orderId: string) => {
    if (!confirm(`តើអ្នកពិតជាចង់ Fulfill ការបញ្ជាទិញ #${orderId} ដោយដៃមែនទេ? (ប្រព័ន្ធនឹងប្រគល់សៀវភៅទៅកាន់ Telegram អតិថិជនភ្លាមៗ)`)) {
      return;
    }
    setIsProcessing(orderId);
    try {
      await onFulfillOrder(orderId);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm(`តើអ្នកពិតជាចង់បោះបង់ការបញ្ជាទិញ #${orderId} មែនទេ? (ស្តុកសៀវភៅដែលកក់នឹងត្រូវដោះលែងមក Available វិញ)`)) {
      return;
    }
    setIsProcessing(orderId);
    try {
      await onCancelOrder(orderId);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm(`⚠️ តើអ្នកពិតជាចង់លុបការបញ្ជាទិញ #${orderId} នេះចេញពីប្រព័ន្ធមែនទេ?\n(ប្រសិនបើស្តុកកំពុងកក់ វានឹងត្រូវដោះលែងមកវិញដោយស្វ័យប្រវត្តិ)`)) {
      return;
    }
    if (!onDeleteOrder) return;
    setIsProcessing(orderId);
    try {
      await onDeleteOrder(orderId);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
    } finally {
      setIsProcessing(null);
    }
  };

  const handleOpenEditModal = (ord: Order) => {
    setEditingOrder(ord);
    setEditCustomerName(ord.customerName || '');
    setEditTelegramUsername(ord.telegramUsername || '');
    setEditOrderStatus(ord.status);
    setEditTotalAmount(String(ord.totalAmount));
    setEditQuantity(String(ord.quantity || 1));
    setEditBookFormat(ord.bookFormat || 'pdf');
    setEditShippingRecipient(ord.shippingRecipient || ord.customerName || '');
    setEditShippingPhone(ord.shippingPhone || '');
    setEditShippingAddress(ord.shippingAddress || '');
    setEditOrderTracking(ord.trackingNumber || '');
    setEditOrderShippingStatus((ord.shippingStatus as any) || 'preparing');
  };

  const handleSaveEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder || !onUpdateOrder) return;
    setIsSavingOrder(true);
    try {
      const parsedAmount = parseFloat(editTotalAmount) || editingOrder.totalAmount;
      const parsedQty = parseInt(editQuantity, 10) || editingOrder.quantity;
      await onUpdateOrder(editingOrder.id, {
        customerName: editCustomerName,
        telegramUsername: editTelegramUsername.replace(/^@/, ''),
        status: editOrderStatus,
        totalAmount: parsedAmount,
        quantity: parsedQty,
        bookFormat: editBookFormat,
        shippingRecipient: editShippingRecipient,
        shippingPhone: editShippingPhone,
        shippingAddress: editShippingAddress,
        trackingNumber: editOrderTracking,
        shippingStatus: editOrderShippingStatus
      });
      // Update selected order if viewing
      if (selectedOrder?.id === editingOrder.id) {
        setSelectedOrder(prev => prev ? {
          ...prev,
          customerName: editCustomerName,
          telegramUsername: editTelegramUsername.replace(/^@/, ''),
          status: editOrderStatus,
          totalAmount: parsedAmount,
          quantity: parsedQty,
          bookFormat: editBookFormat,
          shippingRecipient: editShippingRecipient,
          shippingPhone: editShippingPhone,
          shippingAddress: editShippingAddress,
          trackingNumber: editOrderTracking,
          shippingStatus: editOrderShippingStatus
        } : null);
      }
      setEditingOrder(null);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleOpenDetail = (ord: Order) => {
    setSelectedOrder(ord);
    setEditTracking(ord.trackingNumber || '');
    setEditStatus(ord.shippingStatus || 'preparing');
    setEditCourier(ord.courierService || 'VET Express (វីរៈប៊ុនថាំ)');
    setEditNotes(ord.shippingNotes || '');
  };

  const handleSaveShipping = async () => {
    if (!selectedOrder || !onUpdateShipping) return;
    setIsSavingShipping(true);
    try {
      await onUpdateShipping(selectedOrder.id, {
        trackingNumber: editTracking,
        shippingStatus: editStatus,
        courierService: editCourier,
        shippingNotes: editNotes
      });
      setSelectedOrder(prev => prev ? {
        ...prev,
        trackingNumber: editTracking,
        shippingStatus: editStatus as any,
        courierService: editCourier,
        shippingNotes: editNotes
      } : null);
    } finally {
      setIsSavingShipping(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-400" />
            <span>ការបញ្ជាទិញសៀវភៅ (Book Orders - {orders.length})</span>
          </h3>
          <p className="text-xs text-slate-400">តាមដានស្ថានភាពទូទាត់ CutLuy KHQR, ការទាញយក PDF និងការដឹកជញ្ជូនសៀវភៅព្រីន</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/orders/export-csv?format=printed"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>📥 Export បញ្ជីដឹកជញ្ជូន (CSV / Excel)</span>
          </a>
          <a
            href="/api/orders/export-csv?format=all"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export ទាំងអស់</span>
          </a>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/80 border border-slate-800/80 p-3 rounded-xl text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ស្វែងរកតាម Order ID, Tracking, Username, ឬចំណងជើងសៀវភៅ..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-white placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        {/* Format Filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">ប្រភេទ៖</span>
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-hidden"
          >
            <option value="all">សៀវភៅទាំងអស់</option>
            <option value="pdf">📄 សៀវភៅ PDF</option>
            <option value="printed">📖 សៀវភៅព្រីន</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">ស្ថានភាព៖</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-hidden"
          >
            <option value="all">ស្ថានភាពទាំងអស់</option>
            <option value="completed">Completed (ជោគជ័យ)</option>
            <option value="pending">Pending (កំពុងរង់ចាំ)</option>
            <option value="expired">Expired (ផុតកំណត់)</option>
            <option value="stock_depleted_refund_needed">Stock Depleted (អស់ស្តុក)</option>
          </select>
        </div>

        <div className="text-slate-400 font-mono text-[11px] ml-auto">
          បង្ហាញ {filteredOrders.length} orders
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/40">
                <th className="py-3 px-4">វិក្កយបត្រ</th>
                <th className="py-3 px-4">អតិថិជន</th>
                <th className="py-3 px-4">សៀវភៅ</th>
                <th className="py-3 px-4 text-center">ប្រភេទ</th>
                <th className="py-3 px-4 text-right">ចំនួន</th>
                <th className="py-3 px-4 text-right">ទឹកប្រាក់ (USD)</th>
                <th className="py-3 px-4 text-center">ស្ថានភាព</th>
                <th className="py-3 px-4">កាលបរិច្ឆេទ</th>
                <th className="py-3 px-4 text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                    មិនមានការបញ្ជាទិញត្រូវនឹងការស្វែងរកនេះឡើយ។
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isPrinted = ord.bookFormat === 'printed';
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Clock className="w-3 h-3" />
                      <span>Pending</span>
                    </span>
                  );
                  if (ord.status === 'completed') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    );
                  } else if (ord.status === 'expired') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        <XCircle className="w-3 h-3" />
                        <span>Expired</span>
                      </span>
                    );
                  } else if (ord.status === 'stock_depleted_refund_needed') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Depleted</span>
                      </span>
                    );
                  }

                  return (
                    <tr key={ord.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-white block">#{ord.id}</span>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {ord.paymentProvider === 'cutluy' && (
                            <span className="text-[10px] text-indigo-400 font-sans">CutLuy KHQR</span>
                          )}
                          {ord.paymentSlipUrl && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              📸 Slip
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="font-medium text-white block">@{ord.telegramUsername}</span>
                        <span className="text-[11px] text-slate-400">{ord.customerName}</span>
                      </td>
                      <td className="py-3 px-4 font-sans max-w-[200px]">
                        <span className="font-medium text-white truncate block" title={ord.productName}>
                          {ord.productName}
                        </span>
                        {isPrinted && ord.trackingNumber && (
                          <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                            <Truck className="w-2.5 h-2.5" /> {ord.trackingNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                            isPrinted
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {isPrinted ? <BookOpen className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                          <span>{isPrinted ? 'ព្រីន' : 'PDF'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-slate-200">
                          {ord.quantity} {isPrinted ? 'ក្បាល' : 'ច្បាប់'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-white font-mono">${ord.totalAmount.toFixed(2)}</span>
                      </td>
                      <td className="py-3 px-4 text-center">{statusBadge}</td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(ord.createdAt).toLocaleDateString('km-KH')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 font-sans">
                          <button
                            onClick={() => handleOpenDetail(ord)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="មើលព័ត៌មានលម្អិត & ដឹកជញ្ជូន"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {ord.bookFormat === 'printed' && (
                            <button
                              onClick={() => setWaybillOrder(ord)}
                              className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 hover:text-white transition-colors cursor-pointer"
                              title="ព្រីនស្លាកដឹកជញ្ជូន A6 (Waybill Sticker)"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onUpdateOrder && (
                            <button
                              onClick={() => handleOpenEditModal(ord)}
                              className="p-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all cursor-pointer"
                              title="កែប្រែព័ត៌មាន Order"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {ord.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleManualFulfill(ord.id)}
                                disabled={isProcessing === ord.id}
                                className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                                title="Fulfill ដោយដៃ"
                              >
                                <Zap className="w-3 h-3" />
                                <span>Fulfill</span>
                              </button>
                              <button
                                onClick={() => handleCancel(ord.id)}
                                disabled={isProcessing === ord.id}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors cursor-pointer"
                                title="បោះបង់ Order (ដោះលែងស្តុក)"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {onDeleteOrder && (
                            <button
                              onClick={() => handleDelete(ord.id)}
                              disabled={isProcessing === ord.id}
                              className="p-1.5 rounded-xl bg-[#231224] hover:bg-[#321734] border border-rose-500/30 hover:border-rose-400/50 text-[#ff5c8a] hover:text-rose-300 transition-all active:scale-95 cursor-pointer shadow-xs"
                              title="លុប Order ចេញពីប្រព័ន្ធ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail & Shipping Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>វិក្កយបត្រ #{selectedOrder.id}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-sans font-semibold ${
                      selectedOrder.bookFormat === 'printed'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }`}
                  >
                    {selectedOrder.bookFormat === 'printed' ? '📖 សៀវភៅព្រីន' : '📄 សៀវភៅ PDF'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">កាលបរិច្ឆេទ៖ {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Customer & Product Card */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block">អតិថិជន</span>
                  <span className="font-semibold text-white block">@{selectedOrder.telegramUsername}</span>
                  <span className="text-[11px] text-slate-400">ID: {selectedOrder.telegramId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">សៀវភៅ</span>
                  <span className="font-semibold text-white block truncate">{selectedOrder.productName}</span>
                  <span className="text-[11px] text-slate-400">
                    ចំនួន {selectedOrder.quantity} {selectedOrder.bookFormat === 'printed' ? 'ក្បាល' : 'ច្បាប់'}
                  </span>
                </div>
              </div>

              {/* Pricing breakdown */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>តម្លៃទោល៖</span>
                  <span>${selectedOrder.unitPrice.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>ចំនួនទឹកប្រាក់សរុប៖</span>
                  <span className="text-white font-bold">${selectedOrder.totalAmount.toFixed(2)} USD</span>
                </div>
                {selectedOrder.commissionEarned > 0 && (
                  <div className="flex justify-between text-emerald-400 pt-1 border-t border-slate-800/80">
                    <span>កម្រៃជើងសារ Referral:</span>
                    <span>+${selectedOrder.commissionEarned.toFixed(2)} USD</span>
                  </div>
                )}
              </div>

              {/* Printed Book Shipping Information Section */}
              {selectedOrder.bookFormat === 'printed' && (
                <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <Truck className="w-4 h-4" />
                      <span>ព័ត៌មានដឹកជញ្ជូនសៀវភៅព្រីន (Shipping Details)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setWaybillOrder(selectedOrder)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>🖨️ បោះពុម្ពស្លាក A6</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-300 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">អ្នកទទួល៖</span>
                        <span className="font-semibold text-white">{selectedOrder.shippingRecipient || selectedOrder.customerName}</span>
                      </div>
                      {selectedOrder.shippingSpeed && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {selectedOrder.shippingSpeed === 'express' ? '⚡ SAME-DAY EXPRESS' : 'STANDARD'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-amber-400" />
                      <span className="font-mono text-white font-bold">{selectedOrder.shippingPhone || '012 889 900'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span className="text-slate-200">
                        {selectedOrder.shippingAddress || 'រាជធានីភ្នំពេញ'}
                      </span>
                    </div>
                    {selectedOrder.province && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>ខេត្ត/សាខា៖</span>
                        <span className="text-white font-semibold">{selectedOrder.province} {selectedOrder.branch ? `(សាខា ${selectedOrder.branch})` : ''}</span>
                      </div>
                    )}
                    {selectedOrder.shippingNotes && (
                      <div className="text-amber-200/90 italic pt-1 border-t border-slate-800/80">
                        📝 ចំណាំសម្រាប់អ្នកដឹក៖ {selectedOrder.shippingNotes}
                      </div>
                    )}
                    {selectedOrder.shippingLocation && (
                      <div className="pt-1 border-t border-slate-800/80">
                        <a
                          href={selectedOrder.shippingLocation.googleMapsUrl || `https://www.google.com/maps?q=${selectedOrder.shippingLocation.latitude},${selectedOrder.shippingLocation.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 font-medium underline"
                        >
                          <Navigation className="w-3 h-3 text-sky-400" />
                          <span>បើកមើលទីតាំង GPS លើ Google Maps ({selectedOrder.shippingLocation.latitude.toFixed(4)}, {selectedOrder.shippingLocation.longitude.toFixed(4)})</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Courier & Status Form */}
                  <div className="pt-2 border-t border-amber-900/40 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">ក្រុមហ៊ុនដឹកជញ្ជូន</span>
                        <select
                          value={editCourier}
                          onChange={(e) => setEditCourier(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:outline-hidden"
                        >
                          <option value="VET Express (វីរៈប៊ុនថាំ)">VET Express (វីរៈប៊ុនថាំ)</option>
                          <option value="J&T Express">J&T Express</option>
                          <option value="ភ្នំពេញ ធម្មតា (Standard)">ភ្នំពេញ ធម្មតា (Standard)</option>
                          <option value="ភ្នំពេញ បន្ទាន់ក្នុងថ្ងៃ (Express)">ភ្នំពេញ បន្ទាន់ក្នុងថ្ងៃ (Express)</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">ស្ថានភាពដឹកជញ្ជូន</span>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:outline-hidden"
                        >
                          <option value="pending">Pending (កំពុងរង់ចាំ)</option>
                          <option value="preparing">Preparing (កំពុងរៀបចំ)</option>
                          <option value="shipped">Shipped (បានផ្ញើ/កំពុងដឹក)</option>
                          <option value="delivered">Delivered (បានដល់ដៃ)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Tracking Code (VET / J&T)</span>
                        <input
                          type="text"
                          value={editTracking}
                          onChange={(e) => setEditTracking(e.target.value)}
                          placeholder="ឧ. VET-88912"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">ចំណាំអ្នកដឹក (Note to Rider)</span>
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="ឧ. ខលមុន 15 នាទី"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {onUpdateShipping && (
                    <button
                      onClick={handleSaveShipping}
                      disabled={isSavingShipping}
                      className="w-full mt-2 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      {isSavingShipping ? 'កំពុងរក្សាទុក...' : '💾 រក្សាទុក & ផ្ញើដំណឹង Dispatch Tracking ទៅ Telegram'}
                    </button>
                  )}
                </div>
              )}

              {/* Delivered PDF / Book serials section */}
              {selectedOrder.deliveredItems && selectedOrder.deliveredItems.length > 0 && (
                <div>
                  <span className="text-slate-300 font-medium block mb-1 flex items-center justify-between">
                    <span>
                      {selectedOrder.bookFormat === 'printed'
                        ? 'លេខកូដក្បាលសៀវភៅក្នុងស្តុក (Warehouse Stock Copies):'
                        : 'តំណភ្ជាប់ទាញយកសៀវភៅ PDF (Delivered Download Links):'}
                    </span>
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedOrder.deliveredItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px]"
                      >
                        <code className="text-emerald-300 truncate max-w-[340px]">{item}</code>
                        <div className="flex items-center gap-1">
                          {item.startsWith('http') && (
                            <a
                              href={item}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="បើកមើល PDF"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleCopy(item)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy"
                          >
                            {copiedAccount === item ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Payment Slip (ABA Pay / Wing / Bakong) */}
              {selectedOrder.paymentSlipUrl && (
                <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1.5 text-xs">
                      <span>📸 វិក្កយបត្រផ្ទេរប្រាក់ (Uploaded Payment Slip)</span>
                    </span>
                    <span className="text-[10px] text-slate-400">ផ្ញើដោយអតិថិជន</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="relative group rounded-lg overflow-hidden border border-slate-700 bg-black/40 shrink-0">
                      <img
                        src={selectedOrder.paymentSlipUrl}
                        alt="Payment Slip"
                        className="w-20 h-20 object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <a
                        href={selectedOrder.paymentSlipUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-semibold transition-opacity"
                      >
                        ពង្រីកមើល
                      </a>
                    </div>
                    <div className="space-y-1.5 text-xs flex-1">
                      <p className="text-slate-300 text-[11px]">
                        អតិថិជនបានផ្ញើវិក្កយបត្របង់ប្រាក់នេះចូល Bot (ABA / Wing / Bakong)។
                      </p>
                      {selectedOrder.status === 'pending' && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            onClick={() => handleManualFulfill(selectedOrder.id)}
                            disabled={isProcessing === selectedOrder.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Zap className="w-3 h-3" />
                            <span>យល់ព្រម & Fulfill (Approve)</span>
                          </button>
                          <button
                            onClick={() => handleCancel(selectedOrder.id)}
                            disabled={isProcessing === selectedOrder.id}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-200 text-xs transition-colors cursor-pointer"
                          >
                            បដិសេធ (Reject)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* KHQR Info if pending */}
              {selectedOrder.status === 'pending' && selectedOrder.qrImageDataUrl && (
                <div className="text-center p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <span className="text-[11px] font-medium text-slate-300 block mb-2">KHQR Payment Code</span>
                  <img
                    src={selectedOrder.qrImageDataUrl}
                    alt="KHQR"
                    className="w-36 h-36 mx-auto rounded-lg bg-white p-2"
                  />
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleManualFulfill(selectedOrder.id)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm cursor-pointer"
                    >
                      ⚡ Fulfill & ប្រគល់សៀវភៅឥឡូវនេះ
                    </button>
                  </div>
                </div>
              )}
              {/* Change History & Previous Data (មិនបាត់ទិន្នន័យចាស់ៗ) */}
              {(selectedOrder.updatedAt || (selectedOrder.editHistory && selectedOrder.editHistory.length > 0)) && (
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-indigo-400" />
                      <span>ប្រវត្តិកែប្រែ & ទិន្នន័យចាស់ៗ (Preserved History)</span>
                    </span>
                    {selectedOrder.updatedAt && (
                      <span className="text-[10px] text-slate-400">
                        កែប្រែចុងក្រោយ៖ {new Date(selectedOrder.updatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {selectedOrder.editHistory && selectedOrder.editHistory.length > 0 && (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {selectedOrder.editHistory.map((h, i) => (
                        <div key={i} className="p-2 bg-slate-900 border border-slate-800/80 rounded-lg text-[10px] space-y-1">
                          <div className="flex items-center justify-between text-slate-300">
                            <span className="font-semibold">{h.action}</span>
                            <span className="text-slate-400 font-mono">{new Date(h.timestamp).toLocaleTimeString()}</span>
                          </div>
                          {h.previousData && (
                            <div className="text-slate-400 font-mono text-[9px] bg-slate-950 p-1 rounded overflow-x-auto">
                              <span>ទិន្នន័យមុនកែប្រែ៖ </span>
                              <code>{JSON.stringify(h.previousData)}</code>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                {onUpdateOrder && (
                  <button
                    onClick={() => {
                      handleOpenEditModal(selectedOrder);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>កែប្រែ Order</span>
                  </button>
                )}
                {onDeleteOrder && (
                  <button
                    onClick={() => handleDelete(selectedOrder.id)}
                    className="p-1.5 rounded-xl bg-[#231224] hover:bg-[#321734] border border-rose-500/30 hover:border-rose-400/50 text-[#ff5c8a] hover:text-rose-300 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    title="លុប Order នេះ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>លុប</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-indigo-400" />
                  <span>កែប្រែព័ត៌មានការបញ្ជាទិញ #{editingOrder.id}</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  {editingOrder.productName} ({editingOrder.bookFormat === 'printed' ? 'សៀវភៅព្រីន' : 'សៀវភៅ PDF'})
                </span>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditOrder} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">ឈ្មោះអតិថិជន</label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    placeholder="ឈ្មោះអតិថិជន"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Telegram Username</label>
                  <input
                    type="text"
                    value={editTelegramUsername}
                    onChange={(e) => setEditTelegramUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    placeholder="sokha_reader (ដោយមិនបាច់ @)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">ស្ថានភាព Order</label>
                  <select
                    value={editOrderStatus}
                    onChange={(e) => setEditOrderStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-medium"
                  >
                    <option value="pending">⏳ Pending (រង់ចាំបង់)</option>
                    <option value="completed">✅ Completed (ជោគជ័យ)</option>
                    <option value="expired">❌ Expired (ផុតកំណត់)</option>
                    <option value="stock_depleted_refund_needed">⚠️ Depleted (អស់ស្តុក)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">ចំនួន (Qty)</label>
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">តម្លៃសរុប (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editTotalAmount}
                    onChange={(e) => setEditTotalAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">ទម្រង់សៀវភៅ (Book Format)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditBookFormat('pdf')}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      editBookFormat === 'pdf'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    📄 សៀវភៅ PDF (Digital E-Book)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditBookFormat('printed')}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      editBookFormat === 'printed'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    📖 សៀវភៅព្រីន (Printed Hardcopy)
                  </button>
                </div>
              </div>

              {/* Shipping Section */}
              <div className="pt-2 border-t border-slate-800/80 space-y-3">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  <span>ព័ត៌មានដឹកជញ្ជូន (Shipping Info)</span>
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">ឈ្មោះអ្នកទទួល</label>
                    <input
                      type="text"
                      value={editShippingRecipient}
                      onChange={(e) => setEditShippingRecipient(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                      placeholder="ឈ្មោះអ្នកទទួលកញ្ចប់សៀវភៅ"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">លេខទូរស័ព្ទដឹកជញ្ជូន</label>
                    <input
                      type="text"
                      value={editShippingPhone}
                      onChange={(e) => setEditShippingPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                      placeholder="012 345 678"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">អាសយដ្ឋានដឹកជញ្ជូន</label>
                  <textarea
                    rows={2}
                    value={editShippingAddress}
                    onChange={(e) => setEditShippingAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white resize-none"
                    placeholder="ផ្ទះលេខ, ផ្លូវ, សង្កាត់, ខណ្ឌ/ក្រុង, រាជធានី/ខេត្ត"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">ស្ថានភាពដឹក</label>
                    <select
                      value={editOrderShippingStatus}
                      onChange={(e) => setEditOrderShippingStatus(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="preparing">⏳ កំពុងរៀបចំ (Preparing)</option>
                      <option value="shipped">🚚 កំពុងដឹកជញ្ជូន (Shipped)</option>
                      <option value="delivered">✅ បានប្រគល់ជូន (Delivered)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">លេខកូដតាមដាន (Tracking Code)</label>
                    <input
                      type="text"
                      value={editOrderTracking}
                      onChange={(e) => setEditOrderTracking(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                      placeholder="VET-99201"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={isSavingOrder}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  {isSavingOrder ? 'កំពុងរក្សាទុក...' : '💾 រក្សាទុកការកែប្រែ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* A6 Thermal Waybill Printable Sticker Modal */}
      {waybillOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #a6-waybill-sticker, #a6-waybill-sticker * {
                visibility: visible !important;
              }
              #a6-waybill-sticker {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100mm !important;
                max-width: 100mm !important;
                margin: 0 !important;
                padding: 4mm !important;
                box-shadow: none !important;
                border: 2px solid #000 !important;
                background: #fff !important;
                color: #000 !important;
              }
            }
          `}</style>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">ស្លាកដឹកជញ្ជូន A6 (A6 Shipping Waybill)</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">105mm x 148mm</span>
              </div>
              <button
                onClick={() => setWaybillOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* A6 Printable Thermal Waybill Sticker */}
            <div className="flex justify-center bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto">
              <div
                id="a6-waybill-sticker"
                className="bg-white text-black p-4 rounded-sm shadow-xl font-sans border-2 border-black"
                style={{ width: '105mm', minHeight: '148mm', boxSizing: 'border-box' }}
              >
                {/* Header: Store branding & Courier Badge */}
                <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
                  <div>
                    <div className="text-xs font-black tracking-wider uppercase text-black">QCM STORE CAMBODIA</div>
                    <div className="text-[9px] text-gray-700">Hotline: 012 889 900 / 098 776 543</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block border-2 border-black bg-black text-white px-2 py-0.5 text-[10px] font-black uppercase">
                      {waybillOrder.courierService || (waybillOrder.shippingAddress?.includes('VET') ? 'VET EXPRESS' : waybillOrder.shippingAddress?.includes('J&T') ? 'J&T EXPRESS' : 'PHNOM PENH')}
                    </span>
                    <div className="text-[8px] font-bold text-gray-800 mt-0.5">
                      {waybillOrder.shippingSpeed === 'express' ? '⚡ SAME-DAY EXPRESS' : 'STANDARD DELIVERY'}
                    </div>
                  </div>
                </div>

                {/* Barcode & Tracking Row */}
                <div className="border border-black p-2 mb-2 bg-gray-50 flex items-center justify-between">
                  <div>
                    <div className="text-[8px] font-bold text-gray-600 uppercase">Order ID</div>
                    <div className="text-sm font-black font-mono tracking-wider">#{waybillOrder.id}</div>
                    <div className="text-[8px] font-mono tracking-widest text-gray-500">
                      ||| ||||| || |||| ||| ||||| || |||
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] font-bold text-gray-600 uppercase">Tracking No.</div>
                    <div className="text-xs font-black font-mono bg-black text-white px-1.5 py-0.5 rounded">
                      {waybillOrder.trackingNumber || 'PENDING'}
                    </div>
                  </div>
                </div>

                {/* Receiver Box - Highlighted with Big Phone */}
                <div className="border-2 border-black p-2.5 rounded-sm bg-yellow-50/50 mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black uppercase bg-black text-white px-1.5 py-0.5">
                      អ្នកទទួល (RECIPIENT)
                    </span>
                    {waybillOrder.province && (
                      <span className="text-[10px] font-black text-black">
                        📍 {waybillOrder.province}
                      </span>
                    )}
                  </div>

                  {/* Ultra-clear large phone number for delivery rider */}
                  <div className="text-lg font-black font-mono tracking-wider text-black my-1">
                    📞 {waybillOrder.shippingPhone || '012 889 900'}
                  </div>

                  <div className="text-xs font-bold text-black">
                    👤 {waybillOrder.shippingRecipient || waybillOrder.customerName}
                  </div>

                  <div className="text-[10px] font-medium leading-tight text-gray-900 mt-1">
                    🏠 {waybillOrder.shippingAddress || 'រាជធានីភ្នំពេញ'}
                  </div>

                  {waybillOrder.branch && (
                    <div className="text-[10px] font-bold text-blue-900 mt-0.5">
                      🏢 សាខា៖ {waybillOrder.branch}
                    </div>
                  )}

                  {waybillOrder.shippingLocation && (
                    <div className="text-[8px] font-mono text-gray-600 mt-0.5">
                      GPS: {waybillOrder.shippingLocation.latitude.toFixed(4)}, {waybillOrder.shippingLocation.longitude.toFixed(4)}
                    </div>
                  )}
                </div>

                {/* Package Items & Payment Badge */}
                <div className="border border-black p-2 mb-2 text-[9px] space-y-1">
                  <div className="flex justify-between font-bold border-b border-gray-300 pb-1">
                    <span className="truncate max-w-[200px]">📚 {waybillOrder.productName}</span>
                    <span className="shrink-0 font-mono">x{waybillOrder.quantity} ក្បាល</span>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <div>
                      <span className="inline-block bg-black text-white font-black px-1.5 py-0.5 text-[9px]">
                        ✅ PAID / មិនបាច់ទារប្រាក់ (COD: $0.00)
                      </span>
                    </div>
                    <div className="text-right font-mono font-bold text-[10px]">
                      ${waybillOrder.totalAmount.toFixed(2)} USD
                    </div>
                  </div>
                </div>

                {/* Note to Rider */}
                <div className="border border-dashed border-black p-1.5 mb-2 bg-gray-50 text-[9px]">
                  <span className="font-bold">📝 ចំណាំសម្រាប់អ្នកដឹក៖ </span>
                  <span className="font-semibold text-gray-900">
                    {waybillOrder.shippingNotes || 'សូមទូរស័ព្ទមុនពេលដឹកជញ្ជូន 15 នាទី'}
                  </span>
                </div>

                {/* Footer Warning */}
                <div className="text-center border-t border-black pt-1 text-[8px] font-bold text-gray-700">
                  ⚠️ សៀវភៅសិក្សា ហាមបត់ ឬត្រូវទឹក • ពិនិត្យកញ្ចប់មុនទទួល • Hotline: 012 889 900
                </div>
              </div>
            </div>

            {/* Print & Action Controls */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                គាំទ្រម៉ាស៊ីនព្រីនស្លាកកម្តៅ Thermal Sticker (Xprinter, Phomemo, HPRT, Zebra)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWaybillOrder(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  បិទ
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ បោះពុម្ពស្លាក (Print Label)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
