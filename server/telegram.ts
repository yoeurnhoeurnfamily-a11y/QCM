import { db } from './db';
import { CutLuyService } from './cutluy';
import type { Order, Product, StockItem, BotSimulatorMessage } from '../src/types/store';

// Helper for splitting productId and qty where productId can contain underscores (e.g. prod_canva_01)
export function parseProductAndQty(actionStr: string, prefix: string): { productId: string; qty: number } | null {
  if (!actionStr.startsWith(prefix)) return null;
  const rest = actionStr.slice(prefix.length);
  const lastUnderscore = rest.lastIndexOf('_');
  if (lastUnderscore === -1) return null;
  const productId = rest.slice(0, lastUnderscore);
  const qty = parseInt(rest.slice(lastUnderscore + 1), 10);
  if (isNaN(qty)) return null;
  return { productId, qty };
}

// Compute total price based on product bulk pricing tiers
export function calculateOrderPrice(product: Product, qty: number): { unitPrice: number; totalAmount: number; isDiscounted: boolean } {
  let effectiveUnitPrice = product.price;

  if (product.bulkPricingEnabled && product.tiers && product.tiers.length > 0) {
    for (const tier of product.tiers) {
      if (qty >= tier.minQty && (tier.maxQty === null || qty <= tier.maxQty)) {
        effectiveUnitPrice = tier.pricePerUnit;
        break;
      }
    }
  }

  const totalAmount = Number((effectiveUnitPrice * qty).toFixed(2));
  return {
    unitPrice: effectiveUnitPrice,
    totalAmount,
    isDiscounted: effectiveUnitPrice < product.price
  };
}

export class TelegramBotService {
  private static isRunning = false;
  private static pollOffset = 0;
  private static pollAbortController: AbortController | null = null;
  private static simulatorListeners: ((msg: BotSimulatorMessage) => void)[] = [];

  public static addSimulatorListener(listener: (msg: BotSimulatorMessage) => void) {
    this.simulatorListeners.push(listener);
    return () => {
      this.simulatorListeners = this.simulatorListeners.filter(l => l !== listener);
    };
  }

  private static notifySimulator(msg: BotSimulatorMessage) {
    for (const listener of this.simulatorListeners) {
      try {
        listener(msg);
      } catch (err) {
        console.error('Error notifying simulator listener:', err);
      }
    }
  }

  // Session / conversation state for multi-step prompts (e.g., Hardcopy shipping address)
  private static customerStates: Map<string, { step: string; data: any }> = new Map();

  /**
   * Main Reply Keyboard (Persistent Menu at bottom of chat)
   */
  public static getMainReplyKeyboard() {
    return {
      keyboard: [
        [{ text: '🛒 ទិញសៀវភៅ' }, { text: '📦 ពិនិត្យស្តុក' }],
        [{ text: '📜 ប្រវត្តិទិញ' }, { text: '📞 ជំនួយ & ទំនាក់ទំនង' }],
        [{ text: '👥 កម្មវិធីណែនាំ' }]
      ],
      resize_keyboard: true,
      persistent: true
    };
  }

