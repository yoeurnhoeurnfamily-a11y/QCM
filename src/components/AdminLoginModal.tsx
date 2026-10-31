import React, { useState } from 'react';
import { Lock, ShieldCheck, User, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';

interface AdminLoginModalProps {
  onLoginSuccess: () => void;
}

export function getTodayPasscodes(): { primary: string; displayHint: string } {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  return {
    primary: `${dd}${mm}${yyyy}`,
    displayHint: `${dd}/${mm}/${yyyy} (លេខកូដ៖ ${dd}${mm}${yyyy})`
  };
}

export function verifyAdminCredentials(usernameInput: string, passcodeInput: string): boolean {
  const cleanUser = usernameInput.trim().toLowerCase();
  if (cleanUser !== 'qcmstore') return false;

  const cleanPass = passcodeInput.replace(/[\/\-\s]/g, '').trim();
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const validCodes = [
    `${dd}${mm}${yyyy}`, // 31102026
    `${yyyy}${mm}${dd}`, // 20261031
    `${dd}${mm}${yy}`,   // 311026
    `${mm}${dd}${yyyy}`  // 10312026
  ];

  return validCodes.includes(cleanPass);
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('qcmstore');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  const todayInfo = getTodayPasscodes();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !passcode.trim()) {
      setError('សូមបញ្ចូលគណនី និងលេខសម្ងាត់');
      return;
    }

    if (verifyAdminCredentials(username, passcode)) {
      if (rememberMe) {
        localStorage.setItem('qcm_admin_auth', 'authenticated');
        localStorage.setItem('qcm_admin_user', username.trim().toLowerCase());
      } else {
        sessionStorage.setItem('qcm_admin_auth', 'authenticated');
      }
      setError(null);
      onLoginSuccess();
    } else {
      setError('គណនី ឬលេខសម្ងាត់មិនត្រឹមត្រូវទេ! (គណនី: qcmstore, លេខសម្ងាត់: ថ្ងៃខែឆ្នាំប្រចាំថ្ងៃ)');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-2 mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-sky-500 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">ចូលគ្រប់គ្រងប្រព័ន្ធ (Admin Portal)</h2>
          <p className="text-xs text-slate-400">
            បណ្ណាគារសៀវភៅ & កម្រងវិញ្ញាសា QCM Store 🇰🇭
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>ឈ្មោះគណនី (Username)</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="qcmstore"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-hidden focus:border-indigo-500 font-mono transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              <span>លេខសម្ងាត់ប្រចាំថ្ងៃ (Daily Passcode)</span>
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder={`ឧ. ${todayInfo.primary}`}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-hidden focus:border-indigo-500 font-mono tracking-widest transition"
            />
            <div className="mt-2 p-2 rounded-lg bg-indigo-950/40 border border-indigo-900/50 flex items-center justify-between text-[11px] text-indigo-300">
              <span>💡 <b>លេខសម្ងាត់ថ្ងៃនេះ៖</b> {todayInfo.displayHint}</span>
              <button
                type="button"
                onClick={() => setPasscode(todayInfo.primary)}
                className="text-[10px] text-indigo-400 hover:text-white underline cursor-pointer"
              >
                បំពេញស្វ័យប្រវត្ត
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-800 text-indigo-600 focus:ring-0"
              />
              <span>ចងចាំការចូលលើ Browser នេះ</span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>ចូលទៅកាន់ផ្ទាំងគ្រប់គ្រង (Login)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>ទិន្នន័យអតិថិជន និងការលក់ត្រូវបានការពារដោយសុវត្ថិភាព</span>
        </div>
      </div>
    </div>
  );
};
