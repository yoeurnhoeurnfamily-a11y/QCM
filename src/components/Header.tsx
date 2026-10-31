import React from 'react';
import { Smartphone, RefreshCw, DollarSign, Bot, ExternalLink, LogOut } from 'lucide-react';
import type { DashboardStats, BotSettings } from '../types/store';

interface HeaderProps {
  activeTab: string;
  stats?: DashboardStats | null;
  settings?: BotSettings | null;
  onRefresh: () => void;
  openSimulator: () => void;
  onNavigateTab: (tab: string) => void;
  onLogout?: () => void;
  isRefreshing: boolean;
}

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'ផ្ទាំងគ្រប់គ្រងទូទៅ', subtitle: 'ស្ថិតិចំណូល ការលក់ និងស្តុកសៀវភៅបច្ចុប្បន្ន' },
  products: { title: 'កាតាឡុកសៀវភៅ (Book Catalog)', subtitle: 'គ្រប់គ្រងសៀវភៅ PDF, សៀវភៅព្រីន និងតម្លៃ' },
  stock: { title: 'ស្តុក & ច្បាប់ចម្លង (Book Stock)', subtitle: 'តំណភ្ជាប់ PDF និងលេខកូដសៀវភៅព្រីនក្នុងឃ្លាំង' },
  orders: { title: 'ការបញ្ជាទិញ (Orders & Shipping)', subtitle: 'តាមដានការទូទាត់ KHQR និងការដឹកជញ្ជូនសៀវភៅ' },
  customers: { title: 'អតិថិជន & អ្នកអាន (Customers)', subtitle: 'បញ្ជី Telegram Users និងកម្រៃជើងសារ' },
  coupons: { title: 'កូដបញ្ចុះតម្លៃ (Coupons)', subtitle: 'បង្កើត Promo Code បញ្ចុះតម្លៃសៀវភៅ' },
  broadcast: { title: 'ផ្សាយដំណឹង (Broadcast)', subtitle: 'ផ្ញើសារដំណឹងសៀវភៅថ្មីៗទៅកាន់ Telegram Users' },
  settings: { title: 'កំណត់ប្រព័ន្ធ (Bot & CutLuy Settings)', subtitle: 'Bot Token, CutLuy Live Key និងការកំណត់' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  stats,
  settings,
  onRefresh,
  openSimulator,
  onNavigateTab,
  onLogout,
  isRefreshing
}) => {
  const current = TAB_TITLES[activeTab] || { title: 'ផ្ទាំងគ្រប់គ្រង', subtitle: '' };
  const hasCutLuyKey = Boolean(settings?.cutluyApiKey?.trim());
  const hasBotToken = Boolean(settings?.botToken?.trim());
  const botUsername = settings?.botUsername || 'kh_bookstore_bot';

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            {current.title}
          </h2>
          <p className="text-[11px] text-slate-400">{current.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Telegram Live Bot Status Pill */}
        {hasBotToken ? (
          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-600/40 text-[11px] text-emerald-300 hover:text-white hover:bg-emerald-900/50 transition-colors"
            title="Bot កំពុងដំណើរការលើ Telegram - ចុចដើម្បីបើកឆាត"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold hidden sm:inline">Bot Live:</span>
            <span className="font-mono">@{botUsername}</span>
            <ExternalLink className="w-3 h-3 text-emerald-400 ml-0.5" />
          </a>
        ) : (
          <button
            onClick={() => onNavigateTab('settings')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-950/30 border border-amber-600/30 text-[11px] text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
            title="ចុចដើម្បីដាក់ Bot Token ឲ្យ Bot ដំណើរការពិតៗ"
          >
            <Bot className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Bot:</span>
            <span>ដាក់ Token ដើម្បី Live</span>
          </button>
        )}

        {/* CutLuy Status Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-[11px]">
          <DollarSign className={`w-3.5 h-3.5 ${hasCutLuyKey ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-slate-300">CutLuy:</span>
          <span className={`font-medium ${hasCutLuyKey ? 'text-emerald-400' : 'text-amber-400'}`}>
            {hasCutLuyKey ? 'Live Mode' : 'Test KHQR'}
          </span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="btn-secondary p-2 rounded-xl text-slate-300 hover:text-white cursor-pointer disabled:opacity-50"
          title="ធ្វើបច្ចុប្បន្នភាពទិន្នន័យ (Refresh)"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
        </button>

        {/* Simulator Launch Button */}
        <button
          onClick={openSimulator}
          className="btn-primary flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
        >
          <Smartphone className="w-4 h-4" />
          <span className="hidden sm:inline">តេស្ត Simulator</span>
        </button>

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-600/40 border border-slate-700/60 text-[11px] text-slate-300 transition-colors cursor-pointer"
            title="ចាកចេញពី Admin (Logout)"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">ចាកចេញ</span>
          </button>
        )}
      </div>
    </header>
  );
};
