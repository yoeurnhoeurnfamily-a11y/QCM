import React from 'react';
import {
  DollarSign,
  ShoppingBag,
  Boxes,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Smartphone
} from 'lucide-react';
import type { DashboardStats, Order } from '../types/store';

interface DashboardViewProps {
  stats: DashboardStats | null;
  onNavigateTab: (tab: string) => void;
  openSimulator: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  onNavigateTab,
  openSimulator
}) => {
  if (!stats) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">កំពុងទាញយកទិន្នន័យ Dashboard...</p>
        </div>
      </div>
    );
  }

  const maxDayAmount = Math.max(...stats.revenueByDay.map(d => d.amount), 10);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">ចំណូលសរុប (Revenue)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              ${stats.totalRevenue.toFixed(2)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>ការទូទាត់តាម CutLuy KHQR</span>
            </div>
          </div>
        </div>

        {/* Completed Orders */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Orders ជោគជ័យ</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {stats.completedOrdersCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              ពីអតិថិជនសរុប {stats.totalCustomers} នាក់
            </div>
          </div>
        </div>

        {/* Sold Books */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">សៀវភៅបានលក់ (Books Sold)</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {stats.soldAccountsCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              PDF & សៀវភៅព្រីន
            </div>
          </div>
        </div>

        {/* Available Stock */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">ស្តុកនៅសល់ (Available)</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {stats.totalStockAvailable}
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px]">
              <span className="text-amber-400">
                កំពុងកក់: {stats.totalStockReserved}
              </span>
              <button
                onClick={() => onNavigateTab('stock')}
                className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                + បន្ថែមស្តុក
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid: Revenue Chart + Sales Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue 7-Day Chart */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">ក្រាហ្វិកចំណូល 7 ថ្ងៃចុងក្រោយ</h3>
              <p className="text-[11px] text-slate-400">គិតជាប្រាក់ដុល្លារ (USD) និងចំនួនការទិញ</p>
            </div>
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <span>មើលវិក្កយបត្រទាំងអស់</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-56 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
            {stats.revenueByDay.map((day, idx) => {
              const heightPct = Math.max(8, Math.round((day.amount / maxDayAmount) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] rounded px-1.5 py-0.5 pointer-events-none whitespace-nowrap border border-slate-700 font-mono">
                    ${day.amount.toFixed(2)} ({day.count})
                  </div>
                  {/* Bar */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full rounded-t-md bg-gradient-to-t from-indigo-600 to-sky-500 group-hover:from-indigo-500 group-hover:to-sky-400 transition-all min-h-[6px]"
                  />
                  {/* Label */}
                  <span className="text-[10px] text-slate-400 font-mono">
                    {day.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sales by Product */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">ទំនិញលក់ដាច់ជាងគេ</h3>
            <p className="text-[11px] text-slate-400 mb-4">ចំណាត់ថ្នាក់តាមចំនួនលក់ដាច់</p>

            <div className="space-y-3">
              {stats.salesByProduct.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">មិនទាន់មានទិន្នន័យការលក់នៅឡើយ</p>
              ) : (
                stats.salesByProduct.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate max-w-[180px]">
                      <span className="w-5 h-5 rounded bg-slate-800 text-slate-400 flex items-center justify-center font-mono text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="text-slate-200 truncate">{item.productName}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-white font-mono font-medium">${item.revenue.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400">{item.count} items</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <button
              onClick={openSimulator}
              className="btn-secondary w-full py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-2 border-indigo-500/30 text-indigo-200 hover:text-white"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
              <span>សាកល្បងទិញក្នុង Bot Simulator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">ការបញ្ជាទិញថ្មីៗ (Recent Orders)</h3>
            <p className="text-[11px] text-slate-400">វិក្កយបត្រ 10 ចុងក្រោយបង្អស់</p>
          </div>
          <button
            onClick={() => onNavigateTab('orders')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
          >
            មើលទាំងអស់ →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">លេខវិក្កយបត្រ</th>
                <th className="py-2.5 px-3">អតិថិជន</th>
                <th className="py-2.5 px-3">សៀវភៅ</th>
                <th className="py-2.5 px-3 text-right">ចំនួន</th>
                <th className="py-2.5 px-3 text-right">ទឹកប្រាក់ (USD)</th>
                <th className="py-2.5 px-3 text-center">ស្ថានភាព</th>
                <th className="py-2.5 px-3 text-right">កាលបរិច្ឆេទ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stats.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    មិនទាន់មានការបញ្ជាទិញនៅឡើយ
                  </td>
                </tr>
              ) : (
                stats.recentOrders.map((ord, idx) => {
                  let statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      កំពុងរង់ចាំ
                    </span>
                  );
                  if (ord.status === 'completed') {
                    statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ជោគជ័យ
                      </span>
                    );
                  } else if (ord.status === 'expired') {
                    statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        ផុតកំណត់
                      </span>
                    );
                  } else if (ord.status === 'stock_depleted_refund_needed') {
                    statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                        អស់ស្តុក (ត្រូវការសង)
                      </span>
                    );
                  }

                  return (
                    <tr key={`${ord.id}-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-white">
                        #{ord.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-200">@{ord.telegramUsername}</div>
                        <div className="text-[10px] text-slate-400">{ord.customerName}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 max-w-[200px] truncate">
                        {ord.productName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {ord.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white tabular-nums">
                        ${ord.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {statusBadge}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[11px] text-slate-400 font-mono">
                        {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
