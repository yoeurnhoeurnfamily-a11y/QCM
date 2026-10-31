import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  Bot,
  DollarSign,
  Users,
  Bell,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Link,
  ShieldCheck,
  Check,
  Database,
  Download,
  History,
  RotateCcw,
  Clock,
  Zap,
  Globe,
  Radio,
  Server,
  Truck
} from 'lucide-react';
import { api } from '../services/api';
import type { BotSettings, BackupRecord } from '../types/store';

interface SettingsViewProps {
  settings: BotSettings;
  onUpdateSettings: (settings: Partial<BotSettings>) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings
}) => {
  const [formData, setFormData] = useState<BotSettings>({ ...settings });
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    ok: boolean;
    bot?: { id: number; first_name: string; username: string };
    error?: string;
  } | null>(null);

  // Webhook action state
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [isCheckingWebhook, setIsCheckingWebhook] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<{
    ok: boolean;
    info?: {
      url: string;
      has_custom_certificate: boolean;
      pending_update_count: number;
      last_error_date?: number;
      last_error_message?: string;
      max_connections?: number;
      ip_address?: string;
    };
    error?: string;
  } | null>(null);

  // Backup & Data Safety state
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadBackups();
    if (formData.botToken) {
      checkWebhookStatus(formData.botToken);
    }
  }, []);

  const loadBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const list = await api.getBackups();
      setBackups(list);
    } catch (e: any) {
      console.error('Failed to load backups:', e);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleCreateManualBackup = async () => {
    setIsCreatingBackup(true);
    setBackupMsg(null);
    try {
      await api.createBackup('Manual Admin Backup');
      await loadBackups();
      setBackupMsg({ type: 'success', text: '✅ បានបង្កើត Backup មូលដ្ឋានទិន្នន័យជោគជ័យ!' });
      setTimeout(() => setBackupMsg(null), 4000);
    } catch (e: any) {
      setBackupMsg({ type: 'error', text: '❌ បរាជ័យក្នុងការបង្កើត Backup: ' + e.message });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestore = async (filename: string, createdAt: string) => {
    const formatted = new Date(createdAt).toLocaleString();
    if (!confirm(`⚠️ តើអ្នកប្រាកដជាចង់ស្តារទិន្នន័យពី Backup កាលបរិច្ឆេទ "${formatted}" នេះមែនទេ?\n\n(ប្រព័ន្ធនឹងចម្លងទិន្នន័យបច្ចុប្បន្នទុកជា Backup ស្វ័យប្រវត្តិកុំឱ្យបាត់បង់សិន មុនពេលស្តារឡើងវិញ)`)) {
      return;
    }

    setRestoringFilename(filename);
    setBackupMsg(null);
    try {
      const res = await api.restoreBackup(filename);
      await loadBackups();
      setBackupMsg({ type: 'success', text: `✅ ${res.message || 'បានស្តារទិន្នន័យជោគជ័យ!'} (ទំព័រនឹង refresh ក្នុងរយៈពេល 2 វិនាទី)` });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      setBackupMsg({ type: 'error', text: '❌ បរាជ័យក្នុងការស្តារទិន្នន័យ: ' + e.message });
    } finally {
      setRestoringFilename(null);
    }
  };

  const handleChange = (field: keyof BotSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setIsSaved(false);
    try {
      await onUpdateSettings(formData);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestToken = async () => {
    const token = formData.botToken?.trim();
    if (!token) {
      setVerifyResult({ ok: false, error: 'សូមបញ្ចូល Bot Token ពី @BotFather ជាមុនសិន' });
      return;
    }
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.verifyTelegramToken(token);
      setVerifyResult(res);
      if (res.ok && res.bot?.username) {
        // Automatically sync username
        handleChange('botUsername', res.bot.username);
        // Also auto-save to database so it takes effect immediately!
        await onUpdateSettings({
          ...formData,
          botToken: token,
          botUsername: res.bot.username,
          isPollingActive: true
        });
        handleChange('isPollingActive', true);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const checkWebhookStatus = async (tokenOverride?: string) => {
    const token = (tokenOverride || formData.botToken)?.trim();
    if (!token) return;
    setIsCheckingWebhook(true);
    try {
      const res = await api.getTelegramWebhookInfo(token);
      setWebhookInfo(res);
    } catch (e: any) {
      console.warn('Failed to check webhook info:', e);
    } finally {
      setIsCheckingWebhook(false);
    }
  };

  const handleSetupWebhook = async (customUrl?: string) => {
    const token = formData.botToken?.trim();
    if (!token) {
      alert('សូមបញ្ចូល Bot Token ពី @BotFather ជាមុនសិន!');
      return;
    }
    const targetUrl = customUrl || formData.webhookUrl || `${window.location.origin}/api/telegram/webhook`;
    setIsSettingWebhook(true);
    setWebhookMsg(null);
    try {
      const res = await api.setTelegramWebhook(targetUrl, token);
      if (res.ok) {
        setWebhookMsg({
          type: 'success',
          text: `⚡ Webhook ត្រូវបានភ្ជាប់ជោគជ័យ! Bot ដំណើរការ 24/7 ជាប់រហូត ទោះបីជាបិទ Browser ឬបិទទូរស័ព្ទចោលក៏ដោយ។`
        });
        handleChange('webhookUrl', targetUrl);
        handleChange('webhookEnabled', true);
        handleChange('isPollingActive', false);
        handleChange('lastWebhookSync', new Date().toISOString());

        // Save persistently to store.json so it stays active forever
        await onUpdateSettings({
          ...formData,
          webhookUrl: targetUrl,
          webhookEnabled: true,
          isPollingActive: false,
          lastWebhookSync: new Date().toISOString()
        });

        // Query live webhook status from Telegram
        await checkWebhookStatus(token);
      } else {
        setWebhookMsg({
          type: 'error',
          text: `❌ បរាជ័យក្នុងការភ្ជាប់ Webhook៖ ${res.description || 'Unknown error'}`
        });
      }
    } catch (e: any) {
      setWebhookMsg({
        type: 'error',
        text: `❌ កំហុសបណ្តាញ៖ ${e.message}`
      });
    } finally {
      setIsSettingWebhook(false);
    }
  };

  const handleSwitchToPolling = async () => {
    const token = formData.botToken?.trim();
    if (!token) return;
    setIsSettingWebhook(true);
    setWebhookMsg(null);
    try {
      const res = await api.deleteTelegramWebhook(token);
      if (res.ok) {
        handleChange('isPollingActive', true);
        handleChange('webhookEnabled', false);
        await onUpdateSettings({
          ...formData,
          isPollingActive: true,
          webhookEnabled: false
        });
        setWebhookMsg({
          type: 'success',
          text: '✅ បានប្តូរមក Long Polling (Bot ដំណើរការពេល Server/Browser កំពុងបើក)'
        });
        await checkWebhookStatus(token);
      } else {
        setWebhookMsg({
          type: 'error',
          text: `❌ មិនអាចលុប Webhook: ${res.description}`
        });
      }
    } finally {
      setIsSettingWebhook(false);
    }
  };

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/telegram/webhook` : '';

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <span>កំណត់ប្រព័ន្ធ (Bot & Payment Settings)</span>
          </h3>
          <p className="text-xs text-slate-400">កំណត់ Telegram Bot API, CutLuy Live KHQR Gateway និងសារប្រព័ន្ធ</p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold animate-pulse">
            <CheckCircle2 className="w-4 h-4" />
            <span>បានរក្សាទុកជោគជ័យ!</span>
          </div>
        )}
      </div>

      {/* QUICK STEP-BY-STEP GUIDE: How to run real Telegram Bot in 1 minute */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-5 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-bold text-white">
              របៀបបើកដំណើរការ Telegram Bot ឲ្យដំណើរការពិតៗ (Real Live Bot)
            </h4>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            ងាយស្រួល ១ នាទី
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          ដើម្បីឲ្យ Telegram Bot ឆ្លើយតបសារ អតិថិជន និងលក់ Account ស្វ័យប្រវត្តិនៅលើ Telegram ផ្ទាល់ សូមអនុវត្តតាមជំហានងាយៗខាងក្រោម៖
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1">
            <span className="text-indigo-400 font-bold block text-[11px]">១. បង្កើត Bot លើ Telegram</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              បើក Telegram ស្វែងរក <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-indigo-300 underline font-semibold">@BotFather</a> រួចផ្ញើពាក្យ <code>/newbot</code>។
            </p>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1">
            <span className="text-indigo-400 font-bold block text-[11px]">២. ចម្លង Bot Token</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Copy លេខកូដ API Token (ឧ. <code>781293:AAH...</code>) រួចបិទភ្ជាប់ (Paste) ក្នុងប្រអប់ខាងក្រោម។
            </p>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1">
            <span className="text-indigo-400 font-bold block text-[11px]">៣. ពិនិត្យ & បើកដំណើរការ</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              ចុច <b>"🔍 ពិនិត្យការតភ្ជាប់"</b> រួចបើក <b>"Polling"</b> ឬ <b>"Webhook"</b> នោះ Bot នឹងដំណើរការភ្លាម!
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* SECTION 1: Telegram Bot Credentials */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              <h4 className="font-bold text-white">Telegram Bot Credentials (ដំណើរការពិតៗ)</h4>
            </div>

            {/* Polling Switch */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.isPollingActive}
                  onChange={(e) => handleChange('isPollingActive', e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-300 font-semibold">បើកដំណើរការ Polling ស្វ័យប្រវត្តិ (24/7)</span>
              </label>
            </div>
          </div>

          {/* Token input + verify action */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Bot Token (API Token ទទួលបានពី @BotFather) *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.botToken}
                onChange={(e) => handleChange('botToken', e.target.value.trim())}
                placeholder="ឧ. 7829104812:AAH9_AbcdefGHIJklMNopqRSTuvWxYZ1234"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-indigo-500 text-xs"
              />
              <button
                type="button"
                onClick={handleTestToken}
                disabled={isVerifying || !formData.botToken}
                className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                <span>{isVerifying ? 'កំពុងពិនិត្យ...' : '🔍 ពិនិត្យការតភ្ជាប់'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              បញ្ចូល Token ពិតដើម្បីឲ្យ Bot ឆ្លើយតបសារ អតិថិជន និង KHQR លើ Telegram ផ្ទាល់។
            </p>
          </div>

          {/* Live Token Verification Card */}
          {verifyResult && (
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                verifyResult.ok
                  ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-700/60 text-rose-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {verifyResult.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold block">
                    {verifyResult.ok ? 'ការតភ្ជាប់ជោគជ័យ! Bot ដំណើរការពិតៗ ១០០%' : 'ការតភ្ជាប់បរាជ័យ'}
                  </span>
                  {verifyResult.ok && verifyResult.bot ? (
                    <div className="mt-1 space-y-0.5 text-[11px] text-slate-300">
                      <div>• ឈ្មោះ Bot៖ <b>{verifyResult.bot.first_name}</b></div>
                      <div>• Username៖ <b>@{verifyResult.bot.username}</b> (ID: {verifyResult.bot.id})</div>
                      <div className="text-emerald-400">✨ ប្រព័ន្ធបានភ្ជាប់ Bot ទៅកាន់ប្រព័ន្ធលក់ស្វ័យប្រវត្តិរួចរាល់!</div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-rose-300">{verifyResult.error}</span>
                  )}
                </div>
              </div>

              {verifyResult.ok && verifyResult.bot?.username && (
                <a
                  href={`https://t.me/${verifyResult.bot.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-success px-4 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  <span>💬 បើកឆាតជាមួយ Bot លើ Telegram</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Webhook 24/7 Serverless Dedicated Panel */}
          <div className="p-4 bg-gradient-to-br from-indigo-950/40 via-slate-950/80 to-slate-900 border border-indigo-500/30 rounded-2xl space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
                <div>
                  <h5 className="font-bold text-white text-xs flex items-center gap-2">
                    <span>Telegram Webhook 24/7 (ដំណើរការរហូត ទោះបីបិទ Browser / ទូរស័ព្ទ)</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Serverless Always-On
                    </span>
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Cloud Run / Gemini Hosting នឹងដាស់ Server ភ្លាមៗពេលមានសារ Telegram ផ្ញើមក មិនបាច់ពឹង App ក្រៅ
                  </p>
                </div>
              </div>

              {formData.webhookEnabled && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Webhook 24/7 សកម្ម</span>
                </span>
              )}
            </div>

            {/* Explanation box */}
            <div className="p-3 bg-slate-950/80 border border-indigo-500/20 rounded-xl space-y-1.5 text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>របៀបដំណើរការស្វ័យប្រវត្ត 24/7៖</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                ពេលគ្មានអ្នកបើក Browser ប្រព័ន្ធ Cloud Run នឹង Sleep ដើម្បីកាត់បន្ថយ Resource។ នៅពេលភ្ជាប់ Webhook រាល់ពេលមានអតិថិជនឆាតមកកាន់ Bot លើ Telegram នោះ Server នឹងត្រូវបាន Telegram ដាស់ភ្លាមៗ (&lt; 0.1 វិនាទី) ដើម្បីឆ្លើយតប និងបញ្ជូន KHQR ស្វ័យប្រវត្តិ។
              </p>
            </div>

            {/* Webhook URL Input */}
            <div>
              <label className="block text-slate-300 font-medium mb-1 text-[11px] flex items-center justify-between">
                <span>Webhook URL លើ Server នេះ (Direct HTTPS Endpoint):</span>
                <span className="text-slate-500 text-[10px] font-mono">POST /api/telegram/webhook</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.webhookUrl || webhookUrl}
                  onChange={(e) => handleChange('webhookUrl', e.target.value.trim())}
                  placeholder={webhookUrl}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-hidden focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleSetupWebhook(formData.webhookUrl || webhookUrl)}
                  disabled={isSettingWebhook || !formData.botToken}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isSettingWebhook ? 'កំពុងភ្ជាប់...' : '⚡ ភ្ជាប់ Webhook 24/7'}</span>
                </button>
              </div>
            </div>

            {/* Live Webhook Status Diagnostic Card */}
            {webhookInfo && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  webhookInfo.ok && webhookInfo.info?.url
                    ? 'bg-emerald-950/30 border-emerald-600/40 text-emerald-200'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {webhookInfo.ok && webhookInfo.info?.url ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Radio className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="font-bold text-[11px]">
                      {webhookInfo.ok && webhookInfo.info?.url
                        ? '🟢 ស្ថានភាព Telegram Webhook៖ បានភ្ជាប់ជោគជ័យ (Active 24/7)'
                        : '⚪ ស្ថានភាព Telegram Webhook៖ មិនទាន់ភ្ជាប់ (កំពុងប្រើ Polling ឬអសកម្ម)'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => checkWebhookStatus()}
                    disabled={isCheckingWebhook}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 underline cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingWebhook ? 'animate-spin' : ''}`} />
                    <span>{isCheckingWebhook ? 'កំពុងពិនិត្យ...' : 'ពិនិត្យឡើងវិញ'}</span>
                  </button>
                </div>

                {webhookInfo.ok && webhookInfo.info && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] font-mono text-slate-300">
                    <div>
                      • URL ភ្ជាប់៖ <span className="text-white break-all">{webhookInfo.info.url || 'គ្មាន'}</span>
                    </div>
                    <div>
                      • សារកំពុងរង់ចាំ (Pending): <span className="text-white font-bold">{webhookInfo.info.pending_update_count}</span>
                    </div>
                    {webhookInfo.info.last_error_message && (
                      <div className="col-span-full text-rose-300 bg-rose-950/50 p-2 rounded-lg border border-rose-800/50">
                        ⚠️ Telegram Error: {webhookInfo.info.last_error_message} (Date: {webhookInfo.info.last_error_date ? new Date(webhookInfo.info.last_error_date * 1000).toLocaleString() : 'N/A'})
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => checkWebhookStatus()}
                disabled={isCheckingWebhook || !formData.botToken}
                className="btn-secondary px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isCheckingWebhook ? 'animate-spin' : ''}`} />
                <span>🔍 ពិនិត្យស្ថានភាព Webhook ពី Telegram</span>
              </button>

              <button
                type="button"
                onClick={handleSwitchToPolling}
                disabled={isSettingWebhook || !formData.botToken}
                className="btn-secondary px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 border-slate-700 text-slate-300 hover:text-white"
              >
                <Radio className="w-3.5 h-3.5 text-slate-400" />
                <span>ប្តូរមក Long Polling (សម្រាប់ Test ពេលបើក Browser)</span>
              </button>
            </div>

            {webhookMsg && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                  webhookMsg.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                }`}
              >
                {webhookMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{webhookMsg.text}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Bot Username (គ្មាន @)
              </label>
              <input
                type="text"
                value={formData.botUsername}
                onChange={(e) => handleChange('botUsername', e.target.value.replace('@', ''))}
                placeholder="kh_digital_store_bot"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Admin Support Username (@)
              </label>
              <input
                type="text"
                value={formData.supportUsername}
                onChange={(e) => handleChange('supportUsername', e.target.value.replace('@', ''))}
                placeholder="store_admin_support"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Telegram Channel/Group ID សម្រាប់ Alert
              </label>
              <input
                type="text"
                value={formData.channelId}
                onChange={(e) => handleChange('channelId', e.target.value)}
                placeholder="-1001234567890"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Admin Telegram Chat ID (ទទួល Slip ផ្ទាល់ខ្លួន)
              </label>
              <input
                type="text"
                value={formData.adminTelegramId || ''}
                onChange={(e) => handleChange('adminTelegramId', e.target.value)}
                placeholder="ឧ. 99881122"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">ទទួល Slip ផ្ទាល់ខ្លួន និងប៊ូតុង [✅ Approve] / [❌ Reject]</p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Telegram Team Group ID (ជូនដំណឹង និងបញ្ជូន Slip ចូល Group)
              </label>
              <input
                type="text"
                value={formData.adminGroupId || ''}
                onChange={(e) => handleChange('adminGroupId', e.target.value)}
                placeholder="ឧ. -1002345678901 (Group Telegram)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">សម្រាប់ឱ្យ Bot បញ្ជូនព័ត៌មាន Order ថ្មី និង Slip បង់ប្រាក់ចូល Group ក្រុមការងារ</p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                លេខទូរស័ព្ទជំនួយ & ដឹកជញ្ជូន (Support Phone)
              </label>
              <input
                type="text"
                value={formData.supportPhone || ''}
                onChange={(e) => handleChange('supportPhone', e.target.value)}
                placeholder="012 889 900 / 098 776 655"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">បង្ហាញក្នុងប៊ូតុង [📞 ជំនួយ & ទំនាក់ទំនង]</p>
            </div>
          </div>
        </div>

        {/* SECTION 2: CutLuy Payment Gateway */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h4 className="font-bold text-white">CutLuy KHQR Payment Gateway (White-Label)</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                CutLuy Live API Key
              </label>
              <input
                type="password"
                value={formData.cutluyApiKey}
                onChange={(e) => handleChange('cutluyApiKey', e.target.value.trim())}
                placeholder="cl_live_xxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                API Key សម្រាប់បង្កើត KHQR តាម <code>POST https://cutluy.com/v1/payments</code>
              </p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                រយៈពេលផុតកំណត់ KHQR (នាទី)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={formData.qrExpiryMinutes}
                onChange={(e) => handleChange('qrExpiryMinutes', parseInt(e.target.value, 10) || 5)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                លំនាំដើម 5 នាទី (ផុតកំណត់នឹងដោះលែងស្តុកមកវិញ)
              </p>
            </div>
          </div>
        </div>

        {/* SECTION: Shipping Fees & Currency Exchange */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Truck className="w-4 h-4 text-cyan-400" />
            <h4 className="font-bold text-white">សេវាដឹកជញ្ជូន & អត្រាប្តូរប្រាក់រៀល (Shipping & Dual Currency)</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1 text-xs">
                ថ្លៃដឹកជញ្ជូន ភ្នំពេញ ($)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={formData.shippingFeePhnomPenh ?? 1.25}
                onChange={(e) => handleChange('shippingFeePhnomPenh', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">លំនាំដើម $1.25 ក្នុងរាជធានីភ្នំពេញ</p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1 text-xs">
                ថ្លៃដឹកជញ្ជូន តាមខេត្ត ($)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={formData.shippingFeeProvince ?? 1.75}
                onChange={(e) => handleChange('shippingFeeProvince', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">ផ្ញើតាម VET Express / J&T Express ($1.75)</p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1 text-xs">
                កម្រិត Free Delivery ($)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={formData.freeShippingThreshold ?? 15.0}
                onChange={(e) => handleChange('freeShippingThreshold', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">ទិញចាប់ពី $15 ឡើងទៅ ដឹកជញ្ជូនឥតគិតថ្លៃ</p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1 text-xs">
                អត្រាប្តូរប្រាក់ KHR ($1 = ? ៛)
              </label>
              <input
                type="number"
                step="10"
                min="3000"
                max="5000"
                value={formData.khrExchangeRate ?? 4100}
                onChange={(e) => handleChange('khrExchangeRate', parseInt(e.target.value, 10) || 4100)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">បង្ហាញតម្លៃគួបផ្សំ USD និង KHR (រៀល)</p>
            </div>
          </div>
        </div>

        {/* SECTION 3: Referral System */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              <h4 className="font-bold text-white">កម្មវិធីណែនាំមិត្តភក្តិ (Referral Program)</h4>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.referralEnabled}
                onChange={(e) => handleChange('referralEnabled', e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-violet-600 focus:ring-violet-500 w-4 h-4"
              />
              <span className="text-slate-300 font-semibold">បើកដំណើរការ Referral</span>
            </label>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              កម្រៃជើងសារក្នុង 1 Account ដែលលក់ដាច់ (USD)
            </label>
            <input
              type="number"
              step="0.05"
              min="0"
              value={formData.referralCommissionPerAccount}
              onChange={(e) => handleChange('referralCommissionPerAccount', parseFloat(e.target.value) || 0)}
              className="w-full md:w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-violet-500"
            />
          </div>
        </div>

        {/* SECTION 4: Bot Messages & Texts */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Bell className="w-4 h-4 text-amber-400" />
            <h4 className="font-bold text-white">សារស្វាគមន៍ និងការណែនាំប្រព័ន្ធ (Bot Messages)</h4>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              សារស្វាគមន៍ដំបូង (Welcome Message - HTML)
            </label>
            <textarea
              rows={4}
              value={formData.welcomeMessage}
              onChange={(e) => handleChange('welcomeMessage', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              ការណែនាំក្រោយទិញរួច (Post-Purchase Instructions)
            </label>
            <textarea
              rows={3}
              value={formData.postPurchaseInstructions}
              onChange={(e) => handleChange('postPurchaseInstructions', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              សារពេលអស់ស្តុកក្នុងពេលទូទាត់ (Stock Depleted Message)
            </label>
            <textarea
              rows={2}
              value={formData.stockDepletedPolicyMessage}
              onChange={(e) => handleChange('stockDepletedPolicyMessage', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* SECTION 5: Data Protection & Automatic Backups (មិនបាត់ទិន្នន័យចាស់ៗ) */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <div>
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span>ប្រព័ន្ធការពារទិន្នន័យ & Backup ស្វ័យប្រវត្តិ (Data Safety & Snapshots)</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    🟢 Auto-Guard សកម្ម
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  រាល់ពេលកែប្រែ (សៀវភៅ, Order, អតិថិជន, ស្តុក) ទិន្នន័យចាស់ៗមិនដែលបាត់បង់ទេ — ប្រព័ន្ធកត់ត្រា History និង Backup ស្វ័យប្រវត្តិ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateManualBackup}
                disabled={isCreatingBackup}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 text-emerald-300 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Database className={`w-3.5 h-3.5 ${isCreatingBackup ? 'animate-spin' : ''}`} />
                <span>{isCreatingBackup ? 'កំពុង Backup...' : '+ បង្កើត Backup ឥឡូវ'}</span>
              </button>

              <a
                href="/api/backups/download"
                download="store_database_backup.json"
                className="px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ទាញយក JSON</span>
              </a>

              <button
                type="button"
                onClick={loadBackups}
                disabled={isLoadingBackups}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Refresh Backups List"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackups ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {backupMsg && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                backupMsg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{backupMsg.text}</span>
            </div>
          )}

          {/* Backup List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1 font-medium text-slate-300">
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span>បញ្ជី Backup Snapshots ចុងក្រោយ ({backups.length})</span>
              </span>
              <span className="text-[11px] text-slate-400">រក្សាទុក 20 Snapshots ចុងក្រោយដោយស្វ័យប្រវត្តិ</span>
            </div>

            {isLoadingBackups && backups.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-950/50 rounded-lg">
                កំពុងទាញយកបញ្ជី Backup...
              </div>
            ) : backups.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-950/50 rounded-lg border border-slate-800">
                មិនទាន់មាន Backup នៅឡើយទេ។ ចុច "+ បង្កើត Backup ឥឡូវ" ដើម្បីបង្កើតឯកសារបម្រុងទុកដំបូង។
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {backups.map((b) => (
                  <div
                    key={b.filename}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-lg text-xs gap-2 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="font-semibold text-slate-200">
                          {new Date(b.timestamp).toLocaleString()}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {b.sizeKb} KB
                        </span>
                        {b.note && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {b.note}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3 font-mono pl-5">
                        <span>📚 {b.itemCount?.products ?? 0} សៀវភៅ</span>
                        <span>🛒 {b.itemCount?.orders ?? 0} Orders</span>
                        <span>👥 {b.itemCount?.customers ?? 0} អតិថិជន</span>
                        <span>🎟️ {b.itemCount?.coupons ?? 0} Coupons</span>
                        <span>📦 {b.itemCount?.stock ?? 0} ស្តុក</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleRestore(b.filename, b.timestamp)}
                        disabled={restoringFilename === b.filename}
                        className="px-2.5 py-1 rounded-md bg-amber-950/50 hover:bg-amber-900/70 border border-amber-500/30 text-amber-300 hover:text-white transition-all text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="ស្តារទិន្នន័យត្រឡប់ទៅពេលវេលានេះវិញ"
                      >
                        <RotateCcw className={`w-3 h-3 ${restoringFilename === b.filename ? 'animate-spin' : ''}`} />
                        <span>{restoringFilename === b.filename ? 'កំពុងស្តារ...' : 'ស្តារទិន្នន័យ (Restore)'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
            <span>{isSubmitting ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការកំណត់ទាំងអស់'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
