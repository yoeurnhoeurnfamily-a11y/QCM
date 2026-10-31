import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Boxes,
  Receipt,
  Users,
  TicketPercent,
  Megaphone,
  Settings,
  Smartphone,
  ExternalLink,
  Bot
} from 'lucide-react';
import type { BotSettings } from '../types/store';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openSimulator: () => void;
  openActivateModal: () => void;
  settings?: BotSettings | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  openSimulator,
  openActivateModal,
  settings
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'ផ្ទាំងគ្រប់គ្រង (Dashboard)', icon: LayoutDashboard },
    { id: 'products', label: 'សៀវភៅ (Book Catalog)', icon: BookOpen },
    { id: 'stock', label: 'ស្តុកសៀវភៅ (Inventory)', icon: Boxes },
    { id: 'orders', label: 'ការបញ្ជាទិញ (Orders)', icon: Receipt },
    { id: 'customers', label: 'អតិថិជន (Customers)', icon: Users },
    { id: 'coupons', label: 'កូដបញ្ចុះតម្លៃ (Coupons)', icon: TicketPercent },
    { id: 'broadcast', label: 'ផ្សាយដំណឹង (Broadcast)', icon: Megaphone },
    { id: 'settings', label: 'កំណត់ប្រព័ន្ធ (Settings)', icon: Settings },
  ];

  const botUsername = settings?.botUsername || 'kh_bookstore_bot';
  const isPolling = Boolean(settings?.isPollingActive && settings?.botToken);

  return (
    <aside className="w-64 bg-slate-900/95 border-r border-slate-800/80 flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-tight">
              KH BookStore
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">សៀវភៅត្រៀមប្រឡង & QCM</p>
          </div>
        </div>
      </div>

      {/* Simulator Quick Action Banner */}
      <div className="p-3">
        <button
          onClick={openSimulator}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600/20 to-sky-600/20 hover:from-indigo-600/30 hover:to-sky-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all text-xs font-semibold group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>តេស្ត Bot Simulator</span>
          </div>
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">LIVE</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Menu គ្រប់គ្រង
        </p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bot Status & Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        <button
          onClick={openActivateModal}
          className="w-full flex items-center justify-between text-left cursor-pointer group"
          title="ចុចដើម្បីកំណត់ Bot Token និងបើកដំណើរការ Live Bot"
        >
          <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors">
            ស្ថានភាព Bot:
          </span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 group-hover:border-slate-700 transition-colors">
            <span
              className={`w-2 h-2 rounded-full ${
                isPolling ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className={`text-[10px] font-medium ${isPolling ? 'text-emerald-300' : 'text-amber-300'}`}>
              {isPolling ? 'Polling Online' : 'Simulator Mode'}
            </span>
          </div>
        </button>

        {isPolling ? (
          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 hover:bg-emerald-900/40 text-[11px] text-emerald-300 hover:text-white transition-colors"
          >
            <span className="truncate font-mono">@{botUsername}</span>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          </a>
        ) : (
          <button
            onClick={openActivateModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-[11px] text-indigo-300 hover:text-white transition-colors cursor-pointer"
          >
            <span className="font-semibold">⚡ ចុចដើម្បីដំណើរការ Bot</span>
            <span className="text-[10px] font-mono text-indigo-400">Live ↗</span>
          </button>
        )}
      </div>
    </aside>
  );
};
