import React, { useState } from 'react';
import {
  Bot,
  Zap,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Sparkles,
  Key
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import type { BotSettings } from '../types/store';

interface QuickActivateBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BotSettings | null;
  onActivated: () => Promise<void>;
}

export const QuickActivateBotModal: React.FC<QuickActivateBotModalProps> = ({
  isOpen,
  onClose,
  settings,
  onActivated
}) => {
  const [tokenInput, setTokenInput] = useState(settings?.botToken || '');
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activatedBot, setActivatedBot] = useState<{ id: number; first_name: string; username: string } | null>(null);

  if (!isOpen) return null;

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim();
    if (!cleanToken) {
      setErrorMsg('សូមបញ្ចូល Bot Token ពី @BotFather ជាមុនសិន!');
      return;
    }

    setIsActivating(true);
    setErrorMsg(null);

    try {
      // 1. Verify token with Telegram API
      const verifyRes = await api.verifyTelegramToken(cleanToken);
      if (!verifyRes.ok || !verifyRes.bot) {
        setErrorMsg(verifyRes.error || 'Bot Token នេះមិនត្រឹមត្រូវឡើយ។ សូមពិនិត្យមើលម្ដងទៀត!');
        return;
      }

      const botInfo = verifyRes.bot;
      setActivatedBot(botInfo);

      // 2. Clear any lingering webhooks to guarantee polling success
      await api.deleteTelegramWebhook(cleanToken);

      // 3. Save settings & enable active polling
      await api.updateSettings({
        botToken: cleanToken,
        botUsername: botInfo.username,
        isPollingActive: true
      });

      // 4. Trigger confetti & refresh parent state
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });

      await onActivated();
    } catch (err: any) {
      setErrorMsg(err.message || 'មានបញ្ហាក្នុងការភ្ជាប់ទៅ Telegram');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">ដំណើរការ Telegram Bot ពិតៗ (Live Online)</h3>
              <p className="text-[11px] text-slate-400">ប្តូរពី Simulator Mode ទៅដំណើរការលើ Telegram ផ្ទាល់</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* If successfully activated */}
        {activatedBot ? (
          <div className="space-y-4 py-2 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-base font-bold text-white">Bot របស់អ្នកដំណើរការលើ Telegram ជោគជ័យ! 🎉</h4>
              <p className="text-xs text-slate-300 mt-1">
                Bot ឈ្មោះ <b>{activatedBot.first_name}</b> (<code>@{activatedBot.username}</code>) កំពុង Online និងឆ្លើយតបសារអតិថិជន ២៤/៧។
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <a
                href={`https://t.me/${activatedBot.username}`}
                target="_blank"
                rel="noreferrer"
                className="btn-success px-5 py-2.5 text-xs font-bold flex items-center justify-center gap-2"
              >
                <span>👉 ចុចទីនេះដើម្បីតេស្តឆាតលើ Telegram ផ្ទាល់</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={onClose}
                className="btn-secondary px-4 py-2.5 text-xs font-semibold"
              >
                រួចរាល់
              </button>
            </div>
          </div>
        ) : (
          /* Activation Form */
          <form onSubmit={handleActivate} className="space-y-4 text-xs">
            {/* 3 Step Instruction Box */}
            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-[11px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>របៀបយក Bot Token ក្នុងរយៈពេល ៣០ វិនាទី៖</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-300 leading-relaxed pl-1">
                <li>
                  បើក Telegram ស្វែងរក <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-indigo-400 font-bold underline">@BotFather</a> រួចផ្ញើសារ <code>/newbot</code>
                </li>
                <li>ដាក់ឈ្មោះ Bot និង Username បញ្ចប់ដោយពាក្យ <code>bot</code></li>
                <li>ចម្លង (Copy) លេខកូដ <b>API Token</b> ដែល @BotFather ផ្ញើជូន មក Paste ខាងក្រោម៖</li>
              </ol>
            </div>

            {/* Input field */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Bot Token (API Token ពី @BotFather) *</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="ឧ. 7829104812:AAH9_AbcdefGHIJklMNopqRSTuvWxYZ1234"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-hidden focus:border-indigo-500 placeholder:text-slate-600"
              />
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary px-4 py-2 font-medium"
              >
                បោះបង់
              </button>
              <button
                type="submit"
                disabled={isActivating || !tokenInput.trim()}
                className="btn-primary px-5 py-2 text-white font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {isActivating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>កំពុងភ្ជាប់ Telegram...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>🚀 ដំណើរការ Bot ភ្លាមៗ (Activate)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
