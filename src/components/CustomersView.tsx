import React, { useState } from 'react';
import { Users, DollarSign, ExternalLink, PlusCircle, MinusCircle, X, Pencil, Trash2, MapPin, Phone } from 'lucide-react';
import type { Customer } from '../types/store';

interface CustomersViewProps {
  customers: Customer[];
  onUpdateBalance: (telegramId: number, delta: number) => Promise<void>;
  onUpdateCustomer?: (id: string, updates: Partial<Customer>) => Promise<void>;
  onDeleteCustomer?: (id: string) => Promise<void>;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  onUpdateBalance,
  onUpdateCustomer,
  onDeleteCustomer
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [balanceDelta, setBalanceDelta] = useState('1.00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editBalance, setEditBalance] = useState('0');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const openEditCustomerModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setEditFirstName(cust.firstName || '');
    setEditLastName(cust.lastName || '');
    setEditUsername(cust.username || '');
    setEditPhone(cust.phone || '');
    setEditAddress(cust.defaultShippingAddress || '');
    setEditBalance(String(cust.walletBalance || 0));
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !onUpdateCustomer) return;
    setIsSavingCustomer(true);
    try {
      await onUpdateCustomer(editingCustomer.id, {
        firstName: editFirstName,
        lastName: editLastName,
        username: editUsername.replace(/^@/, ''),
        phone: editPhone,
        defaultShippingAddress: editAddress,
        walletBalance: parseFloat(editBalance) || 0
      });
      setEditingCustomer(null);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = (cust: Customer) => {
    setCustomerToDelete(cust);
  };

  const handleAdjustBalance = async (isAdd: boolean) => {
    if (!selectedCustomer) return;
    const amount = parseFloat(balanceDelta);
    if (isNaN(amount) || amount <= 0) return;
    setIsSubmitting(true);
    try {
      await onUpdateBalance(selectedCustomer.telegramId, isAdd ? amount : -amount);
      setSelectedCustomer(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSpentAll = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalCommissionAll = customers.reduce((s, c) => s + c.walletBalance, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white">អតិថិជន និងសមាជិក (Customers - {customers.length})</h3>
          <p className="text-xs text-slate-400">តាមដាន Telegram Users, ការចំណាយ និងកម្រៃជើងសារ Referral</p>
        </div>
      </div>

      {/* Stats Mini Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">អតិថិជនសរុប (Users)</span>
            <span className="text-xl font-bold text-white font-mono tabular-nums">{customers.length}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">ការចំណាយសរុប (Total Spent)</span>
            <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">${totalSpentAll.toFixed(2)}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">កម្រៃជើងសារសរុប (Commissions)</span>
            <span className="text-xl font-bold text-violet-400 font-mono tabular-nums">${totalCommissionAll.toFixed(2)}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/40">
                <th className="py-3 px-4">Telegram User</th>
                <th className="py-3 px-4">Telegram ID</th>
                <th className="py-3 px-4 text-right">Orders</th>
                <th className="py-3 px-4 text-right">ចំណាយសរុប (USD)</th>
                <th className="py-3 px-4">Referral Code</th>
                <th className="py-3 px-4">អ្នកណែនាំ</th>
                <th className="py-3 px-4 text-right">កម្រៃជើងសារ (USD)</th>
                <th className="py-3 px-4 text-right">កែប្រែសមតុល្យ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {customers.map((cust) => (
                <tr key={cust.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-sans">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <span>{cust.firstName} {cust.lastName || ''}</span>
                      {cust.username && (
                        <a
                          href={`https://t.me/${cust.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 font-normal text-xs"
                        >
                          @{cust.username}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {cust.telegramId}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {cust.totalOrders}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400 tabular-nums">
                    ${cust.totalSpent.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-slate-300 text-[11px]">
                    <code>{cust.referralCode}</code>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {cust.referredBy ? `ID: ${cust.referredBy}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-violet-400 tabular-nums">
                    ${cust.walletBalance.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-sans">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedCustomer(cust)}
                        className="btn-secondary px-2.5 py-1 text-[11px] font-medium cursor-pointer"
                        title="កែប្រែសមតុល្យកម្រៃជើងសារ"
                      >
                        កែសមតុល្យ
                      </button>

                      {onUpdateCustomer && (
                        <button
                          onClick={() => openEditCustomerModal(cust)}
                          className="p-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all cursor-pointer"
                          title="កែប្រែព័ត៌មានអតិថិជន"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {onDeleteCustomer && (
                        <button
                          onClick={() => handleDeleteCustomer(cust)}
                          className="p-1.5 rounded-xl bg-[#231224] hover:bg-[#321734] border border-rose-500/30 hover:border-rose-400/50 text-[#ff5c8a] hover:text-rose-300 transition-all active:scale-95 cursor-pointer shadow-xs"
                          title="លុបអតិថិជន"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Balance Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">កែប្រែសមតុល្យកម្រៃជើងសារ</h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">អតិថិជន</span>
                <span className="font-semibold text-white block">{selectedCustomer.firstName} (@{selectedCustomer.username})</span>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800/80 font-mono">
                  <span className="text-slate-400">សមតុល្យបច្ចុប្បន្ន៖</span>
                  <span className="text-violet-400 font-bold">${selectedCustomer.walletBalance.toFixed(2)} USD</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  ចំនួនទឹកប្រាក់កែប្រែ (USD)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={balanceDelta}
                  onChange={(e) => setBalanceDelta(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleAdjustBalance(true)}
                  className="btn-success flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold disabled:opacity-50"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>បូកលុយ (+)</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleAdjustBalance(false)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-rose-900/30"
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>ដកលុយ (-)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Profile Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-400" />
                <span>កែប្រែព័ត៌មានអតិថិជន (ID: {editingCustomer.telegramId})</span>
              </h3>
              <button
                onClick={() => setEditingCustomer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">នាមត្រកូល (First Name)</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">នាមខ្លួន (Last Name)</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Telegram Username</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                    placeholder="username (គ្មាន @)"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">សមតុល្យកម្រៃ ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">លេខទូរស័ព្ទ (Phone Number)</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  placeholder="012 889 900"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">អាសយដ្ឋានដឹកជញ្ជូនលំនាំដើម</label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white resize-none"
                  placeholder="ផ្ទះលេខ, ផ្លូវ, សង្កាត់, ខណ្ឌ/ក្រុង"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteCustomer(editingCustomer);
                    setEditingCustomer(null);
                  }}
                  className="p-2 rounded-xl bg-[#231224] hover:bg-[#321734] border border-rose-500/30 hover:border-rose-400/50 text-[#ff5c8a] hover:text-rose-300 transition-all active:scale-95 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>លុបអតិថិជន</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="btn-secondary px-4 py-2 text-xs font-medium cursor-pointer"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCustomer}
                    className="btn-primary px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    {isSavingCustomer ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">
                  តើអ្នកពិតជាចង់លុបអតិថិជននេះ?
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ទិន្នន័យអតិថិជននេះនឹងត្រូវលុបចេញពីប្រព័ន្ធ។
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ឈ្មោះអតិថិជន៖</span>
                <span className="font-semibold text-white">
                  {customerToDelete.firstName} {customerToDelete.lastName || ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Telegram៖</span>
                <span className="font-mono text-indigo-400">
                  {customerToDelete.username ? `@${customerToDelete.username}` : customerToDelete.telegramId}
                </span>
              </div>
              {customerToDelete.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">លេខទូរស័ព្ទ៖</span>
                  <span className="font-mono text-slate-300">{customerToDelete.phone}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onDeleteCustomer) {
                    await onDeleteCustomer(customerToDelete.id);
                  }
                  setCustomerToDelete(null);
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
