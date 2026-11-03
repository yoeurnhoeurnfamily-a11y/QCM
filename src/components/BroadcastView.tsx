import React, { useState, useEffect } from 'react';
import { Megaphone, Send, Users, CheckCircle2, AlertCircle, Building2, Image as ImageIcon, Sparkles, MessageSquare, ShieldCheck } from 'lucide-react';
import type { Customer } from '../types/store';
import { api } from '../services/api';

interface BroadcastViewProps {
  customers: Customer[];
  onSendBroadcast: (message: string, target?: 'all' | 'users' | 'groups', photoUrl?: string) => Promise<{ total: number; sent: number; failed: number }>;
}

export const BroadcastView: React.FC<BroadcastViewProps> = ({
  customers,
  onSendBroadcast
}) => {
  const DEFAULT_MESSAGE = `🔥 <b>ប្រូម៉ូសិនពិសេសចុងសប្តាហ៍!</b>\n\nទិញសៀវភៅថ្ងៃនេះ បញ្ចុះតម្លៃ <b>10% ភ្លាមៗ</b> ដោយប្រើ Coupon: <code>WELCOME10</code>\n\nសៀវភៅត្រៀមប្រឡង កម្រងសំណួរ QCM និងឯកសារសិក្សាជាច្រើនកំពុងរង់ចាំអ្នក។\n\n👇 ចុច [🛒 ទិញសៀវភៅ] ដើម្បីជ្រើសរើស និងកម្មង់ទិញ!`;

  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [target, setTarget] = useState<'all' | 'users' | 'groups'>('all');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ total: number; sent: number; failed: number } | null>(null);

  const [targetStats, setTargetStats] = useState<{
    usersCount: number;
    groupsCount: number;
    totalCount: number;
    groups: Array<{ id: string | number; title: string; type: string }>;
  }>({
    usersCount: customers.length,
    groupsCount: 0,
    totalCount: customers.length,
    groups: []
  });

  const loadTargetStats = async () => {
    try {
      const stats = await api.getBroadcastTargets();
      if (stats) {
        setTargetStats(stats);
      }
    } catch {
      // Fallback to customer count
      setTargetStats(prev => ({ ...prev, usersCount: customers.length, totalCount: customers.length }));
    }
  };

  useEffect(() => {
    loadTargetStats();
  }, [customers.length]);

  const templates = [
    {
      title: '🔥 ប្រូម៉ូសិនសៀវភៅ 10%',
      text: DEFAULT_MESSAGE
    },
    {
      title: '📚 វិញ្ញាសាបាក់ឌុប & QCM ចូលថ្មី',
      text: `📢 <b>ដំណឹងបន្ថែមសៀវភៅ និងវិញ្ញាសាថ្មីៗ!</b>\n\nបណ្ណាគារបានបន្ថែម៖\n• 📘 វិញ្ញាសាត្រៀមប្រឡងបាក់ឌុប ២០២៦ & គន្លឹះដោះស្រាយ\n• 📝 កម្រងសំណួរ QCM វប្បធម៌ទូទៅ ត្រៀមប្រឡងក្របខ័ណ្ឌរដ្ឋ\n• 🩺 QCM ត្រៀមប្រឡងចូលពេទ្យ & ឱសថ\n\n📥 <i>ទាញយកជា PDF ភ្លាមៗ ឬ កម្មង់សៀវភៅព្រីនដឹកដល់ផ្ទះ!</i>\n\n👇 ចុច [🛒 ទិញសៀវភៅ] ដើម្បីកម្មង់ទិញឥឡូវនេះ!`
    },
    {
      title: '🎓 ឈុតវិញ្ញាសា QCM ត្រៀមប្រឡងគ្រូ',
      text: `📢 <b>ឈុតវិញ្ញាសា & សំណួរ QCM ត្រៀមប្រឡងគ្រូគ្រប់កម្រិត!</b>\n\nបណ្ណាគារបានដាក់លក់ជាផ្លូវការនូវ ៤ ឈុតធំៗ៖\n• 👶 <b>ឈុតគ្រូមតេយ្យសិក្សា៖</b> QCM មតេយ្យ, គន្លឹះប្រឡង, សំណួរកុមារភាព, គរុកោសល្យ, វិញ្ញាសាគ្រូក្មេង\n• 🎒 <b>ឈុតគ្រូបឋមសិក្សា៖</b> QCM គ្រូបឋម, គន្លឹះប្រឡង, សំណួរពង្រឹងគ្រឹះ, គរុកោសល្យបឋម, វិញ្ញាសាបឋម\n• 🏫 <b>ឈុតគ្រូអនុវិទ្យាល័យ៖</b> QCM អនុវិទ្យាល័យ, គន្លឹះគ្រូមូលដ្ឋាន, សំណួរមូលដ្ឋាន, វិញ្ញាសាអនុវិទ្យាល័យ, ជំនាញមូលដ្ឋាន\n• 🏢 <b>ឈុតគ្រូវិទ្យាល័យ៖</b> QCM វិទ្យាល័យ, គន្លឹះគ្រូវិទ្យាល័យ, សំណួរជឿនលឿន, វិញ្ញាសាបាក់ឌុប, ជំនាញឯកទេស\n\n🎟️ បញ្ចុះតម្លៃ 10% ភ្លាមៗដោយប្រើកូដ: <code>WELCOME10</code>\n\n👇 ចុច [🛒 ទិញសៀវភៅ] ដើម្បីកម្មង់ទិញភ្លាមៗ!`
    },
    {
      title: '🚚 ដំណឹងដឹកជញ្ជូនសៀវភៅព្រីន',
      text: `📦 <b>ដំណឹងដឹកជញ្ជូនសៀវភៅព្រីនទូទាំងប្រទេស!</b>\n\nរាល់ការកម្មង់សៀវភៅព្រីន (Hardcopy) ក្រុមការងារនឹងវេចខ្ចប់យ៉ាងប្រុងប្រយ័ត្ន និងផ្ញើជូនតាមរយៈ Virak Buntham / J&T ក្នុងរយៈពេល 24 ម៉ោង។\n\n🎟️ ប្រើកូដ <code>READBOOK1</code> បញ្ចុះតម្លៃ $1.00 ភ្លាមៗ!\n\n👇 ចុច [🛒 ទិញសៀវភៅ] ដើម្បីជ្រើសរើសសៀវភៅ!`
    }
  ];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSending(true);
    setResult(null);
    try {
      const res = await onSendBroadcast(message, target, photoUrl.trim() || undefined);
      setResult(res);
      await loadTargetStats();
    } finally {
      setIsSending(false);
    }
  };

  const currentRecipientCount =
    target === 'all'
      ? targetStats.totalCount
      : target === 'users'
      ? targetStats.usersCount
      : targetStats.groupsCount;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-indigo-400" />
            <span>ផ្សាយដំណឹង (Mass Telegram Broadcast)</span>
          </h3>
          <p className="text-xs text-slate-400">ផ្ញើសារប្រូម៉ូសិនសៀវភៅត្រៀមប្រឡង QCM ដំណឹងស្តុកថ្មី ឬការប្រកាសទៅកាន់ Telegram Users និង គ្រប់គ្រុប</p>
        </div>

        {/* Live Target Count Badges */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Users: <strong className="text-white font-mono">{targetStats.usersCount}</strong></span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>គ្រុប: <strong className="text-white font-mono">{targetStats.groupsCount}</strong></span>
            </span>
          </div>
        </div>
      </div>

      {/* Owner Direct Telegram Feature Tip Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-500/30 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-indigo-300">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>មុខងារពិសេសសម្រាប់ម្ចាស់ហាង @yoeurnhoeurn (Telegram ID: 6277908085)៖</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          ពេលម្ចាស់ហាង <strong className="text-white">@yoeurnhoeurn</strong> វាយឆាតសារ ឬផ្ញើរូបភាពចូលក្នុង Telegram Bot ដោយផ្ទាល់ Bot នឹងបើកផ្ទាំង <strong>1-Click Dispatch</strong> ជូនភ្លាមៗ ដើម្បីបញ្ជូនសារនោះទៅកាន់ <strong>Users ទាំងអស់ និង គ្រុបទាំងអស់</strong> ដែលមាន Bot ជា Admin ដោយមិនចាំបាច់បើក Web Admin ឡើយ! ⚡
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
          <span>• Command: <code>/bc &lt;សារ&gt;</code></span>
          <span>• Control Panel: <code>/admin</code></span>
          <span>• Direct Chat: វាយសារ ឬផ្ញើរូបចូល Bot</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Editor Form */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-4">
          {/* Target Destination Tabs */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-2">
              🎯 ជ្រើសរើសគោលដៅផ្សាយសារ (Broadcast Target):
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTarget('all')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                  target === 'all'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>+</span>
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px]">ទាំងអស់ ({targetStats.totalCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setTarget('users')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                  target === 'users'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>Users</span>
                </div>
                <span className="text-[10px]">({targetStats.usersCount} នាក់)</span>
              </button>

              <button
                type="button"
                onClick={() => setTarget('groups')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                  target === 'groups'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>គ្រុប/ឆានែល</span>
                </div>
                <span className="text-[10px]">({targetStats.groupsCount} គ្រុប)</span>
              </button>
            </div>
          </div>

          {/* Quick Template Buttons */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400 font-medium block">គំរូសាររហ័ស (Quick Templates):</span>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMessage(tpl.text)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium border border-slate-700/60 transition-colors cursor-pointer"
                >
                  {tpl.title}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-white">សរសេរសារផ្សាយដំណឹង (HTML Enabled):</span>
                <button
                  type="button"
                  onClick={() => setShowPhotoInput(!showPhotoInput)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{showPhotoInput ? 'លាក់រូបភាព' : '+ ភ្ជាប់រូបភាព (Photo URL)'}</span>
                </button>
              </div>

              {showPhotoInput && (
                <div className="mb-2">
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/banner.jpg ឬ Telegram File ID..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    រូបភាពនឹងត្រូវផ្ញើជាមួយ Caption នៃអត្ថបទខាងក្រោម
                  </span>
                </div>
              )}

              <textarea
                rows={7}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="វាយអត្ថបទសារ..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-xs focus:outline-hidden focus:border-indigo-500 font-sans"
              />
            </div>

            <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <span className="font-semibold text-slate-300 block">💡 គន្លឹះ Formatting:</span>
              <div>• <code>&lt;b&gt;អក្សរដិត&lt;/b&gt;</code> → <b>អក្សរដិត</b></div>
              <div>• <code>&lt;i&gt;អក្សរទ្រេត&lt;/i&gt;</code> → <i>អក្សរទ្រេត</i></div>
              <div>• <code>&lt;code&gt;លេខកូដ&lt;/code&gt;</code> → ចុច Copy បាន</div>
            </div>

            <button
              type="submit"
              disabled={isSending || currentRecipientCount === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold disabled:opacity-50"
            >
              <Send className={`w-4 h-4 ${isSending ? 'animate-pulse' : ''}`} />
              <span>
                {isSending
                  ? 'កំពុងផ្សាយសារ...'
                  : `ផ្សាយសារទៅកាន់ ${
                      target === 'all'
                        ? `Users & គ្រុបទាំងអស់ (${currentRecipientCount})`
                        : target === 'users'
                        ? `Users ទាំងអស់ (${currentRecipientCount})`
                        : `គ្រុបទាំងអស់ (${currentRecipientCount})`
                    }`}
              </span>
            </button>
          </form>

          {/* Result Banner */}
          {result && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-2.5 text-xs animate-in fade-in duration-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-emerald-300 block">ការផ្សាយដំណឹងបានបញ្ចប់ជោគជ័យ!</span>
                <span className="text-slate-300 block">
                  បានផ្ញើជោគជ័យ <strong>{result.sent}</strong> / {result.total} {result.failed > 0 ? `(បរាជ័យ/Blocked: ${result.failed})` : ''}
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  គោលដៅ៖ {target === 'all' ? 'Users & គ្រុបទាំងអស់' : target === 'users' ? 'Users' : 'គ្រុប/ឆានែល'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Telegram Chat Bubble Preview */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
              <span>ទម្រង់បង្ហាញលើ Telegram (Live Preview)</span>
            </span>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
              Target: {target}
            </span>
          </div>

          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-end space-y-2">
            {photoUrl && (
              <div className="max-w-[85%] rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                <img
                  src={photoUrl}
                  alt="Preview"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  className="w-full max-h-48 object-cover"
                />
              </div>
            )}

            <div className="max-w-[85%] bg-slate-800 text-slate-100 rounded-2xl rounded-bl-xs p-3.5 shadow-md space-y-1.5 text-xs">
              <div
                className="prose prose-invert max-w-none text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: message.replace(/\n/g, '<br/>') }}
              />
              <div className="text-[10px] text-slate-400 text-right pt-1">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
