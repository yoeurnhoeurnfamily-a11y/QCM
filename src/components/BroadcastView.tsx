import React, { useState } from 'react';
import { Megaphone, Send, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Customer } from '../types/store';

interface BroadcastViewProps {
  customers: Customer[];
  onSendBroadcast: (message: string) => Promise<{ total: number; sent: number; failed: number }>;
}

export const BroadcastView: React.FC<BroadcastViewProps> = ({
  customers,
  onSendBroadcast
}) => {
  const DEFAULT_MESSAGE = `🔥 <b>ប្រូម៉ូសិនពិសេសចុងសប្តាហ៍!</b>\n\nទិញសៀវភៅថ្ងៃនេះ បញ្ចុះតម្លៃ <b>10% ភ្លាមៗ</b> ដោយប្រើ Coupon: <code>WELCOME10</code>\n\nសៀវភៅត្រៀមប្រឡង កម្រងសំណួរ QCM និងឯកសារសិក្សាជាច្រើនកំពុងរង់ចាំអ្នក។\n\n👇 ចុច [🛒 ទិញសៀវភៅ] ដើម្បីជ្រើសរើស និងកម្មង់ទិញ!`;

  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ total: number; sent: number; failed: number } | null>(null);

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
    if (!confirm(`តើអ្នកពិតជាចង់ផ្ញើសារនេះទៅកាន់អតិថិជន Telegram ទាំងអស់ (${customers.length} នាក់) មែនទេ?`)) {
      return;
    }
    setIsSending(true);
    setResult(null);
    try {
      const res = await onSendBroadcast(message);
      setResult(res);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-indigo-400" />
          <span>ផ្សាយដំណឹង (Mass Telegram Broadcast)</span>
        </h3>
        <p className="text-xs text-slate-400">ផ្ញើសារប្រូម៉ូសិនសៀវភៅត្រៀមប្រឡង QCM ដំណឹងស្តុកថ្មី ឬការប្រកាសទៅកាន់ Telegram Users ទាំងអស់</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Editor Form */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white">សរសេរសារផ្សាយដំណឹង (HTML Enabled)</span>
            <span className="text-slate-400 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>{customers.length} អ្នកទទួល</span>
            </span>
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
            <textarea
              rows={8}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="វាយអត្ថបទសារ..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-xs focus:outline-hidden focus:border-indigo-500 font-sans"
            />

            <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <span className="font-semibold text-slate-300 block">💡 គន្លឹះ Formatting:</span>
              <div>• <code>&lt;b&gt;អក្សរដិត&lt;/b&gt;</code> → <b>អក្សរដិត</b></div>
              <div>• <code>&lt;i&gt;អក្សរទ្រេត&lt;/i&gt;</code> → <i>អក្សរទ្រេត</i></div>
              <div>• <code>&lt;code&gt;លេខកូដ&lt;/code&gt;</code> → ចុច Copy បាន</div>
            </div>

            <button
              type="submit"
              disabled={isSending || customers.length === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold disabled:opacity-50"
            >
              <Send className={`w-4 h-4 ${isSending ? 'animate-pulse' : ''}`} />
              <span>{isSending ? 'កំពុងផ្ញើសារ...' : `ផ្ញើទៅកាន់ ${customers.length} អតិថិជន`}</span>
            </button>
          </form>

          {/* Result Banner */}
          {result && (
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/50 flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-300 block">ការផ្សាយដំណឹងបានបញ្ចប់!</span>
                <span className="text-slate-300">
                  បានផ្ញើជោគជ័យ {result.sent} / {result.total} នាក់ {result.failed > 0 ? `(បរាជ័យ ${result.failed})` : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Telegram Chat Bubble Preview */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 flex flex-col">
          <span className="text-xs font-semibold text-white mb-3 block">
            ទម្រង់បង្ហាញលើ Telegram (Live Preview)
          </span>

          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-end">
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
