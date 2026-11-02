import React, { useState } from 'react';
import { Plus, Trash2, TicketPercent, Check, X, Pencil } from 'lucide-react';
import type { Coupon } from '../types/store';

interface CouponsViewProps {
  coupons: Coupon[];
  onCreateCoupon: (coupon: Partial<Coupon>) => Promise<void>;
  onUpdateCoupon?: (id: string, updates: Partial<Coupon>) => Promise<void>;
  onDeleteCoupon: (id: string) => Promise<void>;
}

export const CouponsView: React.FC<CouponsViewProps> = ({
  coupons,
  onCreateCoupon,
  onUpdateCoupon,
  onDeleteCoupon
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('10');
  const [minOrderAmount, setMinOrderAmount] = useState('2.00');
  const [maxUses, setMaxUses] = useState('100');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode('');
    setType('percentage');
    setValue('10');
    setMinOrderAmount('2.00');
    setMaxUses('100');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (cpn: Coupon) => {
    setEditingCoupon(cpn);
    setCode(cpn.code);
    setType(cpn.type);
    setValue(String(cpn.value));
    setMinOrderAmount(String(cpn.minOrderAmount));
    setMaxUses(String(cpn.maxUses));
    setIsActive(cpn.isActive);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setIsSubmitting(true);
    try {
      const payload: Partial<Coupon> = {
        code: code.toUpperCase().trim(),
        type,
        value: parseFloat(value) || 0,
        minOrderAmount: parseFloat(minOrderAmount) || 0,
        maxUses: parseInt(maxUses, 10) || 100,
        isActive
      };

      if (editingCoupon && onUpdateCoupon) {
        await onUpdateCoupon(editingCoupon.id, payload);
      } else {
        await onCreateCoupon(payload);
      }
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white">កូដបញ្ចុះតម្លៃ (Coupons & Discounts - {coupons.length})</h3>
          <p className="text-xs text-slate-400">បង្កើត Promo Codes កាត់ជាភាគរយ ឬជាទឹកប្រាក់ USD សម្រាប់អតិថិជន</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>បង្កើត Coupon ថ្មី</span>
        </button>
      </div>

      {/* Coupons Table */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/40">
                <th className="py-3 px-4">កូដ Coupon</th>
                <th className="py-3 px-4">ប្រភេទបញ្ចុះតម្លៃ</th>
                <th className="py-3 px-4">ទំហំបញ្ចុះតម្លៃ</th>
                <th className="py-3 px-4">លក្ខខណ្ឌទិញអប្បបរមា</th>
                <th className="py-3 px-4 text-center">ចំនួនដងប្រើប្រាស់</th>
                <th className="py-3 px-4 text-center">ស្ថានភាព</th>
                <th className="py-3 px-4 text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    មិនទាន់មាន Coupon នៅឡើយទេ។ ចុច "+ បង្កើត Coupon ថ្មី" ដើម្បីបន្ថែម។
                  </td>
                </tr>
              ) : (
                coupons.map((cpn) => (
                  <tr key={cpn.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">
                      <span className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 text-indigo-400">
                        {cpn.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-300">
                      {cpn.type === 'percentage' ? 'ភាគរយ (%)' : 'ទឹកប្រាក់សុទ្ធ ($ USD)'}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">
                      {cpn.type === 'percentage' ? `${cpn.value}%` : `$${cpn.value.toFixed(2)}`}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      ${cpn.minOrderAmount.toFixed(2)} USD
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-white font-semibold">{cpn.usedCount}</span>
                      <span className="text-slate-500"> / {cpn.maxUses}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                          cpn.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {cpn.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        {onUpdateCoupon && (
                          <button
                            onClick={() => openEditModal(cpn)}
                            className="p-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all cursor-pointer"
                            title="កែប្រែ Coupon"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setCouponToDelete(cpn)}
                          className="p-1.5 rounded-xl bg-[#231224] hover:bg-[#321734] border border-rose-500/30 hover:border-rose-400/50 text-[#ff5c8a] hover:text-rose-300 transition-all active:scale-95 cursor-pointer shadow-xs"
                          title="លុប Coupon"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TicketPercent className="w-4 h-4 text-indigo-400" />
                <span>{editingCoupon ? `កែប្រែ Coupon (${editingCoupon.code})` : 'បង្កើត Coupon បញ្ចុះតម្លៃថ្មី'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  លេខកូដ Promo Code (Coupon Code) *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ឧ. SALE20, PROMO1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    ប្រភេទបញ្ចុះតម្លៃ
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden"
                  >
                    <option value="percentage">ភាគរយ (%)</option>
                    <option value="fixed">ទឹកប្រាក់ USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    ទំហំបញ្ចុះ {type === 'percentage' ? '(%)' : '($ USD)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    លក្ខខណ្ឌទិញអប្បបរមា ($)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    ចំនួនដងប្រើប្រាស់អតិបរមា
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="couponActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0"
                />
                <label htmlFor="couponActive" className="text-slate-300 text-xs cursor-pointer select-none">
                  ដាក់ឲ្យប្រើប្រាស់ភ្លាមៗ (Active)
                </label>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                {editingCoupon ? (
                  <button
                    type="button"
                    onClick={() => {
                      const toDel = editingCoupon;
                      setIsModalOpen(false);
                      setCouponToDelete(toDel);
                    }}
                    className="p-2 rounded-xl bg-[#231224] hover:bg-[#321734] border border-rose-500/30 hover:border-rose-400/50 text-[#ff5c8a] hover:text-rose-300 transition-all active:scale-95 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>លុប Coupon</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-secondary px-4 py-2 text-xs font-medium cursor-pointer"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'កំពុងរក្សាទុក...' : editingCoupon ? 'រក្សាទុកការកែប្រែ' : 'បង្កើត Coupon'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Coupon Modal */}
      {couponToDelete && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">
                  តើអ្នកពិតជាចង់លុប Coupon នេះ?
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  កូដបញ្ចុះតម្លៃនេះនឹងត្រូវដកចេញពីប្រព័ន្ធ មិនអាចប្រើបានទៀតឡើយ។
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">កូដ Coupon៖</span>
                <span className="font-mono font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/40">
                  {couponToDelete.code}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ការបញ្ចុះតម្លៃ៖</span>
                <span className="font-semibold text-emerald-400">
                  {couponToDelete.type === 'percentage' ? `${couponToDelete.value}%` : `$${couponToDelete.value.toFixed(2)} USD`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCouponToDelete(null)}
                className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteCoupon(couponToDelete.id);
                  setCouponToDelete(null);
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
