import React, { useState } from 'react';
import {
  Plus,
  Upload,
  Download,
  Trash2,
  Copy,
  Check,
  Filter,
  Boxes,
  Lock,
  CheckCircle2,
  Clock,
  X,
  Pencil
} from 'lucide-react';
import type { Product, StockItem } from '../types/store';

interface StockViewProps {
  products: Product[];
  stock: StockItem[];
  onBulkAddStock: (productId: string, lines: string) => Promise<void>;
  onAddStockItem: (productId: string, content: string) => Promise<void>;
  onUpdateStockItem?: (id: string, updates: Partial<StockItem>) => Promise<void>;
  onDeleteStockItem: (id: string) => Promise<void>;
}

export const StockView: React.FC<StockViewProps> = ({
  products,
  stock,
  onBulkAddStock,
  onAddStockItem,
  onUpdateStockItem,
  onDeleteStockItem
}) => {
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit stock item modal
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editItemStatus, setEditItemStatus] = useState<StockItem['status']>('available');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);

  // Bulk import modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkProductId, setBulkProductId] = useState(products[0]?.id || '');
  const [bulkLines, setBulkLines] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered items
  const filteredStock = stock.filter((item) => {
    if (selectedProductFilter !== 'all' && item.productId !== selectedProductFilter) {
      return false;
    }
    if (selectedStatusFilter !== 'all' && item.status !== selectedStatusFilter) {
      return false;
    }
    return true;
  });

  const availableCount = stock.filter(s => s.status === 'available').length;
  const reservedCount = stock.filter(s => s.status === 'reserved').length;
  const soldCount = stock.filter(s => s.status === 'sold').length;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkProductId || !bulkLines.trim()) return;
    setIsSubmitting(true);
    try {
      await onBulkAddStock(bulkProductId, bulkLines);
      setBulkLines('');
      setIsBulkModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const lines = filteredStock.map(s => `${s.productId},${s.status},"${s.content.replace(/"/g, '""')}"`).join('\n');
    const header = 'product_id,status,content\n';
    const blob = new Blob([header + lines], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Summary Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-indigo-400" />
            <span>គ្រប់គ្រងស្តុកសៀវភៅ & ច្បាប់ចម្លង ({stock.length})</span>
          </h3>
          <p className="text-xs text-slate-400">បញ្ចូលតំណភ្ជាប់ Download សៀវភៅ PDF ឬលេខកូដក្បាលសៀវភៅព្រីនក្នុងឃ្លាំង</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="btn-secondary flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-300 text-xs font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => {
              if (products.length > 0 && !bulkProductId) {
                setBulkProductId(products[0].id);
              }
              setIsBulkModalOpen(true);
            }}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>+ បញ្ចូលស្តុកច្រើន (Bulk Import)</span>
          </button>
        </div>
      </div>

      {/* Stock Summary Mini Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">Available (នៅសល់)</span>
            <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">{availableCount}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Boxes className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">Reserved (កំពុងកក់)</span>
            <span className="text-xl font-bold text-amber-400 font-mono tabular-nums">{reservedCount}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">Sold (បានលក់ចេញ)</span>
            <span className="text-xl font-bold text-slate-300 font-mono tabular-nums">{soldCount}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/80 border border-slate-800/80 p-3 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-medium">តម្រងតាមទំនិញ៖</span>
          <select
            value={selectedProductFilter}
            onChange={(e) => setSelectedProductFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-white focus:outline-hidden"
          >
            <option value="all">ទាំងអស់ (All Products)</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">ស្ថានភាព៖</span>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-white focus:outline-hidden"
          >
            <option value="all">ស្ថានភាពទាំងអស់</option>
            <option value="available">Available (នៅសល់)</option>
            <option value="reserved">Reserved (កំពុងកក់)</option>
            <option value="sold">Sold (បានលក់)</option>
          </select>
        </div>

        <div className="ml-auto text-slate-400 font-mono text-[11px]">
          បង្ហាញ {filteredStock.length} / {stock.length} accounts
        </div>
      </div>

      {/* Stock Items Table */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/40">
                <th className="py-3 px-4">ផលិតផល (Product)</th>
                <th className="py-3 px-4">ទិន្នន័យ Account (Credentials / Invite Link)</th>
                <th className="py-3 px-4 text-center">ស្ថានភាព</th>
                <th className="py-3 px-4">កាលបរិច្ឆេទ</th>
                <th className="py-3 px-4 text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                    មិនមានស្តុកតាមលក្ខខណ្ឌតម្រងនេះទេ។ សូមចុច "+ បញ្ចូលស្តុកច្រើន" ដើម្បីបន្ថែម។
                  </td>
                </tr>
              ) : (
                filteredStock.map((item) => {
                  const product = products.find(p => p.id === item.productId);

                  let statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Available
                    </span>
                  );
                  if (item.status === 'reserved') {
                    const timeLeftSec = item.reservedUntil ? Math.max(0, Math.round((item.reservedUntil - Date.now()) / 1000)) : 0;
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <span>Reserved</span>
                        <span className="text-[9px]">({timeLeftSec}s)</span>
                      </span>
                    );
                  } else if (item.status === 'sold') {
                    statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        Sold (#{item.orderId?.slice(-6) || ''})
                      </span>
                    );
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-sans font-medium text-white max-w-[180px] truncate">
                        {product?.name || item.productId}
                      </td>
                      <td className="py-3 px-4 max-w-[320px]">
                        <div className="flex items-center gap-2">
                          <code className="text-indigo-300 truncate bg-slate-950 px-2 py-1 rounded border border-slate-800 block max-w-full">
                            {item.content}
                          </code>
                          <button
                            onClick={() => handleCopy(item.id, item.content)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                            title="Copy Account Data"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        {statusBadge}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(item.addedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 font-sans">
                          {onUpdateStockItem && (
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setEditContent(item.content);
                                setEditItemStatus(item.status);
                              }}
                              className="p-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all cursor-pointer"
                              title="កែប្រែទិន្នន័យស្តុក"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setItemToDelete(item)}
                            className="p-1.5 rounded-xl bg-[#231224] hover:bg-[#321734] border border-rose-500/30 hover:border-rose-400/50 text-[#ff5c8a] hover:text-rose-300 transition-all active:scale-95 cursor-pointer shadow-xs"
                            title="លុបចេញពីស្តុក"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Bulk Stock Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>បញ្ចូលស្តុកច្រើន (Bulk Import)</span>
              </h3>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  ជ្រើសរើសមុខទំនិញ (Product) *
                </label>
                <select
                  required
                  value={bulkProductId}
                  onChange={(e) => setBulkProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500 font-medium"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (${p.price.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-medium">
                    បញ្ជីគណនី (1 បន្ទាត់ = 1 Account) *
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {bulkLines.split('\n').filter(l => l.trim()).length} accounts
                  </span>
                </div>
                <textarea
                  rows={8}
                  required
                  value={bulkLines}
                  onChange={(e) => setBulkLines(e.target.value)}
                  placeholder={`mail1@gmail.com:pass123\nmail2@gmail.com:pass456 | PIN: 9981\nhttps://canva.com/invite_link_token...`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white font-mono text-xs focus:outline-hidden focus:border-indigo-500 placeholder:text-slate-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 អាចដាក់ជា format <code>mail:pass</code>, <code>mail|pass|2fa</code>, ឬ Link Invite ក៏បាន។
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'កំពុងបញ្ចូល...' : 'បញ្ចូលស្តុកភ្លាមៗ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stock Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-400" />
                <span>កែប្រែព័ត៌មានស្តុក (#{editingItem.id})</span>
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingItem || !onUpdateStockItem) return;
                setIsSavingEdit(true);
                try {
                  await onUpdateStockItem(editingItem.id, {
                    content: editContent,
                    status: editItemStatus
                  });
                  setEditingItem(null);
                } finally {
                  setIsSavingEdit(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  ទិន្នន័យគណនី / Link សៀវភៅ PDF / លេខកូដក្បាលសៀវភៅ *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  ស្ថានភាពស្តុក (Status)
                </label>
                <select
                  value={editItemStatus}
                  onChange={(e) => setEditItemStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium"
                >
                  <option value="available">🟢 Available (ទំនេរអាចលក់បាន)</option>
                  <option value="reserved">🟡 Reserved (កំពុងកក់)</option>
                  <option value="sold">🔴 Sold (បានលក់រួច)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const toDel = editingItem;
                    setEditingItem(null);
                    setItemToDelete(toDel);
                  }}
                  className="p-2 rounded-xl bg-[#231224] hover:bg-[#321734] border border-rose-500/30 hover:border-rose-400/50 text-[#ff5c8a] hover:text-rose-300 transition-all active:scale-95 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>លុបចោល</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    {isSavingEdit ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Stock Item Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">
                  តើអ្នកពិតជាចង់លុប Stock Item នេះ?
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ទិន្នន័យស្តុកនេះនឹងត្រូវដកចេញពីប្រព័ន្ធភ្លាមៗ។
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
              <div className="text-slate-400">ខ្លឹមសារស្តុក (License / កូដ)៖</div>
              <div className="font-mono text-slate-200 text-xs bg-slate-900 p-2 rounded-lg break-all">
                {itemToDelete.content}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">ស្ថានភាព៖</span>
                <span className="font-medium text-amber-400">{itemToDelete.status}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteStockItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-900/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>បាទ/ចាស លុបចេញ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
