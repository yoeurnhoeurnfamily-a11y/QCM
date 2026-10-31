import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  RotateCcw,
  Smartphone,
  Bot,
  CheckCircle2,
  Check,
  CreditCard,
  RefreshCw,
  Sparkles,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import type { BotSimulatorMessage, BotSettings } from '../types/store';

interface TelegramSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BotSettings | null;
  onDataChanged: () => void;
}

export const TelegramSimulatorModal: React.FC<TelegramSimulatorModalProps> = ({
  isOpen,
  onClose,
  settings,
  onDataChanged
}) => {
  const [messages, setMessages] = useState<BotSimulatorMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active persistent reply keyboard
  const [replyKeyboard, setReplyKeyboard] = useState<string[][]>([
    ['🛒 ទិញសៀវភៅ', '📦 ពិនិត្យស្តុក'],
    ['📜 ប្រវត្តិទិញ', '📞 ជំនួយ & ទំនាក់ទំនង'],
    ['👥 កម្មវិធីណែនាំ']
  ]);

  const botName = settings?.botUsername ? `@${settings.botUsername}` : 'KHQR Store Bot';

  // Scroll to bottom on message update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial welcome on open if empty
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      handleUserSend('/start');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUserSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    // Add user message to local state
    const userMsg: BotSimulatorMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsProcessing(true);

    try {
      await api.simulatorSendMessage(text);
      // Wait for bot response
      await fetchLatestBotResponse();
    } catch (err) {
      console.error('Simulator error:', err);
    } finally {
      setIsProcessing(false);
      onDataChanged();
    }
  };

  const handleCallbackClick = async (callbackData: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      await api.simulatorSendCallback(callbackData);
      await fetchLatestBotResponse();
    } catch (err) {
      console.error('Callback error:', err);
    } finally {
      setIsProcessing(false);
      onDataChanged();
    }
  };

  const handleSimulatePaymentApproval = async (orderId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await api.simulatorMockPay(orderId);
      if (res.success) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      await fetchLatestBotResponse();
    } catch (err) {
      console.error('Payment simulation error:', err);
    } finally {
      setIsProcessing(false);
      onDataChanged();
    }
  };

  const handleSimulateSendSlip = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const demoSlipUrl = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=60';
      const userMsg: BotSimulatorMessage = {
        id: `usr_slip_${Date.now()}`,
        sender: 'user',
        text: '📸 [បានផ្ញើវិក្កយបត្របង់ប្រាក់ ABA / Wing / Bakong]',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, userMsg]);
      await api.simulatorSendSlip(demoSlipUrl, 99881122, 'sim_customer', 'Tester', 'ខ្ញុំបានបង់ប្រាក់រួចហើយបង');
      await fetchLatestBotResponse();
    } catch (err) {
      console.error('Slip send error:', err);
    } finally {
      setIsProcessing(false);
      onDataChanged();
    }
  };

  const fetchLatestBotResponse = async () => {
    // Refresh orders to check if order was fulfilled or created
    const orders = await api.getOrders();
    const simOrders = orders.filter(o => o.telegramId.startsWith('sim_'));
    if (simOrders.length > 0) {
      const latest = simOrders[0];
      if (latest.status === 'pending') {
        setActiveOrderId(latest.id);
      } else if (latest.status === 'completed') {
        setActiveOrderId(null);
      }
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setActiveOrderId(null);
    handleUserSend('/start');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      {/* Phone Mockup Container */}
      <div className="relative w-full max-w-[420px] h-[92vh] max-h-[820px] bg-slate-950 rounded-[40px] border-4 border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Phone Notch & Status Bar */}
        <div className="h-6 bg-slate-950 flex items-center justify-between px-6 pt-1 select-none z-10 shrink-0">
          <span className="text-[11px] font-semibold text-slate-300 font-mono">9:41</span>
          <div className="w-20 h-4 bg-slate-900 rounded-full mx-auto" />
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
            <span>5G</span>
            <div className="w-4 h-2 border border-slate-400 rounded-xs flex items-center p-0.5">
              <div className="w-full h-full bg-slate-400 rounded-xs" />
            </div>
          </div>
        </div>

        {/* Telegram Header */}
        <div className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white tracking-tight">
                  {settings?.botUsername ? `KH Store Bot` : 'Store Bot 24/7'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <p className="text-[10px] text-slate-400">bot · online</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleResetChat}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Reset Simulator"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Simulator"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Telegram Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gradient-to-b from-slate-950 via-[#0d1424] to-slate-950 text-xs">
          {/* Welcome Pill */}
          <div className="text-center my-2">
            <span className="text-[10px] bg-slate-900/90 text-slate-400 px-3 py-1 rounded-full border border-slate-800">
              Today
            </span>
          </div>

          {messages.map((msg) => {
            const isBot = msg.sender === 'bot';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3 shadow-md space-y-2 text-xs leading-relaxed ${
                    isBot
                      ? 'bg-slate-900 text-slate-100 rounded-bl-xs border border-slate-800'
                      : 'bg-indigo-600 text-white rounded-br-xs'
                  }`}
                >
                  {/* Photo (KHQR Code image) */}
                  {msg.photoUrl && (
                    <div className="rounded-xl overflow-hidden bg-white p-2 text-center">
                      <img
                        src={msg.photoUrl}
                        alt="KHQR"
                        className="w-44 h-44 mx-auto object-contain"
                      />
                    </div>
                  )}

                  {/* Message Text with HTML support */}
                  <div
                    className="prose prose-invert max-w-none text-xs leading-relaxed break-words"
                    dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }}
                  />

                  {/* Timestamp */}
                  <div
                    className={`text-[9px] text-right ${
                      isBot ? 'text-slate-400' : 'text-indigo-200'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {/* Inline Keyboard underneath bot message */}
                {msg.inlineKeyboard && msg.inlineKeyboard.length > 0 && (
                  <div className="w-[88%] mt-2 space-y-1.5 select-none">
                    {msg.inlineKeyboard.map((row, rIdx) => (
                      <div key={rIdx} className="flex gap-1.5">
                        {row.map((btn, bIdx) => {
                          const isCheckout = btn.callback_data.startsWith('order_checkout_');
                          const isCheckPay = btn.callback_data.startsWith('check_pay_');
                          const isCancel = btn.callback_data.startsWith('cancel_order_');
                          const isStepperDec = btn.text === '➖';
                          const isStepperInc = btn.text === '➕';
                          const isStepperCount = btn.text.includes('ចំនួន');

                          let btnClasses = 'telegram-btn flex-1 py-2 px-2.5 rounded-xl text-[11px] font-semibold text-center cursor-pointer transition-all disabled:opacity-50 ';

                          if (isCheckout) {
                            btnClasses += 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-950/50 border border-emerald-400/30 font-bold active:scale-[0.98]';
                          } else if (isCheckPay) {
                            btnClasses += 'bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white shadow-md shadow-indigo-950/40 border border-indigo-400/30 active:scale-[0.98]';
                          } else if (isCancel) {
                            btnClasses += 'bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/40 active:scale-[0.98]';
                          } else if (isStepperDec || isStepperInc) {
                            btnClasses += 'max-w-[44px] bg-slate-800 hover:bg-indigo-600 text-white border border-slate-700 hover:border-indigo-500 text-sm font-bold flex items-center justify-center active:scale-90';
                          } else if (isStepperCount) {
                            btnClasses += 'bg-slate-900/90 text-indigo-300 border border-indigo-500/30 font-bold';
                          } else {
                            btnClasses += 'bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 hover:text-white active:scale-[0.98]';
                          }

                          return (
                            <button
                              key={bIdx}
                              onClick={() => handleCallbackClick(btn.callback_data)}
                              disabled={isProcessing}
                              className={btnClasses}
                            >
                              <span className="truncate">{btn.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Dedicated Fast Payment Simulation Banner if an invoice was sent */}
          {activeOrderId && (
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 my-2 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-semibold">
                <Sparkles className="w-4 h-4" />
                <span>Simulate KHQR Payment Approval</span>
              </div>
              <p className="text-[10px] text-slate-300">
                ចុចប៊ូតុងខាងក្រោមដើម្បីតេស្តដំណើរការ Fulfill 1.5 វិនាទី និងការប្រគល់សៀវភៅស្វ័យប្រវត្តិ៖
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSimulatePaymentApproval(activeOrderId)}
                  disabled={isProcessing}
                  className="btn-success py-2 px-2 rounded-xl text-white text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="សាកល្បងបង់ប្រាក់ CutLuy KHQR ស្វ័យប្រវត្តិ"
                >
                  <Zap className="w-3.5 h-3.5 animate-pulse" />
                  <span>⚡ KHQR ស្វ័យប្រវត្តិ</span>
                </button>
                <button
                  onClick={handleSimulateSendSlip}
                  disabled={isProcessing}
                  className="py-2 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="សាកល្បងផ្ញើរូបភាព Slip បង់ប្រាក់"
                >
                  <span>📸 ផ្ញើ Slip បង់ប្រាក់</span>
                </button>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 text-slate-400 text-[11px] italic py-1">
              <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>bot is typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Telegram Persistent Reply Keyboard */}
        <div className="bg-slate-900 border-t border-slate-800/80 p-2.5 space-y-2 shrink-0 select-none">
          {replyKeyboard.map((row, rIdx) => (
            <div key={rIdx} className="flex gap-2">
              {row.map((btnLabel, bIdx) => (
                <button
                  key={bIdx}
                  onClick={() => handleUserSend(btnLabel)}
                  disabled={isProcessing}
                  className="telegram-btn flex-1 py-2 px-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 text-[11px] font-semibold text-slate-100 transition-all cursor-pointer text-center truncate disabled:opacity-50 active:scale-95 shadow-sm"
                >
                  {btnLabel}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Text Input Footer */}
        <div className="p-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUserSend()}
            placeholder="សរសេរសារ ឬ /start..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-full px-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
          <button
            onClick={() => handleUserSend()}
            disabled={!inputText.trim() || isProcessing}
            className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