  /**
   * Sends text message to Telegram Chat (and simulator if target matches)
   */
  public static async sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      reply_markup?: any;
      parse_mode?: 'HTML' | 'MarkdownV2';
    }
  ): Promise<boolean> {
    const settings = db.getSettings();
    const token = settings.botToken?.trim();

    // Broadcast to simulator
    this.notifySimulator({
      id: `sim_msg_${Date.now()}_${Math.random()}`,
      sender: 'bot',
      text,
      timestamp: new Date().toLocaleTimeString(),
      inlineKeyboard: options?.reply_markup?.inline_keyboard,
      replyKeyboard: options?.reply_markup?.keyboard
    });

    if (!token || String(chatId).startsWith('sim_')) {
      return true;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parse_mode || 'HTML',
          reply_markup: options?.reply_markup
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        this.handleApiError('sendMessage', chatId, response.status, errText);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('Telegram sendMessage network error:', err.message);
      return false;
    }
  }

  /**
   * Gracefully handles expected Telegram API errors (such as user blocked bot 403 or inactive chat)
   */
  private static handleApiError(action: string, chatId: number | string, status: number, errText: string): void {
    let description = '';
    try {
      const errJson = JSON.parse(errText);
      description = (errJson.description || '').toLowerCase();
    } catch {
      description = errText.toLowerCase();
    }

    const isBlockedOrInactive =
      status === 403 ||
      description.includes('blocked by the user') ||
      description.includes('user is deactivated') ||
      description.includes('chat not found') ||
      description.includes('bot was kicked') ||
      description.includes("can't initiate conversation") ||
      description.includes('bot was stopped');

    if (isBlockedOrInactive) {
      // Mark customer as blocked in database so future automated broadcasts skip them
      db.setCustomerBlockedStatus(chatId, true);
      console.log(`[Telegram] User ${chatId} has blocked the bot or chat is inactive (${description || status}). Warning suppressed.`);
      return;
    }

    // Normal Telegram non-error: message not modified or message to edit not found
    if (status === 400 && (description.includes('message is not modified') || description.includes('message to edit not found'))) {
      return;
    }

    console.warn(`Telegram ${action} failed: ${status} - ${errText}`);
  }

  /**
   * Sends Photo via Multipart Form-data to Telegram Chat (KHQR image)
   */
  public static async sendPhoto(
    chatId: number | string,
    photoBuffer: Buffer,
    caption: string,
    options?: {
      reply_markup?: any;
      parse_mode?: 'HTML';
      qrDataUrl?: string;
    }
  ): Promise<boolean> {
    const settings = db.getSettings();
    const token = settings.botToken?.trim();

    // Broadcast to simulator with data URL
    this.notifySimulator({
      id: `sim_photo_${Date.now()}_${Math.random()}`,
      sender: 'bot',
      text: caption,
      photoUrl: options?.qrDataUrl || `data:image/png;base64,${photoBuffer.toString('base64')}`,
      timestamp: new Date().toLocaleTimeString(),
      inlineKeyboard: options?.reply_markup?.inline_keyboard
    });

    if (!token || String(chatId).startsWith('sim_')) {
      return true;
    }

    try {
      const formData = new FormData();
      formData.append('chat_id', String(chatId));
      formData.append('caption', caption);
      if (options?.parse_mode) {
        formData.append('parse_mode', options.parse_mode);
      }
      if (options?.reply_markup) {
        formData.append('reply_markup', JSON.stringify(options.reply_markup));
      }

      // Append photo as Blob
      const blob = new Blob([new Uint8Array(photoBuffer)], { type: 'image/png' });
      formData.append('photo', blob, 'khqr_payment.png');

      const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        this.handleApiError('sendPhoto', chatId, response.status, errText);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('Telegram sendPhoto network error:', err.message);
      return false;
    }
  }

  /**
   * Sends Photo using Telegram file_id or web URL (for forwarding payment slips to Admin)
   */
  public static async sendPhotoFileId(
    chatId: number | string,
    fileIdOrUrl: string,
    caption: string,
    options?: {
      reply_markup?: any;
      parse_mode?: 'HTML';
    }
  ): Promise<boolean> {
    const settings = db.getSettings();
    const token = settings.botToken?.trim();

    // Broadcast to simulator
    this.notifySimulator({
      id: `sim_slip_${Date.now()}_${Math.random()}`,
      sender: 'bot',
      text: caption,
      photoUrl: fileIdOrUrl.startsWith('http') ? fileIdOrUrl : undefined,
      timestamp: new Date().toLocaleTimeString(),
      inlineKeyboard: options?.reply_markup?.inline_keyboard
    });

    if (!token || String(chatId).startsWith('sim_')) {
      return true;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: fileIdOrUrl,
          caption,
          parse_mode: options?.parse_mode || 'HTML',
          reply_markup: options?.reply_markup
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        this.handleApiError('sendPhotoFileId', chatId, response.status, errText);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Edit an existing message caption / text
   */
  public static async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options?: {
      reply_markup?: any;
      parse_mode?: 'HTML';
    }
  ): Promise<boolean> {
    const settings = db.getSettings();
    const token = settings.botToken?.trim();
    if (!token || String(chatId).startsWith('sim_')) return true;

    try {
      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: options?.parse_mode || 'HTML',
          reply_markup: options?.reply_markup
        })
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Answer callback query (to remove loading spinner on button)
   */
  public static async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false): Promise<void> {
    const settings = db.getSettings();
    const token = settings.botToken?.trim();
    if (!token || callbackQueryId.startsWith('sim_')) return;

    try {
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: showAlert
        })
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Start / Welcome Handler
   */
  public static async handleStart(
    chatId: number | string,
    username: string,
    firstName: string,
    lastName?: string,
    startPayload?: string
  ) {
    const numericId = typeof chatId === 'number' ? chatId : parseInt(chatId, 10) || 10001;
    let referrerId: string | undefined = undefined;

    if (startPayload && startPayload.startsWith('ref_')) {
      referrerId = startPayload.replace('ref_', '').trim();
    }

    const customer = db.upsertCustomer(numericId, username, firstName, lastName, referrerId);
    const settings = db.getSettings();

    let welcomeText = `🏛️ <b>បណ្ណាគារវិញ្ញាសា & សៀវភៅសិក្សា (KH BOOKSTORE)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `👋 សួស្តី <b>${firstName}</b>! សូមស្វាគមន៍មកកាន់ប្រព័ន្ធបណ្ណាគារស្វ័យប្រវត្តិ 24/7។\n\n` +
      `📚 <b>កម្រងវិញ្ញាសា & សំណួរ QCM ត្រៀមប្រឡងគ្រូគ្រប់កម្រិត៖</b>\n` +
      `┌ 👶 <b>១. ឈុតគ្រូមតេយ្យសិក្សា (Preschool QCM)</b> — 5 មុខ\n` +
      `├ 🎒 <b>២. ឈុតគ្រូបឋមសិក្សា (Primary School QCM)</b> — 5 មុខ\n` +
      `├ 🏫 <b>៣. ឈុតគ្រូអនុវិទ្យាល័យ (Lower Secondary QCM)</b> — 5 មុខ\n` +
      `└ 🏢 <b>៤. ឈុតគ្រូវិទ្យាល័យ (Upper Secondary QCM)</b> — 5 មុខ\n\n` +
      `🎁 <b>កាដូស្វាគមន៍៖</b> បញ្ចុះតម្លៃ <b>10%</b> ភ្លាមៗដោយប្រើ Coupon: <code>WELCOME10</code>\n\n`;

    if (settings.welcomeMessage && settings.welcomeMessage.trim()) {
      welcomeText += `📢 <i>${settings.welcomeMessage}</i>\n\n`;
    }

    if (customer.referredBy) {
      welcomeText += `🎁 <i>លោកអ្នកបានភ្ជាប់តាមរយៈតំណ Referral ID: ${customer.referredBy}</i>\n\n`;
    }

    welcomeText += `👇 <i>សូមជ្រើសរើសមុខងារពី Menu ខាងក្រោម ឬចុច [🛒 ទិញសៀវភៅ] ដើម្បីចាប់ផ្តើម៖</i>`;

    await this.sendMessage(chatId, welcomeText, {
      reply_markup: this.getMainReplyKeyboard(),
      parse_mode: 'HTML'
    });
  }

  /**
   * Live Stock Checker
   */
  public static async sendLiveStock(chatId: number | string) {
    const products = db.getProducts().filter(p => p.isActive);
    let msg = `📦 <b>ស្ថានភាពស្តុកសៀវភៅផ្ទាល់ (LIVE INVENTORY)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (products.length === 0) {
      msg += `<i>បច្ចុប្បន្នមិនទាន់មានសៀវភៅដាក់លក់នៅឡើយទេ។</i>`;
    } else {
      const categories = [
        { key: 'cat_pre', name: '👶 ១. ឈុតគ្រូមតេយ្យសិក្សា (Preschool QCM)', prefix: 'prod_pre' },
        { key: 'cat_pri', name: '🎒 ២. ឈុតគ្រូបឋមសិក្សា (Primary School QCM)', prefix: 'prod_pri' },
        { key: 'cat_low', name: '🏫 ៣. ឈុតគ្រូអនុវិទ្យាល័យ (Lower Secondary QCM)', prefix: 'prod_low' },
        { key: 'cat_upp', name: '🏢 ៤. ឈុតគ្រូវិទ្យាល័យ (Upper Secondary QCM)', prefix: 'prod_upp' }
      ];

      categories.forEach(cat => {
        const catProds = products.filter(p => p.id.startsWith(cat.prefix) || p.category.includes(cat.name));
        if (catProds.length > 0) {
          msg += `<b>${cat.name}</b>\n`;
          catProds.forEach((p, idx) => {
            const count = db.getAvailableStockCount(p.id);
            const stockBadge = count > 3 ? `🟢 សល់ ${count} ច្បាប់` : count > 0 ? `🟡 សល់តែ ${count} ច្បាប់` : `🔴 អស់ស្តុក`;
            const isLast = idx === catProds.length - 1;
            msg += `${isLast ? '└' : '├'} 📄 <b>${p.name}</b>: <b>${stockBadge}</b> (<code>$${p.price.toFixed(2)}</code>)\n`;
          });
          msg += `\n`;
        }
      });

      msg += `💡 <i>ប្រព័ន្ធធ្វើបច្ចុប្បន្នភាពស្តុកស្វ័យប្រវត្តិតាម Real-time 24/7</i>\n`;
      msg += `👇 <i>ចុច <b>[🛒 ទិញសៀវភៅ]</b> ខាងក្រោមដើម្បីជ្រើសរើស និងកម្មង់ទិញ!</i>`;
    }

    await this.sendMessage(chatId, msg, {
      reply_markup: this.getMainReplyKeyboard(),
      parse_mode: 'HTML'
    });
  }

  /**
   * Customer Orders History
   * Checked strictly before 'ទិញ' so that "📜 ប្រវត្តិទិញ" works reliably!
   */
  public static async sendCustomerOrders(chatId: number | string) {
    const strId = String(chatId);
    const orders = db.getOrders().filter(o => o.telegramId === strId || (strId.startsWith('sim_') && o.telegramId.startsWith('sim_')));

    if (orders.length === 0) {
      const emptyMsg = `📜 <b>ប្រវត្តិការបញ្ជាទិញសៀវភៅ (ORDER HISTORY)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `លោកអ្នកមិនទាន់មានប្រវត្តិបញ្ជាទិញសៀវភៅនៅឡើយទេ។\n\n` +
        `👇 សូមចុចប៊ូតុង <b>[🛒 ទិញសៀវភៅ]</b> ដើម្បីជ្រើសរើសសៀវភៅដែលលោកអ្នកពេញចិត្ត!`;
      await this.sendMessage(chatId, emptyMsg, {
        reply_markup: this.getMainReplyKeyboard(),
        parse_mode: 'HTML'
      });
      return;
    }

    let msg = `📜 <b>ប្រវត្តិការបញ្ជាទិញសៀវភៅ (ORDER HISTORY)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `ប្រតិបត្តិការសរុប៖ <b>${orders.length}</b> លើក\n\n`;

    for (const ord of orders.slice(0, 5)) {
      const dateStr = new Date(ord.createdAt).toLocaleDateString('km-KH');
      let statusIcon = '⏳ កំពុងរង់ចាំទូទាត់';
      if (ord.status === 'completed') statusIcon = '🟢 ជោគជ័យ (Completed)';
      if (ord.status === 'expired') statusIcon = '🔴 ផុតកំណត់ (Expired)';
      if (ord.status === 'stock_depleted_refund_needed') statusIcon = '🟡 អស់ស្តុក (រង់ចាំ Admin)';

      const isPrinted = ord.bookFormat === 'printed';
      const formatLabel = isPrinted ? '📖 សៀវភៅព្រីន Hardcopy' : '📄 សៀវភៅអេឡិចត្រូនិក PDF';
      const unitLabel = isPrinted ? 'ក្បាល' : 'ច្បាប់';

      msg += `┌ 🔖 <b>វិក្កយបត្រ៖</b> <code>#${ord.id}</code>\n`;
      msg += `├ 📚 <b>សៀវភៅ៖</b> <b>${ord.productName}</b>\n`;
      msg += `├ 🏷️ <b>ទម្រង់៖</b> ${formatLabel}\n`;
      msg += `├ 🔢 <b>បរិមាណ៖</b> ${ord.quantity} ${unitLabel}\n`;
      msg += `├ 💵 <b>ទឹកប្រាក់៖</b> <code>$${ord.totalAmount.toFixed(2)} USD</code>\n`;
      msg += `├ 📊 <b>ស្ថានភាព៖</b> <b>${statusIcon}</b>\n`;
      msg += `├ 📅 <b>កាលបរិច្ឆេទ៖</b> ${dateStr}\n`;

      if (ord.status === 'completed') {
        if (isPrinted) {
          msg += `├ 🚚 <b>ស្ថានភាពដឹកជញ្ជូន៖</b> ${ord.shippingStatus === 'shipped' ? 'កំពុងដឹកជញ្ជូន' : ord.shippingStatus === 'delivered' ? 'បានប្រគល់រួច' : 'កំពុងរៀបចំ និងវេចខ្ចប់'}\n`;
          if (ord.trackingNumber) {
            msg += `└ 📦 <b>Tracking Code៖</b> <code>${ord.trackingNumber}</code>\n`;
          } else {
            msg += `└ 📦 <b>Tracking Code៖</b> <i>កំពុងរង់ចាំលេខកូដ</i>\n`;
          }
        } else if (ord.deliveredItems && ord.deliveredItems.length > 0) {
          msg += `└ 📥 <b>តំណភ្ជាប់ទាញយក PDF៖</b>\n`;
          for (const item of ord.deliveredItems) {
            msg += `  └ 📄 <code>${item}</code>\n`;
          }
        } else {
          msg += `└ 📥 <b>ឯកសារ៖</b> បានបញ្ជាក់រួចរាល់\n`;
        }
      } else {
        msg += `└ ⏱️ <b>ចំណាំ៖</b> សូមទូទាត់មុនពេលវិក្កយបត្រផុតកំណត់\n`;
      }
      msg += `\n`;
    }

    await this.sendMessage(chatId, msg, {
      reply_markup: this.getMainReplyKeyboard(),
      parse_mode: 'HTML'
    });
  }

  /**
   * Support Information & Direct Admin Contact
   */
  public static async sendSupport(chatId: number | string) {
    const settings = db.getSettings();
    const supportUser = settings.supportUsername || 'kh_bookstore_support';
    const supportPhone = settings.supportPhone || '012 889 900 / 098 776 543';

    const msg = `📞 <b>មជ្ឈមណ្ឌលជំនួយ & សេវាកម្មអតិថិជន (SUPPORT 24/7)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `សូមស្វាគមន៍មកកាន់ផ្នែកបម្រើអតិថិជន! ក្រុមការងាររង់ចាំជួយសម្រួលលោកអ្នកគ្រប់ពេល 24 ម៉ោង/7 ថ្ងៃ៖\n\n` +
      `┌ 👤 <b>Telegram Admin ផ្ទាល់៖</b> @${supportUser}\n` +
      `├ 📱 <b>ទូរស័ព្ទ Hotline៖</b> <code>${supportPhone}</code>\n` +
      `├ ⏰ <b>ម៉ោងបម្រើការ៖</b> 24 ម៉ោង / 7 ថ្ងៃ (គ្មានថ្ងៃឈប់សម្រាក)\n` +
      `├ ⚡ <b>ល្បឿនឆ្លើយតប៖</b> 1-5 នាទី\n` +
      `└ 🛡️ <b>ការធានា៖</b> ធានាសុពលភាពឯកសារ 100% និងដោះស្រាយបញ្ហាគ្រប់ជំហាន\n\n` +
      `📌 <b>សំនួរញឹកញាប់ (FAQ)៖</b>\n` +
      `• <b>សម្រាប់ E-book (PDF)៖</b> ក្រោយពេលទូទាត់ជោគជ័យ ប្រព័ន្ធផ្ញើតំណភ្ជាប់ ឬ File PDF ជូនលោកអ្នកភ្លាមៗ។ ប្រសិនបើលោកអ្នកផ្ញើវិក្កយបត្រ (Slip) ចូលក្នុង Bot Admin នឹងចុច Approve ជូនភ្លាម!\n` +
      `• <b>សម្រាប់សៀវភៅក្រដាស (Hardcopy)៖</b> ដឹកជញ្ជូនរហ័សដល់ផ្ទះក្នុងរាជធានីភ្នំពេញ និងផ្ញើតាម <b>VET Express (វីរៈប៊ុនថាំ) / J&T Express</b> ទៅគ្រប់ ២៥ ខេត្ត-ក្រុង។\n` +
      `• <b>ការបង់ប្រាក់៖</b> គាំទ្រ KHQR គ្រប់ធនាគារ (Bakong, ABA Pay, Wing, ACLEDA...)\n\n` +
      `👇 <i>សូមចុចប៊ូតុងខាងក្រោមដើម្បីឆាតទៅកាន់ Admin ផ្ទាល់ ឬចូលមើលសៀវភៅ៖</i>`;

    await this.sendMessage(chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 ឆាតទៅកាន់ Admin Support', url: `https://t.me/${supportUser}` }],
          [
            { text: '📚 មើលបញ្ជីសៀវភៅ (Catalog)', callback_data: 'catalog_menu' },
            { text: '📦 ពិនិត្យស្តុកសៀវភៅ', callback_data: 'stock_check' }
          ]
        ]
      },
      parse_mode: 'HTML'
    });
  }

  /**
   * Referral Program
   */
  public static async sendReferralProgram(chatId: number | string) {
    const strId = String(chatId);
    const numericId = typeof chatId === 'number' ? chatId : parseInt(chatId, 10) || 10001;
    const customer = db.getCustomerByTelegramId(numericId) || db.upsertCustomer(numericId, '', 'User');
    const settings = db.getSettings();

    const botUser = settings.botUsername || 'kh_bookstore_bot';
    const refLink = `https://t.me/${botUser}?start=ref_${customer.telegramId}`;
    const referredFriends = db.getCustomers().filter(c => c.referredBy === String(customer.telegramId)).length;
    const commissionPerAccount = settings.referralCommissionPerAccount || 0.20;

    let msg = `👥 <b>កម្មវិធីណែនាំមិត្តភក្តិ (BOOKSTORE REFERRAL)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `ចែករំលែកចំណេះដឹង និងបង្កើតប្រាក់ចំណូលបន្ថែមជាមួយ KH Bookstore!\n\n` +
      `┌ 💰 <b>កម្រៃជើងសារ៖</b> <b>$${commissionPerAccount.toFixed(2)} USD</b> ក្នុង 1 ក្បាល/ច្បាប់\n` +
      `├ 🔗 <b>តំណភ្ជាប់ផ្ទាល់ខ្លួន៖</b>\n` +
      `│  └ <code>${refLink}</code>\n` +
      `├ 👥 <b>មិត្តភក្តិបានណែនាំ៖</b> <b>${referredFriends} នាក់</b>\n` +
      `└ 💵 <b>សមតុល្យអាចដកបាន៖</b> <code>$${customer.walletBalance.toFixed(2)} USD</code>\n\n` +
      `💡 <i>រាល់ពេលមិត្តភក្តិទិញសៀវភៅតាម Link របស់អ្នក ប្រព័ន្ធនឹងផ្ទេរកម្រៃជើងសារចូលគណនីរបស់អ្នកភ្លាមៗ!</i>`;

    await this.sendMessage(chatId, msg, {
      reply_markup: this.getMainReplyKeyboard(),
      parse_mode: 'HTML'
    });
  }

  /**
   * Product Catalog View
   */
  public static async sendProductCatalog(chatId: number | string, categoryKey?: string, messageIdToEdit?: number) {
    const products = db.getProducts().filter(p => p.isActive);

    if (products.length === 0) {
      await this.sendMessage(chatId, '📚 បច្ចុប្បន្នមិនទាន់មានសៀវភៅដាក់លក់នៅឡើយទេ។ សូមពិនិត្យមើលម្តងទៀតនៅពេលក្រោយ!', {
        reply_markup: this.getMainReplyKeyboard()
      });
      return;
    }

    const categories = [
      { key: 'cat_pre', name: '👶 ១. ឈុតគ្រូមតេយ្យសិក្សា (Preschool QCM)', short: '👶 ឈុតគ្រូមតេយ្យ', prefix: 'prod_pre' },
      { key: 'cat_pri', name: '🎒 ២. ឈុតគ្រូបឋមសិក្សា (Primary School QCM)', short: '🎒 ឈុតគ្រូបឋម', prefix: 'prod_pri' },
      { key: 'cat_low', name: '🏫 ៣. ឈុតគ្រូអនុវិទ្យាល័យ (Lower Secondary QCM)', short: '🏫 ឈុតគ្រូអនុវិទ្យាល័យ', prefix: 'prod_low' },
      { key: 'cat_upp', name: '🏢 ៤. ឈុតគ្រូវិទ្យាល័យ (Upper Secondary QCM)', short: '🏢 ឈុតគ្រូវិទ្យាល័យ', prefix: 'prod_upp' }
    ];

    // Filter by Printed Hardcopy
    if (categoryKey === 'cat_printed') {
      const catProducts = products.filter(p => p.bookFormat === 'printed' || p.bookFormat === 'both');
      let msg = `📖 <b>សៀវភៅក្រដាសបោះពុម្ព (PRINTED HARDCOPY)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `ដឹកជញ្ជូនរហ័សដល់គេហដ្ឋាន (ភ្នំពេញ & តាមបណ្តាខេត្តតាមរយៈ VET / J&T Express)៖\n\n`;

      catProducts.forEach((b, idx) => {
        const stock = db.getAvailableStockCount(b.id);
        const stockDot = stock > 3 ? '🟢' : stock > 0 ? '🟡' : '🔴';
        const isLast = idx === catProducts.length - 1;
        msg += `${isLast ? '└' : '├'} 📖 <b>${b.name}</b>\n`;
        msg += `│  🖋️ <b>អ្នកនិពន្ធ៖</b> ${b.author || 'បណ្ណាគារ'} • <code>$${b.price.toFixed(2)}</code> ${stockDot}\n`;
        if (b.description) {
          msg += `│  📝 <i>${b.description.slice(0, 60)}...</i>\n`;
        }
      });

      msg += `\n👇 <i>សូមចុចលើសៀវភៅដែលចង់ទិញខាងក្រោម៖</i>`;

      const inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];
      for (const prod of catProducts) {
        const stockCount = db.getAvailableStockCount(prod.id);
        const stockDot = stockCount > 3 ? '🟢' : stockCount > 0 ? '🟡' : '🔴';
        inlineKeyboard.push([{ text: `📖 ${prod.name} • $${prod.price.toFixed(2)} ${stockDot}`, callback_data: `prod_view_${prod.id}` }]);
      }
      inlineKeyboard.push([
        { text: '🔙 ត្រឡប់ទៅបញ្ជីឈុតសៀវភៅ', callback_data: 'catalog_menu' },
        { text: '🏠 Menu ដើម', callback_data: 'menu_main' }
      ]);

      if (messageIdToEdit) {
        const edited = await this.editMessageText(chatId, messageIdToEdit, msg, {
          reply_markup: { inline_keyboard: inlineKeyboard },
          parse_mode: 'HTML'
        });
        if (edited) return;
      }

      await this.sendMessage(chatId, msg, {
        reply_markup: { inline_keyboard: inlineKeyboard },
        parse_mode: 'HTML'
      });
      return;
    }

    // Filter by PDF E-Book
    if (categoryKey === 'cat_pdf') {
      const catProducts = products.filter(p => p.bookFormat === 'pdf' || !p.bookFormat || p.bookFormat === 'both');
      let msg = `📄 <b>សៀវភៅអេឡិចត្រូនិក (PDF E-BOOK)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `ទាញយកឯកសារ PDF អានភ្លាមៗ 24/7 (អាចបើកលើ iPad, Tablet, ទូរស័ព្ទ, PC)៖\n\n`;

      catProducts.forEach((b, idx) => {
        const stock = db.getAvailableStockCount(b.id);
        const stockDot = stock > 3 ? '🟢' : stock > 0 ? '🟡' : '🔴';
        const isLast = idx === catProducts.length - 1;
        msg += `${isLast ? '└' : '├'} 📄 <b>${b.name}</b>\n`;
        msg += `│  🖋️ <b>អ្នកនិពន្ធ៖</b> ${b.author || 'បណ្ណាគារ'} • <code>$${b.price.toFixed(2)}</code> ${stockDot}\n`;
        if (b.description) {
          msg += `│  📝 <i>${b.description.slice(0, 60)}...</i>\n`;
        }
      });

      msg += `\n👇 <i>សូមចុចលើសៀវភៅដែលចង់ទិញខាងក្រោម៖</i>`;

      const inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];
      for (const prod of catProducts) {
        const stockCount = db.getAvailableStockCount(prod.id);
        const stockDot = stockCount > 3 ? '🟢' : stockCount > 0 ? '🟡' : '🔴';
        inlineKeyboard.push([{ text: `📄 ${prod.name} • $${prod.price.toFixed(2)} ${stockDot}`, callback_data: `prod_view_${prod.id}` }]);
      }
      inlineKeyboard.push([
        { text: '🔙 ត្រឡប់ទៅបញ្ជីឈុតសៀវភៅ', callback_data: 'catalog_menu' },
        { text: '🏠 Menu ដើម', callback_data: 'menu_main' }
      ]);

      if (messageIdToEdit) {
        const edited = await this.editMessageText(chatId, messageIdToEdit, msg, {
          reply_markup: { inline_keyboard: inlineKeyboard },
          parse_mode: 'HTML'
        });
        if (edited) return;
      }

      await this.sendMessage(chatId, msg, {
        reply_markup: { inline_keyboard: inlineKeyboard },
        parse_mode: 'HTML'
      });
      return;
    }

    // If a specific category was selected
    if (categoryKey && categoryKey !== 'cat_all') {
      const selectedCat = categories.find(c => c.key === categoryKey);
      const catProducts = selectedCat
        ? products.filter(p => p.id.startsWith(selectedCat.prefix) || p.category.includes(selectedCat.short))
        : products;

      let msg = `${selectedCat ? selectedCat.name : '📚 <b>កាតាឡុកសៀវភៅ</b>'}\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `កម្រងសំណួរ QCM និងវិញ្ញាសាត្រៀមប្រឡងគ្រូ៖\n\n`;

      catProducts.forEach((b, idx) => {
        const stock = db.getAvailableStockCount(b.id);
        const stockDot = stock > 3 ? '🟢' : stock > 0 ? '🟡' : '🔴';
        const isPrinted = b.bookFormat === 'printed';
        const formatIcon = isPrinted ? '📖' : '📄';
        const isLast = idx === catProducts.length - 1;
        msg += `${isLast ? '└' : '├'} ${formatIcon} <b>${b.name}</b>\n`;
        msg += `│  🖋️ ${b.author || 'បណ្ណាគារ'} • <code>$${b.price.toFixed(2)}</code> ${stockDot} (${isPrinted ? 'ព្រីន' : 'PDF'})\n`;
        if (b.description) {
          msg += `│  📝 <i>${b.description.slice(0, 55)}...</i>\n`;
        }
      });

      msg += `\n👇 <i>ចុចលើសៀវភៅដែលចង់ទិញខាងក្រោម៖</i>`;

      const inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

      for (const prod of catProducts) {
        const stockCount = db.getAvailableStockCount(prod.id);
        const stockDot = stockCount > 3 ? '🟢' : stockCount > 0 ? '🟡' : '🔴';
        const formatIcon = prod.bookFormat === 'printed' ? '📖' : '📄';
        const buttonLabel = `${formatIcon} ${prod.name} • $${prod.price.toFixed(2)} ${stockDot}`;
        inlineKeyboard.push([{ text: buttonLabel, callback_data: `prod_view_${prod.id}` }]);
      }

      // Navigation back
      inlineKeyboard.push([
        { text: '🔙 ត្រឡប់ទៅបញ្ជីឈុតសៀវភៅ', callback_data: 'catalog_menu' },
        { text: '🏠 Menu ដើម', callback_data: 'menu_main' }
      ]);

      if (messageIdToEdit) {
        const edited = await this.editMessageText(chatId, messageIdToEdit, msg, {
          reply_markup: { inline_keyboard: inlineKeyboard },
          parse_mode: 'HTML'
        });
        if (edited) return;
      }

      await this.sendMessage(chatId, msg, {
        reply_markup: { inline_keyboard: inlineKeyboard },
        parse_mode: 'HTML'
      });
      return;
    }

    // If 'cat_all' was requested, list all books
    if (categoryKey === 'cat_all') {
      let msg = `📚 <b>កាតាឡុកសៀវភៅទាំង ២០ ក្បាល (ALL BOOKS)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;

      categories.forEach(cat => {
        const catProds = products.filter(p => p.id.startsWith(cat.prefix) || p.category.includes(cat.short));
        if (catProds.length > 0) {
          msg += `<b>${cat.name}</b>\n`;
          catProds.forEach((b, idx) => {
            const stock = db.getAvailableStockCount(b.id);
            const stockDot = stock > 0 ? '🟢' : '🔴';
            const isLast = idx === catProds.length - 1;
            msg += `${isLast ? '└' : '├'} 📄 <b>${b.name}</b> — <code>$${b.price.toFixed(2)}</code> ${stockDot}\n`;
          });
          msg += `\n`;
        }
      });

      msg += `👇 <i>ជ្រើសរើសឈុត ឬសៀវភៅខាងក្រោម៖</i>`;

      const inlineKeyboard: Array<Array<{ text: string; callback_data: string }>> = [
        [{ text: '👶 ១. ឈុតគ្រូមតេយ្យសិក្សា (5 មុខ)', callback_data: 'cat_pre' }],
        [{ text: '🎒 ២. ឈុតគ្រូបឋមសិក្សា (5 មុខ)', callback_data: 'cat_pri' }],
        [{ text: '🏫 ៣. ឈុតគ្រូអនុវិទ្យាល័យ (5 មុខ)', callback_data: 'cat_low' }],
        [{ text: '🏢 ៤. ឈុតគ្រូវិទ្យាល័យ (5 មុខ)', callback_data: 'cat_upp' }],
        [{ text: '🏠 Menu ដើម', callback_data: 'menu_main' }]
      ];

      if (messageIdToEdit) {
        const edited = await this.editMessageText(chatId, messageIdToEdit, msg, {
          reply_markup: { inline_keyboard: inlineKeyboard },
          parse_mode: 'HTML'
        });
        if (edited) return;
      }

      await this.sendMessage(chatId, msg, {
        reply_markup: { inline_keyboard: inlineKeyboard },
        parse_mode: 'HTML'
      });
      return;
    }

    // Main Catalog Menu: Overview of the 4 Teacher Sets & Formats
    let msg = `📚 <b>កាតាឡុកវិញ្ញាសា & សំណួរ QCM ត្រៀមប្រឡងគ្រូ</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `សូមជ្រើសរើសកម្រិត ឬឈុតសៀវភៅដែលលោកអ្នកចង់រៀនសូត្រ៖\n\n` +
      `┌ 👶 <b>១. ឈុតគ្រូមតេយ្យសិក្សា (Preschool QCM)</b> — 5 មុខ\n` +
      `├ 🎒 <b>២. ឈុតគ្រូបឋមសិក្សា (Primary School QCM)</b> — 5 មុខ\n` +
      `├ 🏫 <b>៣. ឈុតគ្រូអនុវិទ្យាល័យ (Lower Secondary QCM)</b> — 5 មុខ\n` +
      `└ 🏢 <b>៤. ឈុតគ្រូវិទ្យាល័យ (Upper Secondary QCM)</b> — 5 មុខ\n\n` +
      `💡 <b>ទម្រង់សៀវភៅ៖</b>\n` +
      `• 📄 <b>E-book (PDF)៖</b> ទាញយកឯកសារអានភ្លាមៗ 24/7 (គាំទ្រការផ្ញើ Slip ចូល Bot)\n` +
      `• 📖 <b>សៀវភៅក្រដាស (Hardcopy)៖</b> ដឹកជញ្ជូនរហ័សដល់ផ្ទះ & ផ្ញើតាម VET / J&T Express\n\n` +
      `👇 <i>សូមចុចលើប៊ូតុងឈុតសៀវភៅខាងក្រោម ដើម្បីជ្រើសរើសសៀវភៅ៖</i>`;

    const settings = db.getSettings();
    const supportUser = settings.supportUsername || 'kh_bookstore_support';

    const inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
      [{ text: '👶 ១. ឈុតគ្រូមតេយ្យសិក្សា (5 មុខ)', callback_data: 'cat_pre' }],
      [{ text: '🎒 ២. ឈុតគ្រូបឋមសិក្សា (5 មុខ)', callback_data: 'cat_pri' }],
      [{ text: '🏫 ៣. ឈុតគ្រូអនុវិទ្យាល័យ (5 មុខ)', callback_data: 'cat_low' }],
      [{ text: '🏢 ៤. ឈុតគ្រូវិទ្យាល័យ (5 មុខ)', callback_data: 'cat_upp' }],
      [
        { text: '📖 សៀវភៅក្រដាស (Hardcopy)', callback_data: 'cat_printed' },
        { text: '📄 សៀវភៅ PDF (E-Book)', callback_data: 'cat_pdf' }
      ],
      [{ text: '📚 មើលសៀវភៅទាំង ២០ ក្បាល', callback_data: 'cat_all' }],
      [{ text: '💬 ឆាតទៅកាន់ Admin Support', url: `https://t.me/${supportUser}` }]
    ];

    if (messageIdToEdit) {
      const edited = await this.editMessageText(chatId, messageIdToEdit, msg, {
        reply_markup: { inline_keyboard: inlineKeyboard },
        parse_mode: 'HTML'
      });
      if (edited) return;
    }

    await this.sendMessage(chatId, msg, {
      reply_markup: { inline_keyboard: inlineKeyboard },
      parse_mode: 'HTML'
    });
  }

  /**
   * Product Detail & Interactive Quantity Stepper
   */
  public static async sendProductDetail(chatId: number | string, productId: string, currentQty = 1, messageIdToEdit?: number) {
    const product = db.getProducts().find(p => p.id === productId);
    if (!product) {
      await this.sendMessage(chatId, '❌ រកមិនឃើញសៀវភៅនេះឡើយ។');
      return;
    }

    const availableStock = db.getAvailableStockCount(productId);
    const validQty = Math.max(1, Math.min(currentQty, Math.max(1, availableStock)));
    const pricing = calculateOrderPrice(product, validQty);

    const isPrinted = product.bookFormat === 'printed';
    const unitLabel = isPrinted ? 'ក្បាល' : 'ច្បាប់';
    const formatLabel = isPrinted ? '📖 សៀវភៅព្រីនរូបវន្ត (Printed Hardcopy)' : '📄 សៀវភៅអេឡិចត្រូនិក (PDF E-Book)';
    const formatIcon = isPrinted ? '📖' : '📄';

    let stockStatus = `🟢 នៅសល់ ${availableStock} ${unitLabel}`;
    if (availableStock === 0) stockStatus = `🔴 អស់ពីស្តុក`;
    else if (availableStock <= 3) stockStatus = `🟡 សល់តែ ${availableStock} ${unitLabel}`;

    const deliveryInfo = isPrinted
      ? '🚚 ដឹកជញ្ជូនដល់គេហដ្ឋាន (ភ្នំពេញ ១-២ ថ្ងៃ / ខេត្ត ២-៣ ថ្ងៃ)'
      : '⚡ ទាញយកឯកសារ PDF អានភ្លាមៗ 24/7 (Instant Download)';

    let text = `${formatIcon} <b>${product.name}</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `┌ 🖋️ <b>អ្នកនិពន្ធ/រៀបរៀង៖</b> <b>${product.author || 'ក្រុមការងារបណ្ណាគារ'}</b>\n`;
    text += `├ 📂 <b>ផ្នែកឯកសារ៖</b> <b>${product.category || 'ទូទៅ'}</b>\n`;
    text += `├ 🏷️ <b>ទម្រង់សៀវភៅ៖</b> <b>${formatLabel}</b>\n`;
    if (product.pages) {
      text += `├ 📑 <b>កម្រាស់សៀវភៅ៖</b> <b>${product.pages} ទំព័រ</b>\n`;
    }
    if (product.fileSize && !isPrinted) {
      text += `├ 💾 <b>ទំហំឯកសារ៖</b> <b>${product.fileSize}</b>\n`;
    }
    text += `├ 💰 <b>តម្លៃឯកតា៖</b> <code>$${product.price.toFixed(2)} USD</code>\n`;
    text += `├ 📦 <b>ស្ថានភាពស្តុក៖</b> <b>${stockStatus}</b>\n`;
    text += `└ 🚚 <b>ការទទួលសៀវភៅ៖</b> ${deliveryInfo}\n\n`;

    text += `📝 <b>ខ្លឹមសារសង្ខេប៖</b>\n${product.description}\n`;

    if (product.bulkPricingEnabled && product.tiers && product.tiers.length > 0) {
      text += `\n🏷️ <b>តារាងបញ្ចុះតម្លៃទិញច្រើន (Bulk Discounts):</b>\n`;
      for (const t of product.tiers) {
        const range = t.maxQty ? `${t.minQty} - ${t.maxQty}` : `ចាប់ពី ${t.minQty} ឡើងទៅ`;
        text += `• ទិញ ${range} ${unitLabel}៖ <code>$${t.pricePerUnit.toFixed(2)} / ${unitLabel}</code>\n`;
      }
    }

    text += `\n🛒 <b>ការបញ្ជាទិញបច្ចុប្បន្ន៖</b>\n`;
    text += `┌ 🔢 <b>បរិមាណជ្រើសរើស៖</b> <b>${validQty} ${unitLabel}</b>\n`;
    text += `└ 💵 <b>ទឹកប្រាក់សរុប៖</b> <code>$${pricing.totalAmount.toFixed(2)} USD</code>`;
    if (pricing.isDiscounted) {
      text += ` <i>(បានបញ្ចុះតម្លៃដុំ $${pricing.unitPrice.toFixed(2)}/${unitLabel})</i>`;
    }

    // 3-Row Inline Keyboard:
    // Row 1: [-] [🛒 ចំនួន៖ N] [+]
    // Row 2: [💳 បន្តទៅទូទាត់ ($XX.XX USD)]
    // Row 3: [🔙 មើលសៀវភៅផ្សេងទៀត] [🏠 Menu ដើម]
    const nextDec = Math.max(1, validQty - 1);
    const nextInc = availableStock > 0 ? Math.min(availableStock, validQty + 1) : validQty + 1;

    const settings = db.getSettings();
    const supportUser = settings.supportUsername || 'kh_bookstore_support';

    const inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
      [
        { text: '➖', callback_data: `qty_adj_${productId}_${nextDec}` },
        { text: `🛒 ចំនួន៖ ${validQty} ${unitLabel}`, callback_data: `qty_info_${validQty}` },
        { text: '➕', callback_data: `qty_adj_${productId}_${nextInc}` }
      ],
      [
        {
          text: availableStock >= validQty
            ? `💳 បន្តទៅទូទាត់ ($${pricing.totalAmount.toFixed(2)} USD)`
            : `❌ អស់ស្តុកមិនអាចទិញបាន`,
          callback_data: availableStock >= validQty
            ? `order_checkout_${productId}_${validQty}`
            : `qty_info_outofstock`
        }
      ],
      [
        { text: '💬 សាកសួរ Admin មុនទិញ', url: `https://t.me/${supportUser}` }
      ],
      [
        { text: '🔙 មើលសៀវភៅផ្សេងទៀត', callback_data: 'catalog_back' },
        { text: '🏠 Menu ដើម', callback_data: 'menu_main' }
      ]
    ];

    if (messageIdToEdit) {
      const edited = await this.editMessageText(chatId, messageIdToEdit, text, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML'
      });
      if (edited) return;
    }

    await this.sendMessage(chatId, text, {
      reply_markup: { inline_keyboard },
      parse_mode: 'HTML'
    });
  }

  /**
   * Interactive multi-step order flow for Printed Books (Hardcopy)
   */
  public static async startHardcopyCheckout(
    chatId: number | string,
    productId: string,
    quantity: number,
    username: string,
    firstName: string
  ) {
    const product = db.getProducts().find(p => p.id === productId);
    if (!product) return;

    const availableStock = db.getAvailableStockCount(productId);
    if (availableStock < quantity) {
      await this.sendMessage(
        chatId,
        `⚠️ <b>ស្តុកមិនគ្រប់គ្រាន់ទេ!</b>\n\nបច្ចុប្បន្ននៅសល់តែ <b>${availableStock}</b> ក្បាលប៉ុណ្ណោះ។`,
        { reply_markup: this.getMainReplyKeyboard(), parse_mode: 'HTML' }
      );
      return;
    }

    const pricing = calculateOrderPrice(product, quantity);
    const numericId = typeof chatId === 'number' ? chatId : parseInt(String(chatId), 10) || 10001;
    const customer = db.getCustomerByTelegramId(numericId);

    // Save initial state for step 1
    this.customerStates.set(String(chatId), {
      step: 'awaiting_shipping_name',
      data: {
        productId,
        quantity,
        username,
        firstName,
        totalAmount: pricing.totalAmount
      }
    });

    const promptText = `📦 <b>ការបញ្ជាទិញសៀវភៅក្រដាស (HARDCOPY ORDER)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `📚 <b>សៀវភៅ៖</b> <b>${product.name}</b>\n` +
      `🔢 <b>បរិមាណ៖</b> <b>${quantity} ក្បាល</b>\n` +
      `💵 <b>តម្លៃសរុប៖</b> <code>$${pricing.totalAmount.toFixed(2)} USD</code>\n\n` +
      `🚚 <b>ការដឹកជញ្ជូន៖</b> យើងខ្ញុំផ្ញើជូនតាមរយៈ <b>VET Express (វីរៈប៊ុនថាំ) / J&T Express</b> ឬអ្នកដឹកជញ្ជូនដល់គេហដ្ឋានក្នុងរាជធានីភ្នំពេញ។\n\n` +
      `📝 <b>ជំហានទី ១/៣៖</b> សូមវាយបញ្ចូល <b>ឈ្មោះពេញរបស់អ្នកទទួល</b> (ឧ. លោក សុខ ចិន្តា)៖`;

    const inline_keyboard: any[] = [];
    if (firstName && firstName !== 'User' && firstName !== 'Customer') {
      inline_keyboard.push([{ text: `👉 ប្រើឈ្មោះ "${firstName}"`, callback_data: `ship_name_self` }]);
    }
    inline_keyboard.push([{ text: '❌ បោះបង់ការទិញ', callback_data: 'ship_cancel' }]);

    await this.sendMessage(chatId, promptText, {
      reply_markup: { inline_keyboard },
      parse_mode: 'HTML'
    });
  }

  /**
   * Conversation step handler for multi-step prompts (Hardcopy delivery details)
   */
  public static async handleConversationStep(
    chatId: number | string,
    text: string,
    user: any,
    session: { step: string; data: any }
  ): Promise<boolean> {
    const raw = text.trim();
    if (raw === '/cancel' || raw === 'បោះបង់' || raw.toLowerCase() === 'cancel') {
      this.customerStates.delete(String(chatId));
      await this.sendMessage(chatId, '❌ ការបញ្ជាទិញត្រូវបានបោះបង់។', {
        reply_markup: this.getMainReplyKeyboard()
      });
      return true;
    }

    if (raw.startsWith('/start')) {
      this.customerStates.delete(String(chatId));
      return false; // let handleStart take over
    }

    // Step 1: awaiting_shipping_name
    if (session.step === 'awaiting_shipping_name') {
      session.data.shippingRecipient = raw;
      session.step = 'awaiting_shipping_phone';

      const numericId = typeof chatId === 'number' ? chatId : parseInt(String(chatId), 10) || 10001;
      const customer = db.getCustomerByTelegramId(numericId);

      const phonePrompt = `📞 <b>ជំហានទី ២/៣៖ លេខទូរស័ព្ទទំនាក់ទំនង</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>អ្នកទទួល៖</b> <b>${session.data.shippingRecipient}</b>\n\n` +
        `សូមផ្ញើ <b>លេខទូរស័ព្ទ</b> របស់អ្នកទទួល ដើម្បីឱ្យខាងដឹកជញ្ជូនទាក់ទងពេលទៅដល់ (ឧ. 012 345 678)៖`;

      const inline_keyboard: any[] = [];
      if (customer?.phone) {
        inline_keyboard.push([{ text: `👉 ប្រើលេខ "${customer.phone}"`, callback_data: `ship_phone_saved` }]);
      }
      inline_keyboard.push([{ text: '❌ បោះបង់', callback_data: 'ship_cancel' }]);

      await this.sendMessage(chatId, phonePrompt, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML'
      });
      return true;
    }

    // Step 2: awaiting_shipping_phone
    if (session.step === 'awaiting_shipping_phone') {
      session.data.shippingPhone = raw;
      session.step = 'awaiting_shipping_address';

      const addrPrompt = `📍 <b>ជំហានទី ៣/៣៖ អាសយដ្ឋាន & ក្រុមហ៊ុនដឹកជញ្ជូន</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>អ្នកទទួល៖</b> <b>${session.data.shippingRecipient}</b>\n` +
        `📞 <b>ទូរស័ព្ទ៖</b> <code>${session.data.shippingPhone}</code>\n\n` +
        `សូមបញ្ជាក់ទីតាំង និងសេវាដឹកជញ្ជូនដែលចង់បាន៖\n` +
        `• <b>ភ្នំពេញ៖</b> ដឹកដល់ផ្ទះ (ផ្ទះលេខ ផ្លូវ សង្កាត់ ខណ្ឌ)\n` +
        `• <b>តាមខេត្ត៖</b> ផ្ញើតាម <b>VET Express (វីរៈប៊ុនថាំ)</b> ឬ <b>J&T Express</b> (សូមបញ្ជាក់ឈ្មោះសាខា ឬស្រុក/ខេត្ត)\n\n` +
        `<i>👇 លោកអ្នកអាចជ្រើសរើសជម្រើសរហ័សខាងក្រោម ឬវាយបញ្ចូលអាសយដ្ឋានផ្ទាល់៖</i>`;

      const inline_keyboard = [
        [{ text: '🚚 ភ្នំពេញ (ដឹកជញ្ជូនដល់ផ្ទះ)', callback_data: 'ship_addr_pp' }],
        [{ text: '📦 VET Express វីរៈប៊ុនថាំ (តាមខេត្ត)', callback_data: 'ship_addr_vet' }],
        [{ text: '🚀 J&T Express (តាមខេត្ត)', callback_data: 'ship_addr_jnt' }],
        [{ text: '❌ បោះបង់', callback_data: 'ship_cancel' }]
      ];

      await this.sendMessage(chatId, addrPrompt, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML'
      });
      return true;
    }

    // Step 3: awaiting_shipping_address (custom typed address)
    if (session.step === 'awaiting_shipping_address') {
      const shippingAddress = raw;
      const data = session.data;
      this.customerStates.delete(String(chatId));

      await this.handleCheckout(
        chatId,
        data.productId,
        data.quantity,
        user.username || data.username,
        user.first_name || data.firstName,
        {
          shippingRecipient: data.shippingRecipient,
          shippingPhone: data.shippingPhone,
          shippingAddress
        }
      );
      return true;
    }

    return false;
  }

  /**
   * Process customer payment slip photo/file (ABA Pay / Wing / Bakong screenshot)
   */
  public static async handleIncomingPaymentSlip(
    chatId: number | string,
    fileIdOrUrl?: string,
    user?: any,
    caption?: string
  ) {
    const strChatId = String(chatId);
    const username = user?.username || '';
    const firstName = user?.first_name || 'Customer';

    // Find latest pending order for this customer
    const orders = db.getOrders();
    const pendingOrder = orders.find(o =>
      (o.telegramId === strChatId || (strChatId.startsWith('sim_') && o.telegramId.startsWith('sim_'))) &&
      o.status === 'pending'
    );

    if (!pendingOrder) {
      await this.sendMessage(
        chatId,
        `📸 <b>ទទួលបានរូបភាព!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `បច្ចុប្បន្នលោកអ្នកមិនមានវិក្កយបត្រកំពុងរង់ចាំទូទាត់នៅឡើយទេ។\n\n` +
        `👇 សូមចុច <b>[🛒 ទិញសៀវភៅ]</b> ដើម្បីជ្រើសរើសសៀវភៅ ឬចុច <b>[📞 ជំនួយ & ទំនាក់ទំនង]</b> ប្រសិនបើលោកអ្នកត្រូវការជំនួយពី Admin!`,
        {
          reply_markup: this.getMainReplyKeyboard(),
          parse_mode: 'HTML'
        }
      );
      return;
    }

    // Save slip on order
    const slipUrl = fileIdOrUrl || 'manual_slip_uploaded';
    db.updateOrder(pendingOrder.id, {
      paymentSlipUrl: slipUrl,
      adminNotes: caption ? `Slip note: ${caption}` : 'Customer uploaded payment slip'
    });

    const isPrinted = pendingOrder.bookFormat === 'printed';

    // Confirm to customer
    const confirmMsg = `📥 <b>ទទួលបានរូបភាពវិក្កយបត្របង់ប្រាក់ (PAYMENT SLIP)!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `┌ 🔖 <b>លេខវិក្កយបត្រ៖</b> <code>#${pendingOrder.id}</code>\n` +
      `├ 📚 <b>សៀវភៅ៖</b> <b>${pendingOrder.productName}</b>\n` +
      `├ 🏷️ <b>ប្រភេទ៖</b> ${isPrinted ? '📖 សៀវភៅក្រដាស (Hardcopy)' : '📄 សៀវភៅ PDF (E-Book)'}\n` +
      `├ 🔢 <b>បរិមាណ៖</b> <b>${pendingOrder.quantity} ${isPrinted ? 'ក្បាល' : 'ច្បាប់'}</b>\n` +
      `└ 💵 <b>ទឹកប្រាក់៖</b> <code>$${pendingOrder.totalAmount.toFixed(2)} USD</code>\n\n` +
      `⏳ ក្រុមការងារកំពុងត្រួតពិនិត្យផ្ទៀងផ្ទាត់។ នៅពេល Admin ចុច Approve (យល់ព្រម)៖\n` +
      (isPrinted
        ? `• ប្រព័ន្ធនឹងបញ្ជូនកញ្ចប់សៀវភៅទៅផ្នែកដឹកជញ្ជូន VET/J&T ភ្លាមៗ!\n`
        : `• ប្រព័ន្ធនឹង <b>ផ្ញើ File PDF ឬតំណភ្ជាប់ទាញយក</b> ជូនលោកអ្នកភ្លាមៗដោយស្វ័យប្រវត្តិ! ⚡\n`) +
      `\n💬 <i>ប្រសិនបើមានសំណួរ ឬត្រូវការជំនួយបន្ទាន់ សូមចុចប៊ូតុងខាងក្រោម៖</i>`;

    const settings = db.getSettings();
    const supportUser = settings.supportUsername || 'kh_bookstore_support';

    await this.sendMessage(chatId, confirmMsg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 ឆាតទៅកាន់ Admin Support', url: `https://t.me/${supportUser}` }],
          [{ text: '🔄 ពិនិត្យស្ថានភាពការទូទាត់', callback_data: `check_pay_${pendingOrder.id}` }]
        ]
      },
      parse_mode: 'HTML'
    });

    // Notify Admin Channel / Admin Telegram ID
    const adminTarget = settings.adminTelegramId || settings.channelId;
    const adminAlertText = `🔔 <b>វិក្កយបត្របង់ប្រាក់រង់ចាំការបញ្ជាក់ (SLIP PENDING APPROVAL)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `┌ 🔖 <b>លេខវិក្កយបត្រ៖</b> <code>#${pendingOrder.id}</code>\n` +
      `├ 📚 <b>សៀវភៅ៖</b> <b>${pendingOrder.productName}</b>\n` +
      `├ 🏷️ <b>ប្រភេទ៖</b> ${isPrinted ? '📖 សៀវភៅក្រដាស (Hardcopy)' : '📄 សៀវភៅ PDF (E-Book)'}\n` +
      `├ 🔢 <b>បរិមាណ៖</b> <b>${pendingOrder.quantity} ${isPrinted ? 'ក្បាល' : 'ច្បាប់'}</b>\n` +
      `├ 💵 <b>ទឹកប្រាក់៖</b> <code>$${pendingOrder.totalAmount.toFixed(2)} USD</code>\n` +
      `└ 👤 <b>អតិថិជន៖</b> @${pendingOrder.telegramUsername} (${pendingOrder.customerName})\n` +
      (isPrinted ? `\n🚚 <b>ព័ត៌មានដឹកជញ្ជូន៖</b>\n• អ្នកទទួល៖ ${pendingOrder.shippingRecipient}\n• ទូរស័ព្ទ៖ ${pendingOrder.shippingPhone}\n• ទីតាំង៖ ${pendingOrder.shippingAddress}\n` : '') +
      `\n👉 <i>សូមចុចប៊ូតុងខាងក្រោមដើម្បីអនុម័ត និងផ្ញើសៀវភៅជូនអតិថិជន៖</i>`;

    const adminKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ យល់ព្រម (Approve & Fulfill)', callback_data: `admin_approve_${pendingOrder.id}` },
          { text: '❌ បដិសេធ (Reject)', callback_data: `admin_reject_${pendingOrder.id}` }
        ]
      ]
    };

    if (adminTarget) {
      if (fileIdOrUrl && !fileIdOrUrl.startsWith('manual_')) {
        await this.sendPhotoFileId(adminTarget, fileIdOrUrl, adminAlertText, { reply_markup: adminKeyboard });
      } else {
        await this.sendMessage(adminTarget, adminAlertText, { reply_markup: adminKeyboard, parse_mode: 'HTML' });
      }
    } else {
      // Broadcast to simulator listeners
      this.notifySimulator({
        id: `sim_admin_alert_${Date.now()}`,
        sender: 'bot',
        text: adminAlertText,
        timestamp: new Date().toLocaleTimeString(),
        inlineKeyboard: adminKeyboard.inline_keyboard
      });
    }
  }

  /**
   * Checkout & Stock Reservation
   */
  public static async handleCheckout(
    chatId: number | string,
    productId: string,
    quantity: number,
    username: string,
    firstName: string,
    shippingInfo?: {
      shippingRecipient?: string;
      shippingPhone?: string;
      shippingAddress?: string;
    }
  ) {
    const product = db.getProducts().find(p => p.id === productId);
    if (!product) {
      await this.sendMessage(chatId, '❌ មិនមានទំនិញនេះក្នុងប្រព័ន្ធទេ។');
      return;
    }

    const availableCount = db.getAvailableStockCount(productId);
    if (availableCount < quantity) {
      await this.sendMessage(
        chatId,
        `⚠️ <b>ស្តុកមិនគ្រប់គ្រាន់ទេ!</b>\n\nបច្ចុប្បន្ននៅសល់តែ <b>${availableCount}</b> ប៉ុណ្ណោះ។ សូមកាត់បន្ថយចំនួន ឬរង់ចាំ Admin បន្ថែមស្តុកថ្មី។`,
        { reply_markup: this.getMainReplyKeyboard(), parse_mode: 'HTML' }
      );
      return;
    }

    const isPrinted = product.bookFormat === 'printed';

    // If it's a printed book and user hasn't provided shipping details yet, initiate address prompt flow!
    if (isPrinted && !shippingInfo) {
      await this.startHardcopyCheckout(chatId, productId, quantity, username, firstName);
      return;
    }

    const settings = db.getSettings();
    const expiryMinutes = settings.qrExpiryMinutes || 5;
    const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    // Atomic stock reservation
    const reservedItems = db.reserveStock(productId, quantity, orderId, expiryMinutes);
    if (!reservedItems) {
      await this.sendMessage(chatId, '⚠️ ការកក់ស្តុកបរាជ័យ ដោយសារមានអតិថិជនផ្សេងកំពុងទិញក្នុងពេលដំណាលគ្នា។ សូមព្យាយាមម្តងទៀត!');
      return;
    }

    // Customer info & referral check
    const numericId = typeof chatId === 'number' ? chatId : parseInt(String(chatId), 10) || 10001;
    const customer = db.upsertCustomer(numericId, username, firstName);
    const pricing = calculateOrderPrice(product, quantity);
    const unitLabel = isPrinted ? 'ក្បាល' : 'ច្បាប់';

    // If shipping info was provided, update customer profile
    if (shippingInfo) {
      if (shippingInfo.shippingPhone && !customer.phone) {
        customer.phone = shippingInfo.shippingPhone;
      }
      if (shippingInfo.shippingAddress && !customer.defaultShippingAddress) {
        customer.defaultShippingAddress = shippingInfo.shippingAddress;
      }
      db.saveData();
    }

    // Call CutLuy payment generation
    const payment = await CutLuyService.createPayment(orderId, pricing.totalAmount);

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    const newOrder: Order = {
      id: orderId,
      referenceId: orderId,
      telegramId: String(chatId),
      telegramUsername: username || 'User',
      customerName: firstName || 'Customer',
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: pricing.unitPrice,
      subtotal: pricing.totalAmount,
      discountAmount: 0,
      couponCode: null,
      totalAmount: pricing.totalAmount,
      status: 'pending',
      paymentProvider: 'cutluy',
      cutluyPaymentId: payment.paymentId,
      checkoutUrl: payment.checkoutUrl || null,
      qrString: payment.qrString,
      qrImageDataUrl: payment.qrDataUrl,
      expiresAt,
      deliveredItems: [],
      referralTelegramId: customer.referredBy || null,
      commissionEarned: customer.referredBy ? (settings.referralCommissionPerAccount * quantity) : 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      bookFormat: product.bookFormat || 'pdf',
      pdfDownloadUrl: product.pdfDownloadUrl,
      shippingRecipient: isPrinted
        ? (shippingInfo?.shippingRecipient || (customer.firstName + (customer.lastName ? ` ${customer.lastName}` : '')))
        : undefined,
      shippingPhone: isPrinted
        ? (shippingInfo?.shippingPhone || customer.phone || '012 889 900')
        : undefined,
      shippingAddress: isPrinted
        ? (shippingInfo?.shippingAddress || customer.defaultShippingAddress || 'រាជធានីភ្នំពេញ (ដឹកជញ្ជូនដល់ផ្ទះ)')
        : undefined,
      shippingStatus: isPrinted ? 'pending' : undefined
    };

    db.addOrder(newOrder);

    // Prepare White-Label Caption
    let caption = `🇰🇭 <b>វិក្កយបត្របង់ប្រាក់ KHQR ស្វ័យប្រវត្ត (OFFICIAL INVOICE)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `┌ 🔖 <b>លេខវិក្កយបត្រ៖</b> <code>#${orderId}</code>\n` +
      `├ 📚 <b>សៀវភៅ៖</b> <b>${product.name}</b>\n` +
      `├ 🖋️ <b>អ្នកនិពន្ធ៖</b> ${product.author || 'បណ្ណាគារ'}\n` +
      `├ 🏷️ <b>ទម្រង់៖</b> ${isPrinted ? '📖 សៀវភៅព្រីន Hardcopy' : '📄 សៀវភៅអេឡិចត្រូនិក PDF'}\n` +
      `├ 🔢 <b>បរិមាណ៖</b> <b>${quantity} ${unitLabel}</b>\n` +
      `├ 💵 <b>ទឹកប្រាក់ត្រូវទូទាត់៖</b> <code>$${pricing.totalAmount.toFixed(2)} USD</code>\n`;

    if (isPrinted && newOrder.shippingRecipient) {
      caption += `├ 👤 <b>អ្នកទទួល៖</b> <b>${newOrder.shippingRecipient}</b>\n` +
        `├ 📞 <b>លេខទូរស័ព្ទ៖</b> <code>${newOrder.shippingPhone}</code>\n` +
        `├ 📍 <b>អាសយដ្ឋានដឹក៖</b> <b>${newOrder.shippingAddress}</b>\n`;
    }

    caption += `└ ⏱️ <b>សុពលភាព KHQR៖</b> <b>${expiryMinutes} នាទី</b>\n\n` +
      `📌 <b>ជម្រើសនៃការទូទាត់ប្រាក់៖</b>\n` +
      `1. <b>ស្កេន KHQR</b> ខាងលើជាមួយ App ធនាគារ (Bakong, ABA, Wing, ACLEDA...) — ប្រព័ន្ធពិនិត្យស្វ័យប្រវត្តិ 24/7!\n` +
      `2. <b>ឬផ្ញើរូបភាពវិក្កយបត្របង់ប្រាក់ (Payment Slip)</b> ចូលក្នុង Chat នេះ ដើម្បីឱ្យ Admin បញ្ជាក់ភ្លាមៗ! ⚡\n\n` +
      (isPrinted
        ? `🚚 <b>ការដឹកជញ្ជូន៖</b> ក្រុមការងារនឹងវេចខ្ចប់ និងបញ្ជូនតាម <b>${newOrder.shippingAddress}</b> ជូនលោកអ្នក!`
        : `⚡ <b>ឯកសារ PDF៖</b> ប្រព័ន្ធនឹងផ្ញើតំណភ្ជាប់ទាញយក PDF ជូនភ្លាមៗដោយស្វ័យប្រវត្តិនឹងពេលទូទាត់ជោគជ័យ!`);

    const supportUser = settings.supportUsername || 'kh_bookstore_support';
    const inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
      [
        { text: '🔄 ពិនិត្យការទូទាត់ (Check Payment)', callback_data: `check_pay_${orderId}` }
      ],
      [
        { text: '💬 ជំនួយ Admin', url: `https://t.me/${supportUser}` },
        { text: '❌ បោះបង់ការទិញ (Cancel)', callback_data: `cancel_order_${orderId}` }
      ]
    ];

    if (payment.qrBuffer) {
      await this.sendPhoto(chatId, payment.qrBuffer, caption, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML',
        qrDataUrl: payment.qrDataUrl
      });
    } else {
      await this.sendMessage(chatId, caption, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML'
      });
    }
  }

  /**
   * Cancel Order Handler
   */
  public static async handleCancelOrder(chatId: number | string, orderId: string) {
    const success = db.cancelOrder(orderId);
    if (success) {
      await this.sendMessage(
        chatId,
        `❌ ការបញ្ជាទិញ <code>#${orderId}</code> ត្រូវបានបោះបង់ដោយជោគជ័យ។ ស្តុកត្រូវបានដោះលែងវិញ។`,
        { reply_markup: this.getMainReplyKeyboard(), parse_mode: 'HTML' }
      );
    } else {
      await this.sendMessage(chatId, `មិនអាចបោះបង់ការបញ្ជាទិញ #${orderId} បានទេ (ប្រហែលជាបានបញ្ចប់ ឬផុតកំណត់ហើយ)។`);
    }
  }

  /**
   * Automated Delivery & Fulfillment Pipeline
   */
  public static async fulfillOrder(orderId: string): Promise<boolean> {
    const order = db.getOrders().find(o => o.id === orderId);
    if (!order || order.status === 'completed') {
      return false;
    }

    const settings = db.getSettings();
    const product = db.getProducts().find(p => p.id === order.productId);
    const chatId = order.telegramId;
    const isPrinted = order.bookFormat === 'printed' || product?.bookFormat === 'printed';

    // STEP 1: Immediate Payment Success Notification
    const step1Msg = `⏳ <b>ទទួលបានការទូទាត់ជោគជ័យ! ($${order.totalAmount.toFixed(2)} USD)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `ប្រព័ន្ធកំពុងរៀបចំ និងត្រួតពិនិត្យសៀវភៅជូនលោកអ្នក សូមរង់ចាំបន្តិច... ⚡`;

    await this.sendMessage(chatId, step1Msg, { parse_mode: 'HTML' });

    // STEP 2: Intentional realistic 1.5s delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // STEP 3: Race condition protection - Check reserved stock
    let targetStock = db.getStock().filter(s => s.orderId === orderId && s.status === 'reserved');

    // If reserved stock is missing or insufficient, try to grab available stock
    if (targetStock.length < order.quantity) {
      const needed = order.quantity - targetStock.length;
      const additional = db.getStock().filter(s => s.productId === order.productId && s.status === 'available').slice(0, needed);
      targetStock = [...targetStock, ...additional];
    }

    // If stock is completely depleted
    if (targetStock.length < order.quantity) {
      order.status = 'stock_depleted_refund_needed';
      order.errorMessage = 'Stock depleted during fulfillment';
      db.saveData();

      const policyMsg = settings.stockDepletedPolicyMessage || 'សូមអភ័យទោស! ស្តុកសៀវភៅត្រូវបានលក់អស់ក្នុងពេលដំណាលគ្នា។ សូមទាក់ទង Admin ដើម្បីទទួលបានការបញ្ចូលស្តុក ឬសងប្រាក់វិញភ្លាមៗ។';
      await this.sendMessage(
        chatId,
        `⚠️ <b>ជូនដំណឹងស្តីពីស្ថានភាពស្តុក៖</b>\n━━━━━━━━━━━━━━━━━━━━\n${policyMsg}\n\n👤 Admin: @${settings.supportUsername || 'kh_bookstore_support'}`,
        { reply_markup: this.getMainReplyKeyboard(), parse_mode: 'HTML' }
      );

      // Alert Admin Channel if configured
      if (settings.channelId) {
        await this.sendMessage(
          settings.channelId,
          `🚨 <b>ALERT: Book Stock Depleted Refund Needed!</b>\nOrder: #${order.id}\nBook: ${order.productName}\nCustomer: @${order.telegramUsername} (${order.telegramId})\nAmount: $${order.totalAmount}`
        );
      }
      return false;
    }

    // STEP 4: Success - Mark stock as sold & deliver
    const deliveredItems: string[] = [];
    const nowIso = new Date().toISOString();

    for (const item of targetStock.slice(0, order.quantity)) {
      item.status = 'sold';
      item.soldAt = nowIso;
      item.orderId = orderId;
      deliveredItems.push(item.content);
    }

    order.status = 'completed';
    order.completedAt = nowIso;
    order.deliveredItems = deliveredItems;
    if (isPrinted && !order.shippingStatus) {
      order.shippingStatus = 'preparing';
    }

    // Update customer stats
    const numericId = parseInt(order.telegramId, 10);
    const customer = db.getCustomerByTelegramId(numericId);
    if (customer) {
      customer.totalOrders += 1;
      customer.totalSpent = Number((customer.totalSpent + order.totalAmount).toFixed(2));
    }

    // Handle Referral Commission
    if (order.referralTelegramId && settings.referralEnabled) {
      const referrerNumericId = parseInt(order.referralTelegramId, 10);
      const commission = settings.referralCommissionPerAccount * order.quantity;
      order.commissionEarned = commission;
      const referrer = db.updateCustomerBalance(referrerNumericId, commission);

      if (referrer) {
        // Send alert to referrer
        const refAlert = `🎉 <b>អបអរសាទរ! លោកអ្នកទទួលបានកម្រៃជើងសារថ្មី!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
          `• ពីមិត្តភក្តិ៖ <b>@${order.telegramUsername}</b>\n` +
          `• សៀវភៅ៖ <b>${order.productName}</b> (x${order.quantity})\n` +
          `• កម្រៃជើងសារទទួលបាន៖ <code>+$${commission.toFixed(2)} USD</code>\n` +
          `• សមតុល្យសរុបបច្ចុប្បន្ន៖ <code>$${referrer.walletBalance.toFixed(2)} USD</code> 💰`;
        await this.sendMessage(order.referralTelegramId, refAlert, { parse_mode: 'HTML' });
      }
    }

    db.saveData();

    // Prepare Delivery Message
    let deliveryMsg = '';
    let deliveryInlineKeyboard: any = undefined;

    if (isPrinted) {
      deliveryMsg = `🎉 <b>ការបញ្ជាទិញសៀវភៅព្រីនជោគជ័យ! (#${order.id})</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `┌ 🔖 <b>លេខវិក្កយបត្រ៖</b> <code>#${order.id}</code>\n` +
        `├ 📚 <b>សៀវភៅ៖</b> <b>${order.productName}</b>\n` +
        (product?.author ? `├ 🖋️ <b>អ្នកនិពន្ធ៖</b> ${product.author}\n` : '') +
        `├ 🔢 <b>បរិមាណ៖</b> <b>${order.quantity} ក្បាល</b>\n` +
        `└ 💵 <b>ទឹកប្រាក់ទូទាត់៖</b> <code>$${order.totalAmount.toFixed(2)} USD</code>\n\n` +
        `📦 <b>លេខកូដក្បាលសៀវភៅ (Inventory SKU / Barcode):</b>\n`;
      deliveredItems.forEach((sku, idx) => {
        const isLastItem = idx === deliveredItems.length - 1;
        deliveryMsg += `${isLastItem ? '└' : '├'} 🏷️ <code>${sku}</code>\n`;
      });
      deliveryMsg += `\n🚚 <b>ព័ត៌មានដឹកជញ្ជូនដែលបានកត់ត្រា៖</b>\n` +
        `┌ 👤 <b>អ្នកទទួល៖</b> <b>${order.shippingRecipient || order.customerName || order.telegramUsername}</b>\n` +
        `├ 📞 <b>លេខទូរស័ព្ទ៖</b> <code>${order.shippingPhone || 'មិនទាន់បញ្ជាក់'}</code>\n` +
        `├ 📍 <b>អាសយដ្ឋាន/ក្រុមហ៊ុនដឹក៖</b> ${order.shippingAddress || 'រាជធានីភ្នំពេញ'}\n` +
        `├ 📦 <b>ស្ថានភាព៖</b> កំពុងរៀបចំវេចខ្ចប់ (Preparing)\n` +
        `└ ⏰ <b>រយៈពេល៖</b> រាជធានីភ្នំពេញ (1-2 ថ្ងៃ) | បណ្តាខេត្ត (2-3 ថ្ងៃ តាម VET / J&T Express)\n\n` +
        `<i>* លោកអ្នកនឹងទទួលបាន Tracking Code តាមរយៈ Bot នេះ នៅពេលកញ្ចប់សៀវភៅត្រូវបានប្រគល់ជូនអ្នកដឹក។</i>\n`;
    } else {
      deliveryMsg = `🎉 <b>ការបញ្ជាទិញសៀវភៅ PDF ជោគជ័យ! (#${order.id})</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `┌ 🔖 <b>លេខវិក្កយបត្រ៖</b> <code>#${order.id}</code>\n` +
        `├ 📚 <b>សៀវភៅ៖</b> <b>${order.productName}</b>\n` +
        (product?.author ? `├ 🖋️ <b>អ្នកនិពន្ធ៖</b> ${product.author}\n` : '') +
        `├ 🔢 <b>បរិមាណ៖</b> <b>${order.quantity} ច្បាប់</b>\n` +
        `└ 💵 <b>ទឹកប្រាក់ទូទាត់៖</b> <code>$${order.totalAmount.toFixed(2)} USD</code>\n\n` +
        `📥 <b>តំណភ្ជាប់ទាញយកសៀវភៅ PDF (ចុចដើម្បីបើក ឬ Save):</b>\n`;
      deliveredItems.forEach((link, idx) => {
        const isLastItem = idx === deliveredItems.length - 1;
        deliveryMsg += `${isLastItem ? '└' : '├'} 📄 <code>${link}</code>\n`;
      });
      deliveryMsg += `\n📖 <b>ការណែនាំអំពីការអាន & រក្សាទុក៖</b>\n` +
        `• លោកអ្នកអាចបើកអានផ្ទាល់លើទូរស័ព្ទ iPad កុំព្យូទ័រ ឬ Kindle\n` +
        `• រក្សាទុកក្នុង Google Drive ឬ Telegram Saved Messages ដើម្បីអានពេលគ្មាន Internet\n`;

      const firstLink = deliveredItems[0];
      if (firstLink && firstLink.startsWith('http')) {
        deliveryInlineKeyboard = {
          inline_keyboard: [
            [
              { text: '📥 បើកទាញយកសៀវភៅ PDF ឥឡូវនេះ', url: firstLink }
            ],
            [
              { text: '💬 សាកសួរ Admin បន្ថែម', url: `https://t.me/${settings.supportUsername || 'kh_bookstore_support'}` }
            ]
          ]
        };
      }
    }

    if (product?.instructions) {
      deliveryMsg += `\n💡 <b>ការណែនាំបន្ថែម៖</b>\n${product.instructions}\n`;
    }

    if (settings.postPurchaseInstructions) {
      deliveryMsg += `\n${settings.postPurchaseInstructions}\n`;
    }

    deliveryMsg += `\n❤️ <i>សូមអរគុណចំពោះការគាំទ្រការអាន! លោកអ្នកអាចពិនិត្យប្រវត្តិទិញវិញនៅពេលណាក៏បានតាមរយៈប៊ូតុង [📜 ប្រវត្តិទិញ]។</i>`;

    await this.sendMessage(chatId, deliveryMsg, {
      reply_markup: deliveryInlineKeyboard || this.getMainReplyKeyboard(),
      parse_mode: 'HTML'
    });

    // Alert Admin Channel or Admin Telegram with Logistics Card
    const adminChatTarget = settings.channelId || settings.adminTelegramId;
    if (adminChatTarget) {
      if (isPrinted) {
        await this.sendMessage(
          adminChatTarget,
          `📦 <b>កញ្ចប់សៀវភៅត្រូវរៀបចំផ្ញើ (HARDCOPY DISPATCH ORDER)!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
          `┌ 🔖 <b>វិក្កយបត្រ៖</b> <code>#${order.id}</code>\n` +
          `├ 📚 <b>សៀវភៅ៖</b> <b>${order.productName}</b> (x${order.quantity} ក្បាល)\n` +
          `├ 👤 <b>អ្នកទទួល៖</b> <b>${order.shippingRecipient || order.customerName || order.telegramUsername}</b>\n` +
          `├ 📞 <b>លេខទូរស័ព្ទ៖</b> <code>${order.shippingPhone || 'មិនទាន់បញ្ជាក់'}</code>\n` +
          `├ 📍 <b>អាសយដ្ឋាន/ក្រុមហ៊ុនដឹក៖</b> ${order.shippingAddress || 'រាជធានីភ្នំពេញ'}\n` +
          `├ 💵 <b>ទឹកប្រាក់បានបង់៖</b> <code>$${order.totalAmount.toFixed(2)} USD</code>\n` +
          `├ 🏷️ <b>Telegram អតិថិជន៖</b> @${order.telegramUsername} (ID: <code>${order.telegramId}</code>)\n` +
          `└ 📦 <b>SKU សៀវភៅ៖</b> ${deliveredItems.join(', ')}\n\n` +
          `🚚 <i>សូមរៀបចំវេចខ្ចប់ និងផ្ញើតាម VET Express / J&T Express / សេវាដឹកភ្នំពេញ ជូនអតិថិជន!</i>`,
          { parse_mode: 'HTML' }
        );
      } else {
        await this.sendMessage(
          adminChatTarget,
          `🛒 <b>ការលក់សៀវភៅ PDF ជោគជ័យថ្មី (New PDF Order)!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
          `┌ 🔖 <b>វិក្កយបត្រ៖</b> <code>#${order.id}</code>\n` +
          `├ 📄 <b>សៀវភៅ៖</b> <b>${order.productName}</b> (x${order.quantity} ច្បាប់)\n` +
          `├ 💵 <b>ទឹកប្រាក់៖</b> <code>$${order.totalAmount.toFixed(2)} USD</code>\n` +
          `└ 👤 <b>អតិថិជន៖</b> @${order.telegramUsername} (ID: <code>${order.telegramId}</code>)\n` +
          `⚡ <i>ប្រព័ន្ធបានផ្ញើតំណភ្ជាប់ PDF ជូនអតិថិជនរួចរាល់ដោយស្វ័យប្រវត្តិ!</i>`,
          { parse_mode: 'HTML' }
        );
      }
    }

    return true;
  }

  /**
   * Check Payment Status Handler (Manual check triggered by user button)
   */
  public static async handleCheckPayment(chatId: number | string, orderId: string, callbackQueryId?: string) {
    const order = db.getOrders().find(o => o.id === orderId);
    if (!order) {
      if (callbackQueryId) await this.answerCallbackQuery(callbackQueryId, 'រកមិនឃើញការបញ្ជាទិញនេះទេ', true);
      return;
    }

    if (order.status === 'completed') {
      if (callbackQueryId) await this.answerCallbackQuery(callbackQueryId, 'ការទូទាត់ត្រូវបានបញ្ជាក់រួចរាល់ហើយ!', true);
      return;
    }

    if (order.status === 'expired') {
      if (callbackQueryId) await this.answerCallbackQuery(callbackQueryId, 'វិក្កយបត្រនេះបានផុតកំណត់ហើយ', true);
      return;
    }

    // Check with CutLuy
    if (order.cutluyPaymentId) {
      const statusRes = await CutLuyService.getPaymentStatus(order.cutluyPaymentId);
      if (statusRes.status === 'paid' || statusRes.status === 'approved') {
        if (callbackQueryId) await this.answerCallbackQuery(callbackQueryId, 'ទទួលបានការទូទាត់ជោគជ័យ!');
        await this.fulfillOrder(order.id);
        return;
      }
    }

    if (callbackQueryId) {
      await this.answerCallbackQuery(callbackQueryId, '⏳ ប្រព័ន្ធមិនទាន់ទទួលបានការទូទាត់នៅឡើយទេ។ សូមរង់ចាំប្រហែល 5-10 វិនាទី រួចចុចម្តងទៀត។', true);
    } else {
      await this.sendMessage(chatId, '⏳ ប្រព័ន្ធមិនទាន់ទទួលបានការផ្ទេរប្រាក់នៅឡើយទេ។ សូមពិនិត្យមើល App ធនាគាររបស់អ្នក រួចចុចពិនិត្យម្តងទៀត។');
    }
  }

  /**
   * Callback Query Router
   */
  public static async handleCallbackQuery(query: any) {
    const data: string = query.data || '';
    const chatId = query.message?.chat?.id || query.from?.id;
    const messageId = query.message?.message_id;
    const username = query.from?.username || '';
    const firstName = query.from?.first_name || 'User';

    if (!data) return;

    // Acknowledge callback immediately to clear loading state
    await this.answerCallbackQuery(query.id);

    // 1. Quantity Adjust Stepper: qty_adj_<productId>_<newQty>
    if (data.startsWith('qty_adj_')) {
      const parsed = parseProductAndQty(data, 'qty_adj_');
      if (parsed) {
        await this.sendProductDetail(chatId, parsed.productId, parsed.qty, messageId);
      }
      return;
    }

    // 2. Quantity Info Button Click: qty_info_<currentQty>
    if (data.startsWith('qty_info_')) {
      const qtyStr = data.replace('qty_info_', '');
      if (qtyStr === 'outofstock') {
        await this.answerCallbackQuery(query.id, 'សៀវភៅនេះអស់ពីស្តុកហើយ!', true);
      } else {
        await this.answerCallbackQuery(query.id, `ចំនួនបច្ចុប្បន្ន៖ ${qtyStr} ក្បាល/ច្បាប់`);
      }
      return;
    }

    // 3. Product View: prod_view_<productId>
    if (data.startsWith('prod_view_')) {
      const productId = data.replace('prod_view_', '');
      await this.sendProductDetail(chatId, productId, 1);
      return;
    }

    // 4. Order Checkout: order_checkout_<productId>_<currentQty>
    if (data.startsWith('order_checkout_')) {
      const parsed = parseProductAndQty(data, 'order_checkout_');
      if (parsed) {
        await this.handleCheckout(chatId, parsed.productId, parsed.qty, username, firstName);
      }
      return;
    }

    // 5. Check Payment: check_pay_<orderId>
    if (data.startsWith('check_pay_')) {
      const orderId = data.replace('check_pay_', '');
      await this.handleCheckPayment(chatId, orderId, query.id);
      return;
    }

    // 6. Cancel Order: cancel_order_<orderId>
    if (data.startsWith('cancel_order_')) {
      const orderId = data.replace('cancel_order_', '');
      await this.handleCancelOrder(chatId, orderId);
      return;
    }

    // 7. Category and Navigation callbacks
    if (data.startsWith('cat_')) {
      await this.sendProductCatalog(chatId, data, messageId);
      return;
    }

    if (data === 'catalog_menu' || data === 'catalog_back') {
      await this.sendProductCatalog(chatId, undefined, messageId);
      return;
    }

    // 8. Admin Payment Slip Approval / Rejection
    if (data.startsWith('admin_approve_')) {
      const orderId = data.replace('admin_approve_', '');
      const order = db.getOrders().find(o => o.id === orderId);
      if (!order) {
        await this.answerCallbackQuery(query.id, 'រកមិនឃើញការបញ្ជាទិញនេះទេ', true);
        return;
      }
      if (order.status === 'completed') {
        await this.answerCallbackQuery(query.id, 'ការបញ្ជាទិញនេះត្រូវបាន Approve រួចហើយ!', true);
        return;
      }
      const success = await this.fulfillOrder(orderId);
      if (success) {
        await this.sendMessage(
          chatId,
          `✅ <b>Admin បាន Approve ការបញ្ជាទិញ #${orderId} ជោគជ័យ!</b>\nប្រព័ន្ធបានបញ្ជូនសៀវភៅទៅកាន់អតិថិជន @${order.telegramUsername} (${order.telegramId}) រួចរាល់ហើយ។`,
          { parse_mode: 'HTML' }
        );
      }
      return;
    }

    if (data.startsWith('admin_reject_')) {
      const orderId = data.replace('admin_reject_', '');
      const order = db.getOrders().find(o => o.id === orderId);
      if (order && order.status === 'pending') {
        order.status = 'rejected';
        order.errorMessage = 'Admin rejected payment slip';
        db.saveData();
        await this.sendMessage(
          order.telegramId,
          `❌ <b>វិក្កយបត្រ #${orderId} មិនត្រឹមត្រូវ</b>\n━━━━━━━━━━━━━━━━━━━━\nAdmin បានត្រួតពិនិត្យ Slip បង់ប្រាក់ ប៉ុន្តែមិនអាចផ្ទៀងផ្ទាត់បានទេ។ សូមទាក់ទងមក Admin ឬពិនិត្យការផ្ទេរប្រាក់ឡើងវិញ។\n\n👤 Admin: @${db.getSettings().supportUsername || 'kh_bookstore_support'}`,
          { reply_markup: this.getMainReplyKeyboard(), parse_mode: 'HTML' }
        );
        await this.sendMessage(chatId, `⚠️ បានបដិសេធ (Reject) ការបញ្ជាទិញ #${orderId}។`);
      }
      return;
    }

    // 9. Interactive Shipping Selection Callbacks
    if (data === 'ship_name_self') {
      const session = this.customerStates.get(String(chatId));
      if (session && session.step === 'awaiting_shipping_name') {
        await this.handleConversationStep(chatId, firstName, { id: typeof chatId === 'number' ? chatId : 0, username, first_name: firstName }, session);
      }
      return;
    }

    if (data === 'ship_phone_saved') {
      const session = this.customerStates.get(String(chatId));
      const cust = db.getCustomerByTelegramId(typeof chatId === 'number' ? chatId : parseInt(String(chatId), 10));
      const savedPhone = cust?.phoneNumber || cust?.phone;
      if (session && session.step === 'awaiting_shipping_phone' && savedPhone) {
        await this.handleConversationStep(chatId, savedPhone, { id: typeof chatId === 'number' ? chatId : 0, username, first_name: firstName }, session);
      }
      return;
    }

    if (data === 'ship_addr_pp') {
      const session = this.customerStates.get(String(chatId));
      if (session && session.step === 'awaiting_shipping_address') {
        await this.handleConversationStep(chatId, 'ដឹកជញ្ជូនរហ័ស ក្នុងរាជធានីភ្នំពេញ (Phnom Penh Express)', { id: typeof chatId === 'number' ? chatId : 0, username, first_name: firstName }, session);
      }
      return;
    }

    if (data === 'ship_addr_vet') {
      const session = this.customerStates.get(String(chatId));
      if (session && session.step === 'awaiting_shipping_address') {
        await this.handleConversationStep(chatId, 'ផ្ញើតាមក្រុមហ៊ុន វីរៈប៊ុនថាំ (VET Express)', { id: typeof chatId === 'number' ? chatId : 0, username, first_name: firstName }, session);
      }
      return;
    }

    if (data === 'ship_addr_jnt') {
      const session = this.customerStates.get(String(chatId));
      if (session && session.step === 'awaiting_shipping_address') {
        await this.handleConversationStep(chatId, 'ផ្ញើតាមក្រុមហ៊ុន J&T Express', { id: typeof chatId === 'number' ? chatId : 0, username, first_name: firstName }, session);
      }
      return;
    }

    if (data === 'ship_cancel') {
      this.customerStates.delete(String(chatId));
      await this.sendMessage(chatId, '❌ បានបោះបង់ដំណើរការបំពេញព័ត៌មានដឹកជញ្ជូន។', {
        reply_markup: this.getMainReplyKeyboard()
      });
      return;
    }

    // 10. Quick Actions & Navigation
    if (data === 'support_chat') {
      await this.sendSupport(chatId);
      return;
    }

    if (data === 'stock_check') {
      await this.sendLiveStock(chatId);
      return;
    }

    if (data === 'menu_main') {
      await this.handleStart(chatId, username, firstName);
      return;
    }
  }

  /**
   * Text Message Router with Strict Precedence
   */
  public static async handleTextMessage(
    chatId: number | string,
    text: string,
    user: { id: number; username?: string; first_name?: string; last_name?: string }
  ) {
    const rawText = text.trim();
    const username = user.username || '';
    const firstName = user.first_name || 'User';

    // Auto-register / update customer record
    const numericChatId = typeof chatId === 'number' ? chatId : parseInt(String(chatId), 10);
    if (!isNaN(numericChatId) && numericChatId > 0) {
      try {
        db.upsertCustomer(numericChatId, username, firstName, user.last_name);
      } catch {
        // ignore
      }
    }

    // 0. Active Conversation Step (Hardcopy interactive shipping details)
    const activeSession = this.customerStates.get(String(chatId));
    if (activeSession) {
      if (rawText.toLowerCase() === '/cancel' || rawText.includes('បោះបង់') || rawText.toLowerCase() === 'cancel') {
        this.customerStates.delete(String(chatId));
        await this.sendMessage(chatId, '❌ បានបោះបង់ដំណើរការបំពេញព័ត៌មានដឹកជញ្ជូន។', {
          reply_markup: this.getMainReplyKeyboard()
        });
        return;
      }
      if (rawText.startsWith('/start')) {
        this.customerStates.delete(String(chatId));
      } else {
        const handled = await this.handleConversationStep(chatId, rawText, user, activeSession);
        if (handled) return;
      }
    }

    // 1. /start command
    if (rawText.startsWith('/start')) {
      const parts = rawText.split(' ');
      const payload = parts.length > 1 ? parts[1] : undefined;
      await this.handleStart(chatId, username, firstName, user.last_name, payload);
      return;
    }

    // 2. Order History (Checked before 'ទិញ' so that "📜 ប្រវត្តិទិញ" is not triggered as Buy!)
    if (rawText.includes('ប្រវត្តិ') || rawText.toLowerCase().includes('order') || rawText.toLowerCase().includes('history')) {
      await this.sendCustomerOrders(chatId);
      return;
    }

    // 3. Stock Check
    if (rawText.includes('ស្តុក') || rawText.toLowerCase().includes('stock')) {
      await this.sendLiveStock(chatId);
      return;
    }

    // 4. Support / Help / Contact (ប៊ូតុងជំនួយ & ទំនាក់ទំនង)
    if (
      rawText.includes('ជំនួយ') ||
      rawText.includes('ទំនាក់ទំនង') ||
      rawText.toLowerCase().includes('support') ||
      rawText.toLowerCase().includes('help') ||
      rawText.toLowerCase().includes('contact')
    ) {
      await this.sendSupport(chatId);
      return;
    }

    // 5. Referral
    if (rawText.includes('ណែនាំ') || rawText.toLowerCase().includes('referral') || rawText.toLowerCase().includes('ref')) {
      await this.sendReferralProgram(chatId);
      return;
    }

    const lowerText = rawText.toLowerCase();

    // 6. Direct Match by Teacher Exam Category Keywords
    if (lowerText.includes('មតេយ្យ') || lowerText.includes('preschool')) {
      await this.sendProductCatalog(chatId, 'cat_pre');
      return;
    }
    if (lowerText.includes('បឋម') || lowerText.includes('primary')) {
      await this.sendProductCatalog(chatId, 'cat_pri');
      return;
    }
    if (lowerText.includes('អនុវិទ្យាល័យ') || lowerText.includes('គ្រូមូលដ្ឋាន') || lowerText.includes('lower')) {
      await this.sendProductCatalog(chatId, 'cat_low');
      return;
    }
    if (lowerText.includes('វិទ្យាល័យ') || lowerText.includes('upper')) {
      await this.sendProductCatalog(chatId, 'cat_upp');
      return;
    }

    // 7. Direct Match by Book Name
    const products = db.getProducts().filter(p => p.isActive);
    const matchedProduct = products.find(p =>
      p.name.toLowerCase() === lowerText ||
      lowerText.includes(p.name.toLowerCase()) ||
      (lowerText.length >= 4 && p.name.toLowerCase().includes(lowerText))
    );
    if (matchedProduct) {
      await this.sendProductDetail(chatId, matchedProduct.id, 1);
      return;
    }

    // 8. Buy / Book Catalog & Exam / QCM keywords
    if (
      rawText.includes('សៀវភៅ') ||
      rawText.includes('ទិញ') ||
      rawText.toLowerCase().includes('buy') ||
      rawText.toLowerCase().includes('book') ||
      rawText.toLowerCase().includes('catalog') ||
      rawText.toLowerCase().includes('qcm') ||
      rawText.includes('ប្រឡង') ||
      rawText.includes('វិញ្ញាសា') ||
      rawText.includes('ឯកសារ') ||
      rawText.includes('បាក់ឌុប')
    ) {
      await this.sendProductCatalog(chatId);
      return;
    }

    // Default fallback - show menu
    await this.handleStart(chatId, username, firstName, user.last_name);
  }

  /**
   * Test and verify bot token with Telegram getMe API
   */
  public static async getMe(tokenOverride?: string): Promise<{ ok: boolean; bot?: any; error?: string }> {
    const settings = db.getSettings();
    const token = (tokenOverride || settings.botToken)?.trim();
    if (!token) return { ok: false, error: 'មិនទាន់មាន Bot Token នៅឡើយទេ' };

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data: any = await res.json();
      if (data.ok && data.result) {
        return { ok: true, bot: data.result };
      }
      return { ok: false, error: data.description || 'Token មិនត្រឹមត្រូវ' };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Network error' };
    }
  }

  /**
   * Get live Webhook status directly from Telegram
   */
  public static async getWebhookInfo(tokenOverride?: string): Promise<{ ok: boolean; info?: any; error?: string }> {
    const settings = db.getSettings();
    const token = (tokenOverride || settings.botToken)?.trim();
    if (!token) return { ok: false, error: 'មិនទាន់មាន Bot Token នៅឡើយទេ' };

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const data: any = await res.json();
      if (data.ok && data.result) {
        return { ok: true, info: data.result };
      }
      return { ok: false, error: data.description || 'មិនអាចពិនិត្យ Webhook Info បានទេ' };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Network error' };
    }
  }

  /**
   * Delete webhook to enable long polling
   */
  public static async deleteWebhook(tokenOverride?: string): Promise<{ ok: boolean; description?: string }> {
    const settings = db.getSettings();
    const token = (tokenOverride || settings.botToken)?.trim();
    if (!token) return { ok: false, description: 'No token' };

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
      const data: any = await res.json();
      return { ok: Boolean(data.ok), description: data.description };
    } catch (err: any) {
      return { ok: false, description: err.message };
    }
  }

  /**
   * Set webhook for real-time 24/7 instant serverless updates
   */
  public static async setWebhook(url: string, tokenOverride?: string): Promise<{ ok: boolean; description?: string }> {
    const settings = db.getSettings();
    const token = (tokenOverride || settings.botToken)?.trim();
    if (!token) return { ok: false, description: 'No token' };

    try {
      const params = new URLSearchParams({
        url: url,
        drop_pending_updates: 'false'
      });
      const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`);
      const data: any = await res.json();
      return { ok: Boolean(data.ok), description: data.description };
    } catch (err: any) {
      return { ok: false, description: err.message };
    }
  }

  /**
   * Process a single incoming Telegram update (from Webhook or Polling)
   */
  public static async handleUpdate(update: any): Promise<void> {
    if (!update) return;

    if (update.my_chat_member) {
      const chat = update.my_chat_member.chat;
      const newStatus = update.my_chat_member.new_chat_member?.status;
      if (newStatus === 'kicked' || newStatus === 'left') {
        db.setCustomerBlockedStatus(chat.id, true);
        console.log(`[Telegram] User ${chat.id} (${chat.username || chat.first_name || 'user'}) blocked the bot.`);
      } else if (newStatus === 'member') {
        db.setCustomerBlockedStatus(chat.id, false);
        console.log(`[Telegram] User ${chat.id} (${chat.username || chat.first_name || 'user'}) unblocked the bot.`);
      }
      return;
    }

    if (update.message) {
      // If customer was previously marked as blocked, reset it since they sent a message
      if (update.message.chat && update.message.chat.id) {
        db.setCustomerBlockedStatus(update.message.chat.id, false);
      }

      // 1. Payment Slip Photo Upload
      if (update.message.photo && Array.isArray(update.message.photo) && update.message.photo.length > 0) {
        const bestPhoto = update.message.photo[update.message.photo.length - 1];
        await this.handleIncomingPaymentSlip(
          update.message.chat.id,
          bestPhoto.file_id,
          update.message.from || { id: update.message.chat.id },
          update.message.caption
        );
        return;
      }

      // 2. Payment Slip Document/PDF Upload
      if (update.message.document) {
        await this.handleIncomingPaymentSlip(
          update.message.chat.id,
          update.message.document.file_id,
          update.message.from || { id: update.message.chat.id },
          update.message.caption
        );
        return;
      }

      // 3. Text Message
      if (update.message.text) {
        await this.handleTextMessage(
          update.message.chat.id,
          update.message.text,
          update.message.from || { id: update.message.chat.id }
        );
      }
    }

    if (update.callback_query) {
      if (update.callback_query.message && update.callback_query.message.chat) {
        db.setCustomerBlockedStatus(update.callback_query.message.chat.id, false);
      }
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  /**
   * Telegram Long Polling Engine
   */
  public static startPolling() {
    if (this.isRunning) return;
    this.isRunning = true;
    db.updateSettings({ isPollingActive: true });
    this.pollLoop();
  }

  public static stopPolling() {
    this.isRunning = false;
    db.updateSettings({ isPollingActive: false });
    if (this.pollAbortController) {
      this.pollAbortController.abort();
      this.pollAbortController = null;
    }
  }

  private static async pollLoop() {
    let webhookCleared = false;

    while (this.isRunning) {
      const settings = db.getSettings();
      const token = settings.botToken?.trim();

      if (!token) {
        // Wait 3 seconds before checking if token is supplied
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      // Automatically delete conflicting webhook on first run so long polling works without 409 conflict
      if (!webhookCleared) {
        try {
          await this.deleteWebhook(token);
          webhookCleared = true;
        } catch {
          // ignore
        }
      }

      try {
        this.pollAbortController = new AbortController();
        const timeout = 25;
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.pollOffset}&timeout=${timeout}`;
        
        const response = await fetch(url, { signal: this.pollAbortController.signal });

        if (response.ok) {
          const data: any = await response.json();
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              this.pollOffset = update.update_id + 1;
              await this.handleUpdate(update);
            }
          }
        } else {
          const errorData: any = await response.json().catch(() => null);
          if (errorData?.error_code === 409) {
            // Webhook was active, clear it and retry
            await this.deleteWebhook(token);
            await new Promise(r => setTimeout(r, 2000));
          } else {
            // Other error (e.g. 401 unauthorized), wait 5s
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Telegram long polling network glitch, retrying...', err.message);
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  /**
   * Background Payment Verification Worker (Every 3 seconds)
   */
  public static startBackgroundWorkers() {
    // 1. Payment verification every 3 seconds
    setInterval(async () => {
      try {
        const pendingOrders = db.getOrders().filter(o => o.status === 'pending' && o.cutluyPaymentId);
        for (const order of pendingOrders) {
          if (!order.cutluyPaymentId) continue;
          
          // Check payment status
          const statusRes = await CutLuyService.getPaymentStatus(order.cutluyPaymentId);
          if (statusRes.status === 'paid' || statusRes.status === 'approved') {
            await this.fulfillOrder(order.id);
          }
        }
      } catch (err) {
        console.error('Error in payment polling worker:', err);
      }
    }, 3000);

    // 2. Reservation & order expiration cleanup every 30 seconds
    setInterval(() => {
      try {
        db.releaseExpiredReservations();
      } catch (err) {
        console.error('Error in cleanup worker:', err);
      }
    }, 30000);
  }
}
