import { db } from './db';
import { CutLuyService } from './cutluy';
import type { Order, Product, StockItem, BotSimulatorMessage, Customer, KnownGroup } from '../src/types/store';

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

// Cambodian phone number validator (01x, 06x, 07x, 08x, 09x - 9 to 10 digits)
export function isValidCambodianPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return /^0[1-9]\d{7,8}$/.test(cleaned);
}

// Format dual currency string (USD & KHR)
export function formatDualPrice(usd: number, exchangeRate = 4100): string {
  const khr = Math.round(usd * exchangeRate);
  return `$${usd.toFixed(2)} USD (≈ ${khr.toLocaleString()} ៛)`;
}

// Cambodia Provinces for VET Express & J&T Express Logistics
export const CAMBODIA_PROVINCES = [
  { id: 'sr', name: 'សៀមរាប', en: 'Siem Reap' },
  { id: 'btb', name: 'បាត់ដំបង', en: 'Battambang' },
  { id: 'kpc', name: 'កំពង់ចាម', en: 'Kampong Cham' },
  { id: 'shv', name: 'ព្រះសីហនុ', en: 'Preah Sihanouk' },
  { id: 'kpt', name: 'កំពត', en: 'Kampot' },
  { id: 'bmc', name: 'បន្ទាយមានជ័យ', en: 'Banteay Meanchey' },
  { id: 'kdl', name: 'កណ្តាល', en: 'Kandal' },
  { id: 'tko', name: 'តាកែវ', en: 'Takeo' },
  { id: 'kps', name: 'កំពង់ស្ពឺ', en: 'Kampong Speu' },
  { id: 'svr', name: 'ស្វាយរៀង', en: 'Svay Rieng' },
  { id: 'pvg', name: 'ព្រៃវែង', en: 'Prey Veng' },
  { id: 'pst', name: 'ពោធិ៍សាត់', en: 'Pursat' },
  { id: 'kch', name: 'កំពង់ឆ្នាំង', en: 'Kampong Chhnang' },
  { id: 'kth', name: 'កំពង់ធំ', en: 'Kampong Thom' },
  { id: 'krc', name: 'ក្រចេះ', en: 'Kratie' },
  { id: 'tbk', name: 'ត្បូងឃ្មុំ', en: 'Tboung Khmum' },
  { id: 'pln', name: 'ប៉ៃលិន', en: 'Pailin' },
  { id: 'kep', name: 'កែប', en: 'Kep' },
  { id: 'omc', name: 'ឧត្តរមានជ័យ', en: 'Oddar Meanchey' },
  { id: 'stv', name: 'ស្ទឹងត្រែង', en: 'Stung Treng' },
  { id: 'rtk', name: 'រតនគិរី', en: 'Ratanakiri' },
  { id: 'mdk', name: 'មណ្ឌលគិរី', en: 'Mondulkiri' },
  { id: 'pvh', name: 'ព្រះវិហារ', en: 'Preah Vihear' },
  { id: 'koh', name: 'កោះកុង', en: 'Koh Kong' }
];

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

  // In-memory Cart System: user chatId -> array of items
  private static userCarts: Map<string, Array<{ productId: string; qty: number }>> = new Map();

  public static getCart(chatId: string | number): Array<{ productId: string; qty: number }> {
    const key = String(chatId);
    if (!this.userCarts.has(key)) {
      this.userCarts.set(key, []);
    }
    return this.userCarts.get(key)!;
  }

  public static addToCart(chatId: string | number, productId: string, qty = 1): number {
    const cart = this.getCart(chatId);
    const existing = cart.find(i => i.productId === productId);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ productId, qty });
    }
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  public static updateCartQty(chatId: string | number, productId: string, delta: number): void {
    const cart = this.getCart(chatId);
    const existing = cart.find(i => i.productId === productId);
    if (existing) {
      existing.qty += delta;
      if (existing.qty <= 0) {
        this.removeFromCart(chatId, productId);
      }
    }
  }

  public static removeFromCart(chatId: string | number, productId: string): void {
    const key = String(chatId);
    const filtered = this.getCart(key).filter(i => i.productId !== productId);
    this.userCarts.set(key, filtered);
  }

  public static clearCart(chatId: string | number): void {
    this.userCarts.set(String(chatId), []);
  }

  // In-memory owner broadcast drafts: draftId -> draft data
  private static ownerBroadcastDrafts: Map<string, {
    text: string;
    photoUrl?: string;
    sender: string;
    createdAt: number;
  }> = new Map();

  /**
   * Check if a Telegram user is the store owner @yoeurnhoeurn
   */
  public static isOwnerUser(chatId: number | string, username?: string): boolean {
    const settings = db.getSettings();
    const strId = String(chatId);
    const u = (username || '').toLowerCase().replace('@', '');
    return strId === '6277908085' ||
      u === 'yoeurnhoeurn' ||
      Boolean(settings.adminTelegramId && strId === settings.adminTelegramId.trim());
  }

  /**
   * Retrieve all eligible Broadcast targets (Users and Groups/Channels)
   */
  public static getAllBroadcastTargets(): {
    userTargets: Customer[];
    groupTargets: Array<{ id: string | number; title: string }>;
  } {
    const settings = db.getSettings();
    const userTargets = db.getCustomers().filter(c => !c.isBlocked);
    const groupMap = new Map<string, { id: string | number; title: string }>();

    // 1. Groups recorded from bot member updates / messages
    for (const g of db.getKnownGroups()) {
      groupMap.set(String(g.id), { id: g.id, title: g.title || `Telegram Group (${g.id})` });
    }

    // 2. Team admin group from settings
    if (settings.adminGroupId && settings.adminGroupId.trim()) {
      const gId = settings.adminGroupId.trim();
      if (!groupMap.has(gId)) {
        groupMap.set(gId, { id: gId, title: 'Telegram Team Group (Admin)' });
      }
    }

    // 3. Alerts Channel from settings
    if (settings.channelId && settings.channelId.trim()) {
      const chId = settings.channelId.trim();
      if (!groupMap.has(chId)) {
        groupMap.set(chId, { id: chId, title: 'Telegram Channel (Alerts)' });
      }
    }

    return {
      userTargets,
      groupTargets: Array.from(groupMap.values())
    };
  }

  /**
   * Prompt owner with an interactive dispatch menu to broadcast to Users and Groups
   */
  public static async promptOwnerBroadcast(
    chatId: number | string,
    messageText: string,
    senderUsername: string,
    photoFileId?: string
  ): Promise<void> {
    const draftId = `bc_${Date.now()}`;
    this.ownerBroadcastDrafts.set(draftId, {
      text: messageText,
      photoUrl: photoFileId,
      sender: senderUsername,
      createdAt: Date.now()
    });

    const { userTargets, groupTargets } = this.getAllBroadcastTargets();

    const groupListPreview = groupTargets.length > 0
      ? groupTargets.slice(0, 3).map(g => `  • ${g.title}`).join('\n') + (groupTargets.length > 3 ? `\n  • ...និង ${groupTargets.length - 3} គ្រុបផ្សេងទៀត` : '')
      : '  (មិនទាន់មានគ្រុបបន្ថែម)';

    const totalTargets = userTargets.length + groupTargets.length;

    const previewMsg = `📢 <b>ប្រព័ន្ធផ្សាយសារផ្ទាល់ពីម្ចាស់ហាង (@yoeurnhoeurn)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📝 <b>ខ្លឹមសារសារដែលត្រូវផ្សាយ៖</b>\n` +
      `«<i>${messageText}</i>»\n\n` +
      (photoFileId ? `🖼️ <i>(ភ្ជាប់ជាមួយរូបភាព 1 សន្លឹក)</i>\n\n` : '') +
      `🎯 <b>ស្ថិតិគោលដៅទទួលសារបច្ចុប្បន្ន៖</b>\n` +
      `• 👥 <b>User/អតិថិជនទាំងអស់៖</b> <b>${userTargets.length}</b> នាក់\n` +
      `• 🏢 <b>គ្រុប/ឆានែលទាំងអស់៖</b> <b>${groupTargets.length}</b> គ្រុប\n` +
      `${groupListPreview}\n\n` +
      `👇 <b>សូមជ្រើសរើសគោលដៅដែលត្រូវបញ្ជូនសារនេះ៖</b>`;

    const inline_keyboard = [
      [
        { text: `🚀 ផ្ញើទៅ Users & គ្រុបទាំងអស់ (${totalTargets})`, callback_data: `bc_exec_all_${draftId}` }
      ],
      [
        { text: `👥 ផ្ញើទៅតែ Users ទាំងអស់ (${userTargets.length})`, callback_data: `bc_exec_users_${draftId}` },
        { text: `🏢 ផ្ញើទៅតែ គ្រុបទាំងអស់ (${groupTargets.length})`, callback_data: `bc_exec_groups_${draftId}` }
      ],
      [
        { text: '❌ បោះបង់ (Cancel)', callback_data: `bc_cancel_${draftId}` }
      ]
    ];

    if (photoFileId) {
      await this.sendPhotoFileId(chatId, photoFileId, previewMsg, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML'
      });
    } else {
      await this.sendMessage(chatId, previewMsg, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML'
      });
    }
  }

  /**
   * Execute Broadcast dispatch to Users and/or Groups
   */
  public static async executeBroadcast(
    target: 'all' | 'users' | 'groups',
    content: { text: string; photoUrl?: string },
    operatorChatId?: number | string
  ): Promise<{
    totalUsers: number;
    userSuccess: number;
    totalGroups: number;
    groupSuccess: number;
    failCount: number;
  }> {
    const { userTargets, groupTargets } = this.getAllBroadcastTargets();
    const shouldSendUsers = target === 'all' || target === 'users';
    const shouldSendGroups = target === 'all' || target === 'groups';

    let userSuccess = 0;
    let groupSuccess = 0;
    let failCount = 0;

    const formattedMessage = content.text;

    // Send to Users
    if (shouldSendUsers) {
      for (const u of userTargets) {
        try {
          let sent = false;
          if (content.photoUrl) {
            sent = await this.sendPhotoFileId(u.telegramId, content.photoUrl, formattedMessage, { parse_mode: 'HTML' });
          } else {
            sent = await this.sendMessage(u.telegramId, formattedMessage, { parse_mode: 'HTML' });
          }
          if (sent) userSuccess++;
          else failCount++;
          await new Promise(r => setTimeout(r, 40));
        } catch {
          failCount++;
        }
      }
    }

    // Send to Groups
    if (shouldSendGroups) {
      for (const g of groupTargets) {
        try {
          let sent = false;
          if (content.photoUrl) {
            sent = await this.sendPhotoFileId(g.id, content.photoUrl, formattedMessage, { parse_mode: 'HTML' });
          } else {
            sent = await this.sendMessage(g.id, formattedMessage, { parse_mode: 'HTML' });
          }
          if (sent) groupSuccess++;
          else failCount++;
          await new Promise(r => setTimeout(r, 40));
        } catch {
          failCount++;
        }
      }
    }

    // If operator chatId is provided, send completion report
    if (operatorChatId) {
      const report = `✅ <b>ការផ្សាយសារ (Broadcast) បានបញ្ចប់ជោគជ័យ!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 <b>ស្ថិតិនៃការបញ្ជូន៖</b>\n` +
        (shouldSendUsers ? `• 👥 <b>Users ទទួលបាន៖</b> <b>${userSuccess}/${userTargets.length}</b> នាក់\n` : '') +
        (shouldSendGroups ? `• 🏢 <b>គ្រុប/ឆានែលទទួលបាន៖</b> <b>${groupSuccess}/${groupTargets.length}</b> គ្រុប\n` : '') +
        `• ⚠️ <b>បរាជ័យ/Blocked៖</b> ${failCount}\n\n` +
        `⏱️ <b>ពេលវេលា៖</b> ${new Date().toLocaleTimeString('km-KH')}`;

      await this.sendMessage(operatorChatId, report, {
        reply_markup: this.getMainReplyKeyboard(),
        parse_mode: 'HTML'
      });
    }

    return {
      totalUsers: userTargets.length,
      userSuccess,
      totalGroups: groupTargets.length,
      groupSuccess,
      failCount
    };
  }

  /**
   * Main Reply Keyboard (Persistent Menu at bottom of chat)
   */
  public static getMainReplyKeyboard() {
    return {
      keyboard: [
        [{ text: '🛒 ទិញសៀវភៅ' }, { text: '🛍️ កន្ត្រកទំនិញ' }],
        [{ text: '📦 ពិនិត្យស្តុក' }, { text: '🚚 តាមដានអីវ៉ាន់' }],
        [{ text: '📜 ប្រវត្តិទិញ' }, { text: '📞 ជំនួយ & ទំនាក់ទំនង' }]
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
   * Sends Document (e.g. PDF file or file URL) directly to Telegram Chat
   */
  public static async sendDocument(
    chatId: number | string,
    documentUrlOrFileId: string,
    caption?: string,
    options?: {
      reply_markup?: any;
      parse_mode?: 'HTML';
      fileName?: string;
    }
  ): Promise<boolean> {
    const settings = db.getSettings();
    const token = settings.botToken?.trim();

    // Broadcast to simulator
    this.notifySimulator({
      id: `sim_doc_${Date.now()}_${Math.random()}`,
      sender: 'bot',
      text: (caption ? caption + '\n\n' : '') + `📎 <b>ឯកសារ PDF៖</b> <a href="${documentUrlOrFileId}">${options?.fileName || 'សៀវភៅ_ពេញលេញ.pdf'}</a>`,
      timestamp: new Date().toLocaleTimeString(),
      inlineKeyboard: options?.reply_markup?.inline_keyboard
    });

    if (!token || String(chatId).startsWith('sim_')) {
      return true;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          document: documentUrlOrFileId,
          caption: caption || '',
          parse_mode: options?.parse_mode || 'HTML',
          reply_markup: options?.reply_markup
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        this.handleApiError('sendDocument', chatId, response.status, errText);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('Telegram sendDocument network error:', err?.message);
      return false;
    }
  }

  /**
   * Dispatches alerts to all configured Admin targets (Private Chat, Team Group, Channel)
   */
  public static async notifyAdmins(
    text: string,
    options?: {
      reply_markup?: any;
      parse_mode?: 'HTML';
      photoUrl?: string;
    }
  ): Promise<void> {
    const settings = db.getSettings();
    const targets = new Set<string>();

    if (settings.adminTelegramId && settings.adminTelegramId.trim()) {
      targets.add(settings.adminTelegramId.trim());
    }
    if (settings.adminGroupId && settings.adminGroupId.trim()) {
      targets.add(settings.adminGroupId.trim());
    }
    if (settings.channelId && settings.channelId.trim()) {
      targets.add(settings.channelId.trim());
    }

    // Always notify simulator
    this.notifySimulator({
      id: `sim_admin_alert_${Date.now()}_${Math.random()}`,
      sender: 'bot',
      text: `📢 <b>[Admin Alert Dispatch]</b>\n${text}`,
      photoUrl: options?.photoUrl,
      timestamp: new Date().toLocaleTimeString(),
      inlineKeyboard: options?.reply_markup?.inline_keyboard
    });

    for (const target of targets) {
      try {
        if (options?.photoUrl) {
          await this.sendPhotoFileId(target, options.photoUrl, text, {
            reply_markup: options.reply_markup,
            parse_mode: options.parse_mode || 'HTML'
          });
        } else {
          await this.sendMessage(target, text, {
            reply_markup: options?.reply_markup,
            parse_mode: options?.parse_mode || 'HTML'
          });
        }
      } catch (err: any) {
        console.warn(`[Telegram] Failed to notify admin target ${target}:`, err?.message);
      }
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
   * Self-Service Order Tracking Menu (🚚 តាមដានអីវ៉ាន់)
   */
  public static async handleOrderTracking(chatId: number | string) {
    const strChatId = String(chatId);
    const orders = db.getOrders();
    const myOrders = orders.filter(o =>
      o.telegramId === strChatId || (strChatId.startsWith('sim_') && o.telegramId.startsWith('sim_'))
    ).slice(0, 5);

    let text = `🚚 <b>ប្រព័ន្ធតាមដានកញ្ចប់អីវ៉ាន់ & ការបញ្ជាទិញ (ORDER TRACKING)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;

    const inline_keyboard: Array<Array<{ text: string; callback_data?: string }>> = [];

    if (myOrders.length === 0) {
      text += `លោកអ្នកមិនទាន់មានប្រវត្តិបញ្ជាទិញសៀវភៅនៅឡើយទេ។\n\n` +
        `🔎 <b>ស្វែងរកតាមលេខវិក្កយបត្រ៖</b>\n` +
        `ប្រសិនបើលោកអ្នកមានលេខកូដវិក្កយបត្រ (Order ID ឧ. <code>ORD-892104</code>) សូមផ្ញើលេខនោះចូលក្នុង Chat នេះ ដើម្បីឆែកមើលភ្លាមៗ!`;
    } else {
      text += `📋 <b>ការបញ្ជាទិញថ្មីៗរបស់លោកអ្នក៖</b>\n\n`;
      for (const ord of myOrders) {
        const isPrinted = ord.bookFormat === 'printed';
        let statusBadge = '⏳ រង់ចាំទូទាត់';
        if (ord.status === 'completed') {
          if (isPrinted) {
            statusBadge = ord.shippingStatus === 'shipped'
              ? '🚚 កំពុងដឹកជញ្ជូន'
              : ord.shippingStatus === 'delivered'
              ? '✅ បានប្រគល់ជូន'
              : '📦 កំពុងរៀបចំវេចខ្ចប់';
          } else {
            statusBadge = '✅ បានផ្ញើសៀវភៅ PDF';
          }
        } else if (ord.status === 'rejected') {
          statusBadge = '❌ បានបដិសេធ';
        }

        text += `• <b>#${ord.id}</b> | ${ord.productName.slice(0, 28)}...\n` +
          `  └ ស្ថានភាព៖ <b>${statusBadge}</b>\n` +
          (ord.trackingNumber ? `  └ លេខ Tracking: <code>${ord.trackingNumber}</code>\n` : '') +
          `\n`;

        inline_keyboard.push([
          { text: `🔍 ពិនិត្យលម្អិត #${ord.id}`, callback_data: `track_order_${ord.id}` }
        ]);
      }
      text += `👉 <i>ឬលោកអ្នកអាចផ្ញើលេខវិក្កយបត្រផ្សេងទៀត (ឧ. ORD-XXXXXX) ចូលទីនេះបាន!</i>`;
    }

    inline_keyboard.push([
      { text: '🛒 ទិញសៀវភៅថ្មី', callback_data: 'catalog_menu' },
      { text: '💬 សួរ Admin', callback_data: 'support_chat' }
    ]);

    // Set state so next text input will be treated as tracking search
    this.customerStates.set(strChatId, { step: 'awaiting_tracking_search', data: {} });

    await this.sendMessage(chatId, text, {
      reply_markup: { inline_keyboard },
      parse_mode: 'HTML'
    });
  }

  /**
   * Search and display detailed Order Tracking Card
   */
  public static async handleTrackingQuery(chatId: number | string, queryText: string) {
    this.customerStates.delete(String(chatId));
    const cleanId = queryText.replace(/#/g, '').trim().toUpperCase();
    const order = db.getOrders().find(o => o.id.toUpperCase() === cleanId || o.id.toUpperCase().includes(cleanId));

    if (!order) {
      await this.sendMessage(
        chatId,
        `⚠️ <b>រកមិនឃើញវិក្កយបត្រ "${cleanId}" ឡើយ!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `សូមពិនិត្យមើលលេខកូដវិក្កយបត្រឡើងវិញ (ឧទាហរណ៍៖ <code>ORD-892104</code>) ឬទាក់ទងមក Admin ប្រសិនបើលោកអ្នកត្រូវការជំនួយ។`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 ព្យាយាមឆែកម្តងទៀត', callback_data: 'track_menu' }],
              [{ text: '💬 ទាក់ទង Admin', callback_data: 'support_chat' }]
            ]
          },
          parse_mode: 'HTML'
        }
      );
      return;
    }

    const isPrinted = order.bookFormat === 'printed';
    const settings = db.getSettings();

    let trackCard = `🚚 <b>ព័ត៌មានលម្អិតនៃការដឹកជញ្ជូន (SHIPMENT TRACKING)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `┌ 🔖 <b>លេខវិក្កយបត្រ៖</b> <code>#${order.id}</code>\n` +
      `├ 📚 <b>សៀវភៅ៖</b> <b>${order.productName}</b>\n` +
      `├ 🏷️ <b>ប្រភេទ៖</b> ${isPrinted ? '📖 សៀវភៅក្រដាស (Hardcopy)' : '📄 សៀវភៅ PDF (E-Book)'}\n` +
      `├ 🔢 <b>បរិមាណ៖</b> <b>${order.quantity}</b>\n` +
      `└ 💵 <b>ទឹកប្រាក់៖</b> <code>$${order.totalAmount.toFixed(2)} USD</code>\n\n`;

    if (isPrinted) {
      const step1 = '✅';
      const step2 = order.status === 'completed' ? '✅' : '⏳';
      const step3 = (order.shippingStatus === 'shipped' || order.shippingStatus === 'delivered') ? '✅' : '⏳';
      const step4 = order.shippingStatus === 'delivered' ? '✅' : '⏳';

      trackCard += `📍 <b>ដំណាក់កាលដឹកជញ្ជូន (Status Stepper):</b>\n` +
        `${step1} <b>១. ការទូទាត់ប្រាក់៖</b> ទទួលបានជោគជ័យ\n` +
        `${step2} <b>២. ការវេចខ្ចប់៖</b> ${order.shippingStatus === 'preparing' || order.status === 'completed' ? 'កំពុងរៀបចំសៀវភៅ' : 'រង់ចាំ'}\n` +
        `${step3} <b>៣. ការប្រគល់ជូនអ្នកដឹក៖</b> ${order.shippingStatus === 'shipped' ? 'កំពុងដឹកតាមផ្លូវ' : order.shippingStatus === 'delivered' ? 'ដឹកដល់គោលដៅ' : 'រង់ចាំចេញដំណើរ'}\n` +
        `${step4} <b>៤. ការប្រគល់ដល់ដៃ៖</b> ${order.shippingStatus === 'delivered' ? 'បានប្រគល់ជូនរួចរាល់' : 'កំពុងរង់ចាំ'}\n\n` +
        `📦 <b>ព័ត៌មានកញ្ចប់អីវ៉ាន់៖</b>\n` +
        `┌ 👤 <b>អ្នកទទួល៖</b> <b>${order.shippingRecipient || order.customerName}</b>\n` +
        `├ 📞 <b>លេខទូរស័ព្ទ៖</b> <code>${order.shippingPhone || 'មិនទាន់បញ្ជាក់'}</code>\n` +
        `├ 📍 <b>អាសយដ្ឋាន/ក្រុមហ៊ុនដឹក៖</b> ${order.shippingAddress || 'រាជធានីភ្នំពេញ'}\n` +
        `└ 🏷️ <b>លេខកូដតាមដាន (Tracking Code):</b> <code>${order.trackingNumber || 'កំពុងរង់ចាំលេខកូដពីក្រុមហ៊ុនដឹក'}</code>\n\n` +
        `💡 <i>* ប្រសិនបើមានលេខ Tracking លោកអ្នកអាចយកទៅផ្ទៀងផ្ទាត់លើ App វីរៈប៊ុនថាំ (VET) ឬ J&T Express បាន!</i>`;
    } else {
      trackCard += `⚡ <b>ស្ថានភាព E-Book (PDF):</b>\n` +
        `• ស្ថានភាព៖ <b>${order.status === 'completed' ? '✅ បានទូទាត់ និងផ្ញើសៀវភៅរួចរាល់' : '⏳ កំពុងដំណើរការ'}</b>\n` +
        (order.deliveredItems && order.deliveredItems.length > 0 ? `• តំណភ្ជាប់ទាញយក៖ <code>${order.deliveredItems[0]}</code>\n` : '');
    }

    const inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
      [
        { text: '💬 សួរនាំ Admin បន្ថែម', url: `https://t.me/${settings.supportUsername || 'yoeurnhoeurn'}` }
      ],
      [
        { text: '🔙 ត្រឡប់ទៅតាមដាន', callback_data: 'track_menu' },
        { text: '🏠 Menu ដើម', callback_data: 'menu_main' }
      ]
    ];

    await this.sendMessage(chatId, trackCard, {
      reply_markup: { inline_keyboard },
      parse_mode: 'HTML'
    });
  }

  /**
   * Sample Questions Generator for Any Product
   */
  public static getProductSampleQuestions(product: Product): { previewText: string; questions: Array<{ question: string; options: string[]; answerIndex: number; explanation: string }> } {
    if (product.sampleQuestions && product.sampleQuestions.length > 0) {
      return {
        previewText: product.samplePreviewText || `📖 <b>គំរូមាតិកា & វិញ្ញាសាសាកល្បង៖</b>\n${product.description}`,
        questions: product.sampleQuestions.map(q => ({
          question: q.question,
          options: q.options,
          answerIndex: q.answerIndex,
          explanation: q.explanation || 'ចម្លើយត្រឹមត្រូវស្របតាមក្បួនគរុកោសល្យ និងកម្មវិធីសិក្សាជាតិ។'
        }))
      };
    }

    const cat = (product.category || '').toLowerCase();
    const name = (product.name || '').toLowerCase();

    if (cat.includes('មតេយ្យ') || name.includes('មតេយ្យ') || cat.includes('preschool')) {
      return {
        previewText: `📖 <b>គំរូមាតិកាឈុតគ្រូមតេយ្យ (Preschool Syllabus Sample):</b>\n• ជំពូកទី ១៖ ចិត្តវិទ្យាអភិវឌ្ឍន៍កុមារតូច (០-៦ ឆ្នាំ)\n• ជំពូកទី ២៖ ការរៀបចំបរិយាកាសថ្នាក់រៀនមតេយ្យ\n• ជំពូកទី ៣៖ ការបង្រៀនតាមរយៈការលេង (Play-based Learning)`,
        questions: [
          {
            question: 'តើវិធីសាស្ត្រគរុកោសល្យណាដែលស័ក្តិសមបំផុតសម្រាប់ការបង្រៀនកុមារតូចមតេយ្យសិក្សា?',
            options: ['A. ការរៀនតាមរយៈការលេង (Play-based learning)', 'B. ការឱ្យទន្ទេញមេរៀនដោយបង្ខំ', 'C. ការធ្វើតេស្តសរសេររាល់ថ្ងៃ', 'D. ការឱ្យអង្គុយស្តាប់គ្រូតែម្យ៉ាង'],
            answerIndex: 0,
            explanation: 'កុមារតូចលូតលាស់សតិបញ្ញា និងបំណិនសង្គមបានល្អបំផុតតាមរយៈសកម្មភាពលេង និងការប៉ះពាល់វត្ថុជាក់ស្តែង (Play-based learning)។'
          },
          {
            question: 'តើការអភិវឌ្ឍផ្នែកណាមួយដែលមានសារៈសំខាន់ស្មើគ្នានឹងការយល់ដឹងភាសានៅវ័យមតេយ្យ?',
            options: ['A. ការអភិវឌ្ឍអារម្មណ៍ និងសង្គម (Social-Emotional)', 'B. ការគិតលេខកម្រិតខ្ពស់', 'C. ការសរសេរអក្សរផ្ចិត', 'D. ការទន្ទេញរូបមន្ត'],
            answerIndex: 0,
            explanation: 'ការគ្រប់គ្រងអារម្មណ៍ និងការចុះសម្រុងជាមួយមិត្តភក្តិ គឺជាមូលដ្ឋានគ្រឹះរឹងមាំសម្រាប់ភាពជោគជ័យនៃការសិក្សានាពេលអនាគត។'
          }
        ]
      };
    }

    if (cat.includes('បឋម') || name.includes('បឋម') || cat.includes('primary')) {
      return {
        previewText: `📖 <b>គំរូមាតិកាឈុតគ្រូបឋមសិក្សា (Primary School Syllabus Sample):</b>\n• ជំពូកទី ១៖ វិធីសាស្ត្របង្រៀនភាសាខ្មែរដំបូង (អំណាន & សំណេរ)\n• ជំពូកទី ២៖ គរុកោសល្យគណិតវិទ្យាគ្រឹះ និងរង្វាស់រង្វាល់\n• ជំពូកទី ៣៖ ការវាយតម្លៃលទ្ធផលសិក្សាតាមស្តង់ដារបឋម`,
        questions: [
          {
            question: 'តើគោលការណ៍ចម្បងនៃការបង្រៀនសិស្សបឋមសិក្សាគឺអ្វី?',
            options: ['A. ពីងាយទៅលំបាក និងពីជាក់ស្តែងទៅអរូបិយ', 'B. ពីទ្រឹស្តីស្មុគស្មាញទៅលំហាត់ងាយ', 'C. ផ្តោតលើការប្រឡងតែមួយមុខ', 'D. បង្រៀនលឿនដើម្បីចប់កម្មវិធី'],
            answerIndex: 0,
            explanation: 'ការបង្រៀនបឋមត្រូវចាប់ផ្តើមពីវត្ថុជាក់ស្តែង (Concrete) ទៅកាន់គំនិតអរូបិយ (Abstract) និងពីងាយទៅលំបាក។'
          },
          {
            question: 'ក្នុងការរៀបចំកិច្ចតែងការបង្រៀន តើជំហានណាដែលជាការវាស់ស្ទង់ការយល់ដឹងរបស់សិស្ស?',
            options: ['A. ជំហានទី ៤ (ការពង្រឹងពុទ្ធិ)', 'B. ជំហានទី ១ (រដ្ឋបាលថ្នាក់)', 'C. ជំហានទី ២ (កែរំលឹកមេរៀនចាស់)', 'D. ជំហានទី ៥ (បណ្តាំផ្ញើ)'],
            answerIndex: 0,
            explanation: 'ជំហានទី ៤ គឺការពង្រឹងពុទ្ធិ តាមរយៈការដាក់សំណួរ ឬលំហាត់សង្ខេបដើម្បីវាយតម្លៃការយល់ដឹងរបស់សិស្សលើមេរៀនថ្មី។'
          }
        ]
      };
    }

    // Default general exam sample questions
    return {
      previewText: `📖 <b>គំរូមាតិកា & វិញ្ញាសាសាកល្បង៖</b>\n• កម្រងសំណួរ QCM ជ្រើសរើសចម្លើយត្រឹមត្រូវ\n• គន្លឹះ និងរូបមន្តដោះស្រាយលឿន\n• ការពន្យល់ហេតុផល និងយោងតាមច្បាប់/កម្មវិធីសិក្សាជាតិ`,
      questions: [
        {
          question: 'តើការប្រឡង QCM ទាមទារបច្ចេកទេសអ្វីខ្លះដើម្បីទទួលបានពិន្ទុខ្ពស់?',
          options: ['A. ការអានសំណួរឱ្យច្បាស់ និងការកាត់ចម្លើយខុសចេញ (Elimination)', 'B. ការទាយចៃដន្យដោយមិនពិចារណា', 'C. ការជ្រើសតែចម្លើយដែលវែងជាងគេ', 'D. ការទុកចោលមិនឆ្លើយ'],
          answerIndex: 0,
          explanation: 'បច្ចេកទេសកាត់ចម្លើយខុស (Elimination Method) ជួយបង្កើនឱកាសជ្រើសរើសចម្លើយត្រឹមត្រូវរហូតដល់ ៨០% ឡើងទៅ។'
        },
        {
          question: 'តើសៀវភៅនេះផ្តល់អត្ថប្រយោជន៍អ្វីខ្លះដល់អ្នកត្រៀមប្រឡង?',
          options: ['A. វិញ្ញាសាស្របតាមក្រសួង + ចម្លើយពន្យល់លម្អិត ១០០%', 'B. គ្រាន់តែជាកម្រងសំណួរគ្មានចម្លើយ', 'C. គ្មានការពន្យល់', 'D. ព័ត៌មានចាស់ហួសសម័យ'],
          answerIndex: 0,
          explanation: 'សៀវភៅនេះចងក្រងឡើងដោយសាស្រ្តាចារ្យជំនាញ មានចម្លើយផ្ទៀងផ្ទាត់ត្រឹមត្រូវ និងគន្លឹះដោះស្រាយច្បាស់លាស់។'
        }
      ]
    };
  }

  /**
   * Free Sample Preview & Interactive QCM Quiz
   */
  public static async handleProductSample(chatId: number | string, productId: string, questionIdx = 0, messageIdToEdit?: number) {
    const product = db.getProducts().find(p => p.id === productId);
    if (!product) {
      await this.sendMessage(chatId, '❌ រកមិនឃើញសៀវភៅនេះឡើយ។');
      return;
    }

    const sampleData = this.getProductSampleQuestions(product);
    const questions = sampleData.questions;
    const currentQ = questions[questionIdx] || questions[0];

    let text = `📖 <b>គំរូសៀវភៅ & វិញ្ញាសាសាកល្បង (SAMPLE PREVIEW)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📚 <b>សៀវភៅ៖</b> <b>${product.name}</b>\n` +
      (product.author ? `🖋️ <b>អ្នកនិពន្ធ៖</b> ${product.author}\n` : '') +
      `💰 <b>តម្លៃ៖</b> <code>$${product.price.toFixed(2)} USD</code>\n\n` +
      `${sampleData.previewText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 <b>សំណួរគំរូសាកល្បងទី ${questionIdx + 1}/${questions.length}៖</b>\n\n` +
      `❓ <b>${currentQ.question}</b>\n\n` +
      `👇 <i>សូមជ្រើសរើសចម្លើយត្រឹមត្រូវខាងក្រោម ដើម្បីផ្ទៀងផ្ទាត់៖</i>`;

    const inline_keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

    // Add option buttons
    currentQ.options.forEach((opt, optIdx) => {
      inline_keyboard.push([
        { text: opt, callback_data: `quiz_${productId}_${questionIdx}_${optIdx}` }
      ]);
    });

    // Action buttons
    inline_keyboard.push([
      { text: `🛒 កម្មង់ទិញសៀវភៅពេញ ($${product.price.toFixed(2)})`, callback_data: `order_checkout_${productId}_1` }
    ]);
    inline_keyboard.push([
      { text: '🔙 ត្រឡប់ទៅមើលសៀវភៅ', callback_data: `prod_view_${productId}` }
    ]);

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
   * Handle user answering a sample QCM question
   */
  public static async handleSampleQuizAnswer(
    chatId: number | string,
    productId: string,
    questionIdx: number,
    chosenOption: number,
    messageIdToEdit?: number
  ) {
    const product = db.getProducts().find(p => p.id === productId);
    if (!product) return;

    const sampleData = this.getProductSampleQuestions(product);
    const questions = sampleData.questions;
    const currentQ = questions[questionIdx] || questions[0];
    const isCorrect = chosenOption === currentQ.answerIndex;

    let text = `📝 <b>លទ្ធផលនៃការសាកល្បងសំណួរទី ${questionIdx + 1}/${questions.length}</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (isCorrect) {
      text += `🎉 <b>ចម្លើយត្រឹមត្រូវ! (EXCELLENT)</b> ✅\n\n` +
        `• ចម្លើយរបស់លោកអ្នក៖ <b>${currentQ.options[chosenOption]}</b>\n\n` +
        `💡 <b>គន្លឹះ និងការពន្យល់៖</b>\n${currentQ.explanation}\n`;
    } else {
      text += `❌ <b>មិនទាន់ត្រឹមត្រូវទេ! (INCORRECT)</b>\n\n` +
        `• ចម្លើយរបស់លោកអ្នក៖ ${currentQ.options[chosenOption]}\n` +
        `• <b>ចម្លើយពិតប្រាកដគឺ៖</b> <b>${currentQ.options[currentQ.answerIndex]}</b> ✅\n\n` +
        `💡 <b>គន្លឹះ និងការពន្យល់៖</b>\n${currentQ.explanation}\n`;
    }

    text += `\n✨ <i>នៅក្នុងសៀវភៅពេញលេញ មានកម្រងសំណួរ QCM ជាង ១,០០០ សំណួរ និងគន្លឹះដោះស្រាយលម្អិត ១០០% បែបនេះ!</i>`;

    const inline_keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

    // Next question button if available
    if (questionIdx + 1 < questions.length) {
      inline_keyboard.push([
        { text: `➡️ សំណួរគំរូបន្ទាប់ (${questionIdx + 2}/${questions.length})`, callback_data: `sample_next_${productId}_${questionIdx + 1}` }
      ]);
    }

    inline_keyboard.push([
      { text: `🛒 កម្មង់ទិញសៀវភៅពេញ ($${product.price.toFixed(2)})`, callback_data: `order_checkout_${productId}_1` }
    ]);

    inline_keyboard.push([
      { text: '🔙 ត្រឡប់ទៅមើលសៀវភៅ', callback_data: `prod_view_${productId}` }
    ]);

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
   * Support Information & Direct Admin Contact
   */
  public static async sendSupport(chatId: number | string) {
    const settings = db.getSettings();
    const supportUser = settings.supportUsername || 'yoeurnhoeurn';
    const supportPhone = settings.supportPhone || '087301610';

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
    const supportUser = settings.supportUsername || 'yoeurnhoeurn';

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
    const settings = db.getSettings();
    const khrRate = settings.khrExchangeRate || 4100;

    text += `├ 💰 <b>តម្លៃឯកតា៖</b> <code>${formatDualPrice(product.price, khrRate)}</code>\n`;
    text += `├ 📦 <b>ស្ថានភាពស្តុក៖</b> <b>${stockStatus}</b>\n`;
    text += `└ 🚚 <b>ការទទួលសៀវភៅ៖</b> ${deliveryInfo}\n\n`;

    text += `📝 <b>ខ្លឹមសារសង្ខេប៖</b>\n${product.description}\n`;

    if (product.bulkPricingEnabled && product.tiers && product.tiers.length > 0) {
      text += `\n🏷️ <b>តារាងបញ្ចុះតម្លៃទិញច្រើន (Bulk Discounts):</b>\n`;
      for (const t of product.tiers) {
        const range = t.maxQty ? `${t.minQty} - ${t.maxQty}` : `ចាប់ពី ${t.minQty} ឡើងទៅ`;
        text += `• ទិញ ${range} ${unitLabel}៖ <code>${formatDualPrice(t.pricePerUnit, khrRate)} / ${unitLabel}</code>\n`;
      }
    }

    text += `\n🛒 <b>ការបញ្ជាទិញបច្ចុប្បន្ន៖</b>\n`;
    text += `┌ 🔢 <b>បរិមាណជ្រើសរើស៖</b> <b>${validQty} ${unitLabel}</b>\n`;
    text += `└ 💵 <b>ទឹកប្រាក់សរុប៖</b> <code>${formatDualPrice(pricing.totalAmount, khrRate)}</code>`;
    if (pricing.isDiscounted) {
      text += ` <i>(បានបញ្ចុះតម្លៃដុំ ${formatDualPrice(pricing.unitPrice, khrRate)}/${unitLabel})</i>`;
    }

    const nextDec = Math.max(1, validQty - 1);
    const nextInc = availableStock > 0 ? Math.min(availableStock, validQty + 1) : validQty + 1;
    const supportUser = settings.supportUsername || 'yoeurnhoeurn';
    const userCart = this.getCart(chatId);
    const cartCount = userCart.reduce((sum, item) => sum + item.qty, 0);

    const inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
      [
        { text: '➖', callback_data: `qty_adj_${productId}_${nextDec}` },
        { text: `🛒 ចំនួន៖ ${validQty} ${unitLabel}`, callback_data: `qty_info_${validQty}` },
        { text: '➕', callback_data: `qty_adj_${productId}_${nextInc}` }
      ],
      [
        {
          text: availableStock >= validQty
            ? `💳 ទិញភ្លាមៗ (${formatDualPrice(pricing.totalAmount, khrRate)})`
            : `❌ អស់ស្តុកមិនអាចទិញបាន`,
          callback_data: availableStock >= validQty
            ? `order_checkout_${productId}_${validQty}`
            : `qty_info_outofstock`
        }
      ],
      [
        { text: `➕ ដាក់ចូលកន្ត្រក (${validQty} ${unitLabel})`, callback_data: `cart_add_${productId}_${validQty}` },
        { text: `🛍️ មើលកន្ត្រក (${cartCount})`, callback_data: `cart_view` }
      ],
      [
        { text: '👀 មើលគំរូ & សាកល្បង QCM', callback_data: `prod_sample_${productId}` },
        { text: '💬 សាកសួរ Admin', url: `https://t.me/${supportUser}` }
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
   * Cart System: View user's cart
   */
  public static async sendCartView(chatId: number | string, messageIdToEdit?: number) {
    const cart = this.getCart(chatId);
    const settings = db.getSettings();
    const khrRate = settings.khrExchangeRate || 4100;

    if (cart.length === 0) {
      const emptyMsg = `🛍️ <b>កន្ត្រកទំនិញរបស់អ្នកទទេស្អាត! (EMPTY CART)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `លោកអ្នកមិនទាន់បានដាក់សៀវភៅចូលក្នុងកន្ត្រកនៅឡើយទេ។\n\n` +
        `👇 សូមចូលទៅកាន់កាតាឡុកសៀវភៅ រួចចុច <b>[➕ ដាក់ចូលកន្ត្រក]</b> ដើម្បីជ្រើសរើសសៀវភៅជាច្រើនក្បាលក្នុងពេលតែមួយ!`;

      const inline_keyboard = [
        [{ text: '📚 ទៅកាន់បញ្ជីសៀវភៅ (Catalog)', callback_data: 'catalog_menu' }],
        [{ text: '🏠 Menu ដើម', callback_data: 'menu_main' }]
      ];

      if (messageIdToEdit) {
        const edited = await this.editMessageText(chatId, messageIdToEdit, emptyMsg, {
          reply_markup: { inline_keyboard },
          parse_mode: 'HTML'
        });
        if (edited) return;
      }

      await this.sendMessage(chatId, emptyMsg, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML'
      });
      return;
    }

    const products = db.getProducts();
    let subtotal = 0;
    let totalQty = 0;
    let hasHardcopy = false;

    let msg = `🛍️ <b>កន្ត្រកទំនិញរបស់អ្នក (YOUR CART)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;

    const inline_keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

    cart.forEach((item, idx) => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return;
      const isPrinted = prod.bookFormat === 'printed';
      if (isPrinted) hasHardcopy = true;
      const lineTotal = prod.price * item.qty;
      subtotal += lineTotal;
      totalQty += item.qty;
      const icon = isPrinted ? '📖' : '📄';

      msg += `<b>${idx + 1}. ${icon} ${prod.name}</b>\n` +
        `   └ បរិមាណ៖ <b>${item.qty}</b> x $${prod.price.toFixed(2)} = <code>$${lineTotal.toFixed(2)} USD</code>\n`;

      inline_keyboard.push([
        { text: `➖`, callback_data: `cart_dec_${item.productId}` },
        { text: `${prod.name.slice(0, 15)} (${item.qty})`, callback_data: `cart_info_${item.productId}` },
        { text: `➕`, callback_data: `cart_inc_${item.productId}` },
        { text: `❌`, callback_data: `cart_rem_${item.productId}` }
      ]);
    });

    const ppFee = settings.shippingFeePhnomPenh !== undefined ? settings.shippingFeePhnomPenh : 1.25;
    const provFee = settings.shippingFeeProvince !== undefined ? settings.shippingFeeProvince : 1.75;
    const freeThreshold = settings.freeShippingThreshold !== undefined ? settings.freeShippingThreshold : 15.0;

    msg += `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `┌ 🔢 <b>ចំនួនសៀវភៅសរុប៖</b> <b>${totalQty} ក្បាល/ច្បាប់</b>\n` +
      `├ 💵 <b>សរុបបណ្តោះអាសន្ន (Subtotal)៖</b> <code>${formatDualPrice(subtotal, khrRate)}</code>\n`;

    if (hasHardcopy) {
      if (subtotal >= freeThreshold) {
        msg += `└ 🚚 <b>ថ្លៃដឹកជញ្ជូន៖</b> 🎉 <b>ឥតគិតថ្លៃ (Free Delivery &gt;= $${freeThreshold.toFixed(2)})</b>\n`;
      } else {
        msg += `└ 🚚 <b>ថ្លៃដឹកជញ្ជូន៖</b> ភ្នំពេញ <code>$${ppFee.toFixed(2)}</code> | ខេត្ត <code>$${provFee.toFixed(2)}</code> (ទិញចាប់ពី $${freeThreshold.toFixed(2)} Free!)\n`;
      }
    } else {
      msg += `└ ⚡ <b>ការដឹកជញ្ជូន៖</b> ទាញយក PDF អានភ្លាមៗ 24/7 (ឥតគិតថ្លៃដឹក)\n`;
    }

    msg += `\n👇 <i>លោកអ្នកអាចកែសម្រួលចំនួន ឬចុចបន្តទៅទូទាត់កន្ត្រក៖</i>`;

    inline_keyboard.push([
      { text: `💳 ទូទាត់កន្ត្រក (${formatDualPrice(subtotal, khrRate)})`, callback_data: `cart_checkout` }
    ]);
    inline_keyboard.push([
      { text: `📚 បន្ថែមសៀវភៅទៀត`, callback_data: `catalog_menu` },
      { text: `🗑️ សម្អាតកន្ត្រក`, callback_data: `cart_clear` }
    ]);
    inline_keyboard.push([
      { text: '🏠 Menu ដើម', callback_data: 'menu_main' }
    ]);

    if (messageIdToEdit) {
      const edited = await this.editMessageText(chatId, messageIdToEdit, msg, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML'
      });
      if (edited) return;
    }

    await this.sendMessage(chatId, msg, {
      reply_markup: { inline_keyboard },
      parse_mode: 'HTML'
    });
  }

  /**
   * Cart Checkout - Initiates delivery flow if cart has printed books, or direct checkout
   */
  public static async handleCartCheckout(chatId: number | string, username: string, firstName: string) {
    const cart = this.getCart(chatId);
    if (cart.length === 0) {
      await this.sendMessage(chatId, '🛍️ កន្ត្រកទំនិញរបស់អ្នកទទេស្អាត។ សូមជ្រើសរើសសៀវភៅជាមុនសិន!');
      return;
    }

    const products = db.getProducts();
    const hasHardcopy = cart.some(item => {
      const prod = products.find(p => p.id === item.productId);
      return prod?.bookFormat === 'printed';
    });

    if (hasHardcopy) {
      const totalAmount = cart.reduce((sum, item) => {
        const prod = products.find(p => p.id === item.productId);
        return sum + (prod ? prod.price * item.qty : 0);
      }, 0);

      this.customerStates.set(String(chatId), {
        step: 'awaiting_shipping_name',
        data: {
          isCart: true,
          username,
          firstName,
          totalAmount
        }
      });

      const promptText = `📦 <b>ការទូទាត់កន្ត្រកសៀវភៅ (CART ORDER)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `កន្ត្រករបស់អ្នកមានសៀវភៅក្រដាស (Hardcopy)។ យើងខ្ញុំផ្ញើជូនតាមរយៈ <b>VET Express / J&T Express</b> ឬអ្នកដឹកជញ្ជូនដល់ផ្ទះក្នុងរាជធានីភ្នំពេញ។\n\n` +
        `📝 <b>ជំហានទី ១/៥៖</b> សូមវាយបញ្ចូល <b>ឈ្មោះពេញរបស់អ្នកទទួល</b> (ឧ. លោក សុខ ចិន្តា)៖`;

      const inline_keyboard: any[] = [];
      if (firstName && firstName !== 'User' && firstName !== 'Customer') {
        inline_keyboard.push([{ text: `👉 ប្រើឈ្មោះ "${firstName}"`, callback_data: `ship_name_self` }]);
      }
      inline_keyboard.push([{ text: '❌ បោះបង់ការទិញ', callback_data: 'ship_cancel' }]);

      await this.sendMessage(chatId, promptText, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML'
      });
      return;
    }

    await this.finalizeCartCheckout(chatId, username, firstName);
  }

  /**
   * Finalize Cart Checkout & generate unified KHQR Invoice
   */
  public static async finalizeCartCheckout(
    chatId: number | string,
    username: string,
    firstName: string,
    shippingInfo?: {
      shippingRecipient?: string;
      shippingPhone?: string;
      shippingAddress?: string;
      shippingSpeed?: 'standard' | 'express';
      shippingNotes?: string;
      shippingLocation?: { latitude: number; longitude: number; googleMapsUrl?: string };
      province?: string;
      branch?: string;
      courierService?: string;
    }
  ) {
    const cart = this.getCart(chatId);
    if (cart.length === 0) return;

    const products = db.getProducts();
    const orderItems: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; bookFormat?: string }> = [];
    let subtotal = 0;
    let totalQty = 0;
    let hasHardcopy = false;

    for (const item of cart) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) continue;
      const isPrinted = prod.bookFormat === 'printed';
      if (isPrinted) hasHardcopy = true;
      const available = db.getAvailableStockCount(prod.id);
      if (available < item.qty) {
        await this.sendMessage(chatId, `⚠️ សៀវភៅ <b>${prod.name}</b> នៅសល់តែ <b>${available}</b> ប៉ុណ្ណោះ។ សូមកែសម្រួលចំនួនក្នុងកន្ត្រក!`, { parse_mode: 'HTML' });
        return;
      }
      const lineTotal = prod.price * item.qty;
      subtotal += lineTotal;
      totalQty += item.qty;
      orderItems.push({
        productId: prod.id,
        productName: prod.name,
        quantity: item.qty,
        unitPrice: prod.price,
        bookFormat: prod.bookFormat || 'pdf'
      });
    }

    const settings = db.getSettings();
    const expiryMinutes = settings.qrExpiryMinutes || 5;
    const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    for (const item of cart) {
      db.reserveStock(item.productId, item.qty, orderId, expiryMinutes);
    }

    let shippingFee = 0;
    if (hasHardcopy) {
      const freeThreshold = settings.freeShippingThreshold !== undefined ? settings.freeShippingThreshold : 15.0;
      if (subtotal >= freeThreshold) {
        shippingFee = 0;
      } else if (shippingInfo?.shippingSpeed === 'express') {
        shippingFee = settings.shippingFeeSameDay !== undefined ? settings.shippingFeeSameDay : 2.00;
      } else {
        const isPP = (shippingInfo?.shippingAddress || '').includes('ភ្នំពេញ') ||
          (shippingInfo?.province || '').includes('ភ្នំពេញ') ||
          (shippingInfo?.courierService || '').includes('Phnom Penh');
        const ppFee = settings.shippingFeePhnomPenh !== undefined ? settings.shippingFeePhnomPenh : 1.25;
        const provFee = settings.shippingFeeProvince !== undefined ? settings.shippingFeeProvince : 1.75;
        shippingFee = isPP ? ppFee : provFee;
      }
    }

    const finalTotalAmount = Number((subtotal + shippingFee).toFixed(2));
    const khrRate = settings.khrExchangeRate || 4100;
    const totalAmountKhr = Math.round(finalTotalAmount * khrRate);

    const numericId = typeof chatId === 'number' ? chatId : parseInt(String(chatId), 10) || 10001;
    const customer = db.upsertCustomer(numericId, username, firstName);

    if (shippingInfo) {
      if (shippingInfo.shippingPhone && !customer.phone) customer.phone = shippingInfo.shippingPhone;
      if (shippingInfo.shippingAddress && !customer.defaultShippingAddress) customer.defaultShippingAddress = shippingInfo.shippingAddress;
      db.saveData();
    }

    const payment = await CutLuyService.createPayment(orderId, finalTotalAmount);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    const firstItem = orderItems[0];
    const orderTitle = orderItems.length > 1
      ? `${firstItem.productName} (+${orderItems.length - 1} មុខទៀត)`
      : firstItem.productName;

    const newOrder: Order = {
      id: orderId,
      referenceId: orderId,
      telegramId: String(chatId),
      telegramUsername: username || 'User',
      customerName: firstName || 'Customer',
      productId: firstItem.productId,
      productName: orderTitle,
      quantity: totalQty,
      unitPrice: firstItem.unitPrice,
      subtotal,
      shippingFee: hasHardcopy ? shippingFee : 0,
      discountAmount: 0,
      couponCode: null,
      totalAmount: finalTotalAmount,
      totalAmountKhr,
      items: orderItems,
      status: 'pending',
      paymentProvider: 'cutluy',
      cutluyPaymentId: payment.paymentId,
      checkoutUrl: payment.checkoutUrl || null,
      qrString: payment.qrString,
      qrImageDataUrl: payment.qrDataUrl,
      expiresAt,
      deliveredItems: [],
      referralTelegramId: customer.referredBy || null,
      commissionEarned: customer.referredBy ? (settings.referralCommissionPerAccount * totalQty) : 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      bookFormat: hasHardcopy ? 'printed' : 'pdf',
      shippingRecipient: hasHardcopy ? (shippingInfo?.shippingRecipient || customer.firstName) : undefined,
      shippingPhone: hasHardcopy ? (shippingInfo?.shippingPhone || customer.phone) : undefined,
      shippingAddress: hasHardcopy ? (shippingInfo?.shippingAddress || customer.defaultShippingAddress) : undefined,
      shippingSpeed: hasHardcopy ? shippingInfo?.shippingSpeed : undefined,
      shippingNotes: hasHardcopy ? shippingInfo?.shippingNotes : undefined,
      shippingLocation: hasHardcopy ? shippingInfo?.shippingLocation : undefined,
      province: hasHardcopy ? shippingInfo?.province : undefined,
      branch: hasHardcopy ? shippingInfo?.branch : undefined,
      courierService: hasHardcopy ? (shippingInfo?.courierService || 'VET/J&T/Phnom Penh') : undefined,
      shippingStatus: hasHardcopy ? 'pending' : undefined
    };

    db.addOrder(newOrder);
    this.clearCart(chatId);

    let caption = `🇰🇭 <b>វិក្កយបត្របង់ប្រាក់ KHQR ស្វ័យប្រវត្ត (OFFICIAL INVOICE)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `┌ 🔖 <b>លេខវិក្កយបត្រ៖</b> <code>#${orderId}</code>\n` +
      `├ 📚 <b>សៀវភៅក្នុងកន្ត្រក៖</b> <b>${orderItems.length} មុខ (${totalQty} ក្បាល/ច្បាប់)</b>\n`;

    orderItems.forEach((it, idx) => {
      caption += `│  • ${idx + 1}. ${it.productName} (x${it.quantity})\n`;
    });

    caption += `├ 💵 <b>ថ្លៃទំនិញ (Subtotal)៖</b> $${subtotal.toFixed(2)} USD\n`;
    if (hasHardcopy) {
      caption += `├ 🚚 <b>ថ្លៃដឹកជញ្ជូន៖</b> ${shippingFee > 0 ? `$${shippingFee.toFixed(2)} USD` : '🎉 ឥតគិតថ្លៃ (Free Delivery)'}\n`;
    }
    caption += `├ 💰 <b>ទឹកប្រាក់ត្រូវទូទាត់សរុប៖</b> <code>${formatDualPrice(finalTotalAmount, khrRate)}</code>\n`;

    if (hasHardcopy && newOrder.shippingRecipient) {
      caption += `├ 👤 <b>អ្នកទទួល៖</b> <b>${newOrder.shippingRecipient}</b>\n` +
        `├ 📞 <b>លេខទូរស័ព្ទ៖</b> <code>${newOrder.shippingPhone}</code>\n` +
        `├ 🚚 <b>សេវាដឹក៖</b> <b>${newOrder.courierService || 'ខាងដឹកជញ្ជូន'}</b>${newOrder.shippingSpeed === 'express' ? ' ⚡ (Same-Day)' : ''}\n` +
        `├ 📍 <b>អាសយដ្ឋានដឹក៖</b> <b>${newOrder.shippingAddress}</b>\n` +
        (newOrder.shippingNotes ? `├ 📝 <b>ចំណាំអ្នកដឹក៖</b> <i>${newOrder.shippingNotes}</i>\n` : '');
    }

    caption += `└ ⏱️ <b>សុពលភាព KHQR៖</b> <b>${expiryMinutes} នាទី</b>\n\n` +
      `📌 <b>ជម្រើសនៃការទូទាត់ប្រាក់៖</b>\n` +
      `1. <b>ស្កេន KHQR</b> ខាងលើជាមួយ App ធនាគារ (Bakong, ABA, Wing, ACLEDA...)\n` +
      `2. <b>ឬផ្ញើរូបភាពវិក្កយបត្របង់ប្រាក់ (Payment Slip)</b> ចូលក្នុង Chat នេះ ដើម្បីឱ្យ Admin បញ្ជាក់ភ្លាមៗ! ⚡\n`;

    const supportUser = settings.supportUsername || 'yoeurnhoeurn';
    const bakongDeepLink = payment.checkoutUrl || `https://link.payway.com.kh/checkout?qr=${encodeURIComponent(payment.qrString || orderId)}`;
    const inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
      [
        { text: '📲 បើកក្នុង ABA / Bakong App', url: bakongDeepLink },
        { text: '🔄 ពិនិត្យការទូទាត់ (Check)', callback_data: `check_pay_${orderId}` }
      ],
      [
        { text: '💬 ជំនួយ Admin', url: `https://t.me/${supportUser}` },
        { text: '❌ បោះបង់ (Cancel)', callback_data: `cancel_order_${orderId}` }
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
      `📝 <b>ជំហានទី ១/៥៖</b> សូមវាយបញ្ចូល <b>ឈ្មោះពេញរបស់អ្នកទទួល</b> (ឧ. លោក សុខ ចិន្តា)៖`;

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
   * Prompt Phnom Penh Delivery: GPS Drop Pin & Khan picker
   */
  public static async promptPhnomPenhLocation(chatId: number | string, speed: 'standard' | 'express') {
    const speedLabel = speed === 'express' ? '⚡ ភ្នំពេញបន្ទាន់ក្នុងថ្ងៃ (Same-Day Express)' : '🚚 ភ្នំពេញធម្មតា (Standard Next-Day)';
    const msg = `📍 <b>ជំហានទី ៤/៥៖ អាសយដ្ឋាន ឬ Drop Pin GPS (ភ្នំពេញ)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <b>សេវាដឹក៖</b> <b>${speedLabel}</b>\n\n` +
      `លោកអ្នកអាចផ្ញើ <b>ទីតាំង GPS (Drop Pin)</b> តាមរយៈប៊ូតុងខាងក្រោម ឬជ្រើសរើសខណ្ឌ ឬវាយបញ្ចូលផ្ទះលេខ ផ្លូវ សង្កាត់ ខណ្ឌ៖`;

    // Reply keyboard with native GPS location button
    const locationKeyboard = {
      keyboard: [
        [{ text: '📍 ផ្ញើទីតាំង GPS របស់ខ្ញុំ (Drop Pin)', request_location: true }],
        [{ text: '❌ បោះបង់' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    };

    await this.sendMessage(chatId, msg, {
      reply_markup: locationKeyboard,
      parse_mode: 'HTML'
    });

    // Quick Khan selector
    const khanKeyboard = {
      inline_keyboard: [
        [
          { text: '📍 ខណ្ឌទួលគោក', callback_data: 'ship_khan_ទួលគោក' },
          { text: '📍 ខណ្ឌចំការមន', callback_data: 'ship_khan_ចំការមន' }
        ],
        [
          { text: '📍 ខណ្ឌដូនពេញ', callback_data: 'ship_khan_ដូនពេញ' },
          { text: '📍 ខណ្ឌ៧មករា', callback_data: 'ship_khan_៧មករា' }
        ],
        [
          { text: '📍 ខណ្ឌសែនសុខ', callback_data: 'ship_khan_សែនសុខ' },
          { text: '📍 ខណ្ឌមានជ័យ', callback_data: 'ship_khan_មានជ័យ' }
        ],
        [
          { text: '📍 ខណ្ឌពោធិ៍សែនជ័យ', callback_data: 'ship_khan_ពោធិ៍សែនជ័យ' },
          { text: '📍 ខណ្ឌបឹងកេងកង', callback_data: 'ship_khan_បឹងកេងកង' }
        ],
        [
          { text: '❌ បោះបង់', callback_data: 'ship_cancel' }
        ]
      ]
    };

    await this.sendMessage(chatId, `<i>👇 ឬចុចជ្រើសរើសខណ្ឌរហ័សខាងក្រោម៖</i>`, {
      reply_markup: khanKeyboard,
      parse_mode: 'HTML'
    });
  }

  /**
   * Interactive Province Picker (Cambodia 24 Provinces) for VET and J&T Express
   */
  public static async promptProvincePicker(chatId: number | string, courier: string, page = 0) {
    const pageSize = 8;
    const totalPages = Math.ceil(CAMBODIA_PROVINCES.length / pageSize);
    const startIdx = page * pageSize;
    const currentProvinces = CAMBODIA_PROVINCES.slice(startIdx, startIdx + pageSize);

    const msg = `🏢 <b>ជំហានទី ៤/៥៖ ជ្រើសរើសខេត្តទទួល (${courier})</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `សូមចុចជ្រើសរើសខេត្តដែលលោកអ្នកចង់ទទួលកញ្ចប់សៀវភៅ (ទំព័រ ${page + 1}/${totalPages})៖\n\n` +
      `<i>* ប្រព័ន្ធគាំទ្រគ្រប់ ២៤ ខេត្តទូទាំងប្រទេសកម្ពុជា។</i>`;

    const inline_keyboard: any[][] = [];
    for (let i = 0; i < currentProvinces.length; i += 2) {
      const row: any[] = [];
      row.push({
        text: `📍 ${currentProvinces[i].name}`,
        callback_data: `ship_prov_${currentProvinces[i].id}`
      });
      if (i + 1 < currentProvinces.length) {
        row.push({
          text: `📍 ${currentProvinces[i + 1].name}`,
          callback_data: `ship_prov_${currentProvinces[i + 1].id}`
        });
      }
      inline_keyboard.push(row);
    }

    const navRow: any[] = [];
    if (page > 0) {
      navRow.push({ text: '⬅️ ទំព័រមុន', callback_data: `ship_prov_page_${page - 1}` });
    }
    if (page + 1 < totalPages) {
      navRow.push({ text: 'ទំព័របន្ទាប់ ➡️', callback_data: `ship_prov_page_${page + 1}` });
    }
    if (navRow.length > 0) inline_keyboard.push(navRow);

    inline_keyboard.push([{ text: '❌ បោះបង់ការទិញ', callback_data: 'ship_cancel' }]);

    await this.sendMessage(chatId, msg, {
      reply_markup: { inline_keyboard },
      parse_mode: 'HTML'
    });
  }

  /**
   * Interactive Branch Picker for selected Province
   */
  public static async promptBranchPicker(chatId: number | string, courier: string, provinceName: string) {
    const msg = `🏢 <b>ជ្រើសរើសសាខា ${courier} (${provinceName})</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 <b>ខេត្ត៖</b> <b>${provinceName}</b>\n\n` +
      `សូមចុចជ្រើសរើសសាខាខាងក្រោម ឬវាយបញ្ចូលឈ្មោះសាខាជាក់លាក់ (ឧ. សាខាផ្សារលើ, សាខាក្រុង, សាខាស្រុកពួក)៖`;

    const inline_keyboard: any[][] = [
      [
        { text: `🏢 សាខាក្រុង / ទីរួមខេត្ត`, callback_data: `ship_branch_town` },
        { text: `🏪 សាខាផ្សារធំ / ផ្សារលើ`, callback_data: `ship_branch_market` }
      ],
      [
        { text: `🚌 សាខាបេនឡាន`, callback_data: `ship_branch_bus` },
        { text: `🔄 ប្តូរខេត្តឡើងវិញ`, callback_data: `ship_prov_back` }
      ],
      [
        { text: '❌ បោះបង់', callback_data: 'ship_cancel' }
      ]
    ];

    await this.sendMessage(chatId, msg, {
      reply_markup: { inline_keyboard },
      parse_mode: 'HTML'
    });
  }

  /**
   * Prompt Note to Rider / Delivery Instructions (Step 5 of 5)
   */
  public static async promptRiderNotes(chatId: number | string, data: any) {
    const courier = data.courierService || 'ខាងដឹកជញ្ជូន';
    const msg = `📝 <b>ជំហានទី ៥/៥៖ ចំណាំបន្ថែមសម្រាប់អ្នកដឹក (NOTE TO RIDER)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>អ្នកទទួល៖</b> <b>${data.shippingRecipient}</b>\n` +
      `📞 <b>លេខទូរស័ព្ទ៖</b> <code>${data.shippingPhone}</code>\n` +
      `🚚 <b>សេវាដឹក៖</b> <b>${courier}</b>\n` +
      `📍 <b>ទីតាំង/សាខា៖</b> ${data.shippingAddress}\n\n` +
      `តើលោកអ្នកមានចំណាំអ្វីបន្ថែមជូនអ្នកដឹកជញ្ជូនទេ? (ឧ. 'ដឹកពេលរសៀល', 'ខលមុនមកដល់ 15 នាទី', 'ដាក់មុខទ្វាររបង', 'លេខទូរស័ព្ទបម្រុង 012...')\n\n` +
      `👇 <i>សូមជ្រើសរើសជម្រើសរហ័សខាងក្រោម ឬចុច [⏭️ គ្មានចំណាំ (Skip)] ប្រសិនបើគ្មានចំណាំ៖</i>`;

    const inline_keyboard = [
      [
        { text: '📞 ខលមុន 15 នាទី', callback_data: 'ship_note_call15' },
        { text: '☀️ ដឹកពេលរសៀល', callback_data: 'ship_note_afternoon' }
      ],
      [
        { text: '🏠 ទុកមុខផ្ទះ/របង', callback_data: 'ship_note_gate' },
        { text: '⏭️ គ្មានចំណាំ (Skip)', callback_data: 'ship_note_skip' }
      ],
      [
        { text: '❌ បោះបង់', callback_data: 'ship_cancel' }
      ]
    ];

    await this.sendMessage(chatId, msg, {
      reply_markup: { inline_keyboard },
      parse_mode: 'HTML'
    });
  }

  /**
   * Complete Shipping Checkout after all 5 steps are fulfilled
   */
  public static async completeShippingCheckout(chatId: number | string, user: any, sessionData: any, note?: string) {
    this.customerStates.delete(String(chatId));
    if (note) {
      sessionData.shippingNotes = note;
    }

    const shippingInfo = {
      shippingRecipient: sessionData.shippingRecipient,
      shippingPhone: sessionData.shippingPhone,
      shippingAddress: sessionData.shippingAddress,
      shippingSpeed: sessionData.shippingSpeed,
      shippingNotes: sessionData.shippingNotes,
      shippingLocation: sessionData.shippingLocation,
      province: sessionData.province,
      branch: sessionData.branch,
      courierService: sessionData.courierService
    };

    if (sessionData.isCart) {
      await this.finalizeCartCheckout(
        chatId,
        user.username || sessionData.username,
        user.first_name || sessionData.firstName,
        shippingInfo
      );
    } else {
      await this.handleCheckout(
        chatId,
        sessionData.productId,
        sessionData.quantity,
        user.username || sessionData.username,
        user.first_name || sessionData.firstName,
        shippingInfo
      );
    }
  }

  /**
   * Handle native Telegram Location message (Drop Pin GPS)
   */
  public static async handleLocationMessage(
    chatId: number | string,
    location: { latitude: number; longitude: number },
    user: any
  ) {
    const session = this.customerStates.get(String(chatId));
    if (!session || (session.step !== 'awaiting_shipping_address_pp' && session.step !== 'awaiting_shipping_address')) {
      await this.sendMessage(chatId, '📍 ទទួលបានទីតាំង GPS! ប្រសិនបើលោកអ្នកចង់ទិញសៀវភៅ សូមចុចលើ [🛒 ទិញសៀវភៅ] ជាមុនសិន។', {
        reply_markup: this.getMainReplyKeyboard()
      });
      return;
    }

    const { latitude, longitude } = location;
    const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    session.data.shippingLocation = { latitude, longitude, googleMapsUrl };
    session.data.shippingAddress = `ភ្នំពេញ (GPS Pin: ${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
    session.data.province = 'រាជធានីភ្នំពេញ';

    // Proceed to Step 5: Rider Notes
    session.step = 'awaiting_shipping_notes';
    await this.promptRiderNotes(chatId, session.data);
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
      return false;
    }

    // Step 1: awaiting_shipping_name
    if (session.step === 'awaiting_shipping_name') {
      session.data.shippingRecipient = raw;
      session.step = 'awaiting_shipping_phone';

      const numericId = typeof chatId === 'number' ? chatId : parseInt(String(chatId), 10) || 10001;
      const customer = db.getCustomerByTelegramId(numericId);

      const phonePrompt = `📞 <b>ជំហានទី ២/៥៖ លេខទូរស័ព្ទទំនាក់ទំនង</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
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

    // Step 2: awaiting_shipping_phone with Cambodian regex validation!
    if (session.step === 'awaiting_shipping_phone') {
      if (!isValidCambodianPhone(raw)) {
        await this.sendMessage(
          chatId,
          `⚠️ <b>លេខទូរស័ព្ទមិនត្រឹមត្រូវតាមទម្រង់កម្ពុជាទេ!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
          `សូមបញ្ចូលលេខទូរស័ព្ទកម្ពុជាដែលមាន ៩ ឬ ១០ ខ្ទង់ (ឧ. 012 345 678, 098 765 432, 070 123 456, 061 234 567)៖`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '❌ បោះបង់', callback_data: 'ship_cancel' }]]
            },
            parse_mode: 'HTML'
          }
        );
        return true;
      }

      session.data.shippingPhone = raw.replace(/[\s\-\(\)]/g, '');
      session.step = 'awaiting_shipping_method';

      const settings = db.getSettings();
      const ppFee = settings.shippingFeePhnomPenh ?? 1.25;
      const sameDayFee = settings.shippingFeeSameDay ?? 2.00;
      const provFee = settings.shippingFeeProvince ?? 1.75;
      const freeThreshold = settings.freeShippingThreshold ?? 15.0;
      const isFree = (session.data.totalAmount || 0) >= freeThreshold;

      const methodPrompt = `🚚 <b>ជំហានទី ៣/៥៖ ជ្រើសរើសសេវា & ល្បឿនដឹកជញ្ជូន</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>អ្នកទទួល៖</b> <b>${session.data.shippingRecipient}</b>\n` +
        `📞 <b>ទូរស័ព្ទ៖</b> <code>${session.data.shippingPhone}</code>\n\n` +
        (isFree ? `🎉 <b>ការទិញចាប់ពី $${freeThreshold.toFixed(2)} ឡើងទៅ ដឹកជញ្ជូនឥតគិតថ្លៃ (Free Delivery)!</b>\n\n` : '') +
        `សូមជ្រើសរើសក្រុមហ៊ុនដឹកជញ្ជូន និងល្បឿនដឹកដែលចង់បាន៖`;

      const inline_keyboard = [
        [
          { text: `🚚 ភ្នំពេញ ធម្មតា (${isFree ? 'Free' : `$${ppFee.toFixed(2)}`})`, callback_data: 'ship_method_pp_std' }
        ],
        [
          { text: `⚡ ភ្នំពេញ បន្ទាន់ក្នុងថ្ងៃ (${isFree ? 'Free' : `$${sameDayFee.toFixed(2)}`})`, callback_data: 'ship_method_pp_exp' }
        ],
        [
          { text: `📦 VET Express វីរៈប៊ុនថាំ (${isFree ? 'Free' : `$${provFee.toFixed(2)}`})`, callback_data: 'ship_method_vet' }
        ],
        [
          { text: `🚀 J&T Express តាមខេត្ត (${isFree ? 'Free' : `$${provFee.toFixed(2)}`})`, callback_data: 'ship_method_jnt' }
        ],
        [
          { text: '❌ បោះបង់', callback_data: 'ship_cancel' }
        ]
      ];

      await this.sendMessage(chatId, methodPrompt, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML'
      });
      return true;
    }

    // Step 4a: awaiting_shipping_address_pp (Customer typed Phnom Penh address)
    if (session.step === 'awaiting_shipping_address_pp' || session.step === 'awaiting_shipping_address') {
      session.data.shippingAddress = raw;
      session.data.province = 'រាជធានីភ្នំពេញ';
      session.step = 'awaiting_shipping_notes';

      await this.promptRiderNotes(chatId, session.data);
      return true;
    }

    // Step 4b: awaiting_shipping_branch (Customer typed branch/district for VET/J&T)
    if (session.step === 'awaiting_shipping_branch') {
      session.data.branch = raw;
      session.data.shippingAddress = `${session.data.courierService || 'VET/J&T'} - សាខា ${raw}, ខេត្ត ${session.data.province}`;
      session.step = 'awaiting_shipping_notes';

      await this.promptRiderNotes(chatId, session.data);
      return true;
    }

    // Step 5: awaiting_shipping_notes (Customer typed rider note)
    if (session.step === 'awaiting_shipping_notes') {
      await this.completeShippingCheckout(chatId, user, session.data, raw);
      return true;
    }

    return false;
  }

  /**
   * Process customer payment slip photo/file (ABA Pay / Wing / Bakong screenshot)
   * With Late Slip Auto-Revive and Admin Team Notification!
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

    const orders = db.getOrders();
    let pendingOrder = orders.find(o =>
      (o.telegramId === strChatId || (strChatId.startsWith('sim_') && o.telegramId.startsWith('sim_'))) &&
      o.status === 'pending'
    );

    let isLateSlip = false;
    if (!pendingOrder) {
      // Find latest expired order for this customer and automatically revive it!
      const expiredOrders = orders.filter(o =>
        (o.telegramId === strChatId || (strChatId.startsWith('sim_') && o.telegramId.startsWith('sim_'))) &&
        o.status === 'expired'
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (expiredOrders.length > 0) {
        pendingOrder = expiredOrders[0];
        isLateSlip = true;
        pendingOrder.status = 'pending';
        pendingOrder.expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
        pendingOrder.adminNotes = '⚠️ LATE SLIP AUTO-REVIVED: Customer uploaded slip after expiry';
        db.saveData();
      }
    }

    if (!pendingOrder) {
      if (this.isOwnerUser(chatId, username)) {
        await this.promptOwnerBroadcast(chatId, caption || '', username, fileIdOrUrl);
        return;
      }

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

    const slipUrl = fileIdOrUrl || 'manual_slip_uploaded';
    db.updateOrder(pendingOrder.id, {
      paymentSlipUrl: slipUrl,
      adminNotes: caption ? `Slip note: ${caption}` : (isLateSlip ? '⚠️ LATE SLIP: Uploaded after expiry' : 'Customer uploaded payment slip')
    });

    const isPrinted = pendingOrder.bookFormat === 'printed';

    let confirmMsg = isLateSlip
      ? `⚠️ <b>វិក្កយបត្រផុតកំណត់ត្រូវបាន Revive ឡើងវិញ! (LATE SLIP ACCEPTED)</b>\n━━━━━━━━━━━━━━━━━━━━\n`
      : `📥 <b>ទទួលបានរូបភាពវិក្កយបត្របង់ប្រាក់ (PAYMENT SLIP)!</b>\n━━━━━━━━━━━━━━━━━━━━\n`;

    confirmMsg += `┌ 🔖 <b>លេខវិក្កយបត្រ៖</b> <code>#${pendingOrder.id}</code>\n` +
      `├ 📚 <b>សៀវភៅ៖</b> <b>${pendingOrder.productName}</b>\n` +
      `├ 🏷️ <b>ប្រភេទ៖</b> ${isPrinted ? '📖 សៀវភៅក្រដាស (Hardcopy)' : '📄 សៀវភៅ PDF (E-Book)'}\n` +
      `├ 🔢 <b>បរិមាណ៖</b> <b>${pendingOrder.quantity} ${isPrinted ? 'ក្បាល' : 'ច្បាប់'}</b>\n` +
      `└ 💵 <b>ទឹកប្រាក់៖</b> <code>$${pendingOrder.totalAmount.toFixed(2)} USD</code>\n\n` +
      (isLateSlip ? `⚡ <i>ទោះបីវិក្កយបត្របានផុតកំណត់ ប៉ុន្តែប្រព័ន្ធបានទទួលយក និងបញ្ជូនទៅ Admin ដើម្បី Approve ជូនភ្លាមៗ!</i>\n\n` : '') +
      `⏳ ក្រុមការងារកំពុងត្រួតពិនិត្យផ្ទៀងផ្ទាត់។ នៅពេល Admin ចុច Approve (យល់ព្រម)៖\n` +
      (isPrinted
        ? `• ប្រព័ន្ធនឹងបញ្ជូនកញ្ចប់សៀវភៅទៅផ្នែកដឹកជញ្ជូន VET/J&T ភ្លាមៗ!\n`
        : `• ប្រព័ន្ធនឹង <b>ផ្ញើ File PDF & តំណភ្ជាប់</b> ជូនលោកអ្នកភ្លាមៗដោយស្វ័យប្រវត្តិ! ⚡\n`) +
      `\n💬 <i>ប្រសិនបើមានសំណួរ ឬត្រូវការជំនួយបន្ទាន់ សូមចុចប៊ូតុងខាងក្រោម៖</i>`;

    const settings = db.getSettings();
    const supportUser = settings.supportUsername || 'yoeurnhoeurn';

    await this.sendMessage(chatId, confirmMsg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 ឆាតទៅកាន់ Admin Support', url: `https://t.me/${supportUser}` }],
          [{ text: '🔄 ពិនិត្យស្ថានភាពការទូទាត់', callback_data: `check_pay_${pendingOrder.id}` }]
        ]
      },
      parse_mode: 'HTML'
    });

    const adminAlertText = `${isLateSlip ? '🚨 <b>⚠️ LATE SLIP PENDING APPROVAL (វិក្កយបត្រផុតកំណត់ ត្រូវបាន Revive)!</b>' : '🔔 <b>វិក្កយបត្របង់ប្រាក់រង់ចាំការបញ្ជាក់ (SLIP PENDING APPROVAL)</b>'}\n━━━━━━━━━━━━━━━━━━━━\n` +
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

    await this.notifyAdmins(adminAlertText, {
      reply_markup: adminKeyboard,
      photoUrl: (fileIdOrUrl && !fileIdOrUrl.startsWith('manual_')) ? fileIdOrUrl : undefined
    });
  }

  /**
   * Checkout & Stock Reservation with Shipping Calculation & Dual Currency
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
      shippingSpeed?: 'standard' | 'express';
      shippingNotes?: string;
      shippingLocation?: { latitude: number; longitude: number; googleMapsUrl?: string };
      province?: string;
      branch?: string;
      courierService?: string;
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

    if (isPrinted && !shippingInfo) {
      await this.startHardcopyCheckout(chatId, productId, quantity, username, firstName);
      return;
    }

    const settings = db.getSettings();
    const expiryMinutes = settings.qrExpiryMinutes || 5;
    const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const khrRate = settings.khrExchangeRate || 4100;

    const reservedItems = db.reserveStock(productId, quantity, orderId, expiryMinutes);
    if (!reservedItems) {
      await this.sendMessage(chatId, '⚠️ ការកក់ស្តុកបរាជ័យ ដោយសារមានអតិថិជនផ្សេងកំពុងទិញក្នុងពេលដំណាលគ្នា។ សូមព្យាយាមម្តងទៀត!');
      return;
    }

    const numericId = typeof chatId === 'number' ? chatId : parseInt(String(chatId), 10) || 10001;
    const customer = db.upsertCustomer(numericId, username, firstName);
    const pricing = calculateOrderPrice(product, quantity);
    const unitLabel = isPrinted ? 'ក្បាល' : 'ច្បាប់';

    if (shippingInfo) {
      if (shippingInfo.shippingPhone && !customer.phone) {
        customer.phone = shippingInfo.shippingPhone;
      }
      if (shippingInfo.shippingAddress && !customer.defaultShippingAddress) {
        customer.defaultShippingAddress = shippingInfo.shippingAddress;
      }
      db.saveData();
    }

    // Shipping calculation for single hardcopy item
    let shippingFee = 0;
    if (isPrinted) {
      const freeThreshold = settings.freeShippingThreshold !== undefined ? settings.freeShippingThreshold : 15.0;
      if (pricing.totalAmount >= freeThreshold) {
        shippingFee = 0;
      } else if (shippingInfo?.shippingSpeed === 'express') {
        shippingFee = settings.shippingFeeSameDay !== undefined ? settings.shippingFeeSameDay : 2.00;
      } else {
        const isPP = (shippingInfo?.shippingAddress || '').includes('ភ្នំពេញ') ||
          (shippingInfo?.province || '').includes('ភ្នំពេញ') ||
          (shippingInfo?.courierService || '').includes('Phnom Penh');
        const ppFee = settings.shippingFeePhnomPenh !== undefined ? settings.shippingFeePhnomPenh : 1.25;
        const provFee = settings.shippingFeeProvince !== undefined ? settings.shippingFeeProvince : 1.75;
        shippingFee = isPP ? ppFee : provFee;
      }
    }

    const finalTotalAmount = Number((pricing.totalAmount + shippingFee).toFixed(2));
    const totalAmountKhr = Math.round(finalTotalAmount * khrRate);

    const payment = await CutLuyService.createPayment(orderId, finalTotalAmount);
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
      shippingFee: isPrinted ? shippingFee : 0,
      discountAmount: 0,
      couponCode: null,
      totalAmount: finalTotalAmount,
      totalAmountKhr,
      items: [{
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: pricing.unitPrice,
        bookFormat: product.bookFormat || 'pdf'
      }],
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
      shippingSpeed: isPrinted ? shippingInfo?.shippingSpeed : undefined,
      shippingNotes: isPrinted ? shippingInfo?.shippingNotes : undefined,
      shippingLocation: isPrinted ? shippingInfo?.shippingLocation : undefined,
      province: isPrinted ? shippingInfo?.province : undefined,
      branch: isPrinted ? shippingInfo?.branch : undefined,
      courierService: isPrinted ? (shippingInfo?.courierService || 'VET/J&T/Phnom Penh') : undefined,
      shippingStatus: isPrinted ? 'pending' : undefined
    };

    db.addOrder(newOrder);

    let caption = `🇰🇭 <b>វិក្កយបត្របង់ប្រាក់ KHQR ស្វ័យប្រវត្ត (OFFICIAL INVOICE)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `┌ 🔖 <b>លេខវិក្កយបត្រ៖</b> <code>#${orderId}</code>\n` +
      `├ 📚 <b>សៀវភៅ៖</b> <b>${product.name}</b>\n` +
      `├ 🖋️ <b>អ្នកនិពន្ធ៖</b> ${product.author || 'បណ្ណាគារ'}\n` +
      `├ 🏷️ <b>ទម្រង់៖</b> ${isPrinted ? '📖 សៀវភៅព្រីន Hardcopy' : '📄 សៀវភៅអេឡិចត្រូនិក PDF'}\n` +
      `├ 🔢 <b>បរិមាណ៖</b> <b>${quantity} ${unitLabel}</b>\n` +
      `├ 💵 <b>ថ្លៃទំនិញ (Subtotal)៖</b> $${pricing.totalAmount.toFixed(2)} USD\n`;

    if (isPrinted) {
      caption += `├ 🚚 <b>ថ្លៃដឹកជញ្ជូន៖</b> ${shippingFee > 0 ? `$${shippingFee.toFixed(2)} USD` : '🎉 ឥតគិតថ្លៃ (Free Delivery)'}\n`;
    }

    caption += `├ 💰 <b>ទឹកប្រាក់ត្រូវទូទាត់សរុប៖</b> <code>${formatDualPrice(finalTotalAmount, khrRate)}</code>\n`;

    if (isPrinted && newOrder.shippingRecipient) {
      caption += `├ 👤 <b>អ្នកទទួល៖</b> <b>${newOrder.shippingRecipient}</b>\n` +
        `├ 📞 <b>លេខទូរស័ព្ទ៖</b> <code>${newOrder.shippingPhone}</code>\n` +
        `├ 🚚 <b>សេវាដឹក៖</b> <b>${newOrder.courierService || 'ខាងដឹកជញ្ជូន'}</b>${newOrder.shippingSpeed === 'express' ? ' ⚡ (Same-Day)' : ''}\n` +
        `├ 📍 <b>អាសយដ្ឋានដឹក៖</b> <b>${newOrder.shippingAddress}</b>\n` +
        (newOrder.shippingNotes ? `├ 📝 <b>ចំណាំអ្នកដឹក៖</b> <i>${newOrder.shippingNotes}</i>\n` : '');
    }

    caption += `└ ⏱️ <b>សុពលភាព KHQR៖</b> <b>${expiryMinutes} នាទី</b>\n\n` +
      `📌 <b>ជម្រើសនៃការទូទាត់ប្រាក់៖</b>\n` +
      `1. <b>ស្កេន KHQR</b> ខាងលើជាមួយ App ធនាគារ (Bakong, ABA, Wing, ACLEDA...) — ប្រព័ន្ធពិនិត្យស្វ័យប្រវត្តិ 24/7!\n` +
      `2. <b>ឬផ្ញើរូបភាពវិក្កយបត្របង់ប្រាក់ (Payment Slip)</b> ចូលក្នុង Chat នេះ ដើម្បីឱ្យ Admin បញ្ជាក់ភ្លាមៗ! ⚡\n\n` +
      (isPrinted
        ? `🚚 <b>ការដឹកជញ្ជូន៖</b> ក្រុមការងារនឹងវេចខ្ចប់ និងបញ្ជូនតាម <b>${newOrder.shippingAddress}</b> ជូនលោកអ្នក!`
        : `⚡ <b>ឯកសារ PDF៖</b> ប្រព័ន្ធនឹងផ្ញើតំណភ្ជាប់ទាញយក PDF ជូនភ្លាមៗដោយស្វ័យប្រវត្តិនឹងពេលទូទាត់ជោគជ័យ!`);

    const supportUser = settings.supportUsername || 'yoeurnhoeurn';
    const bakongDeepLink = payment.checkoutUrl || `https://link.payway.com.kh/checkout?qr=${encodeURIComponent(payment.qrString || orderId)}`;
    const inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
      [
        { text: '📲 បើកក្នុង ABA / Bakong App', url: bakongDeepLink },
        { text: '🔄 ពិនិត្យការទូទាត់ (Check)', callback_data: `check_pay_${orderId}` }
      ],
      [
        { text: '💬 ជំនួយ Admin', url: `https://t.me/${supportUser}` },
        { text: '❌ បោះបង់ (Cancel)', callback_data: `cancel_order_${orderId}` }
      ]
    ];

    // Notify Admin Team Group and Private Chat of new order creation
    this.notifyAdmins(
      `🛒 <b>ការបញ្ជាទិញថ្មី (#${orderId})</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `┌ 📚 <b>សៀវភៅ៖</b> <b>${product.name}</b> (${quantity} ${unitLabel})\n` +
      `├ 💵 <b>ទឹកប្រាក់៖</b> <code>$${pricing.totalAmount.toFixed(2)} USD</code>\n` +
      `├ 🏷️ <b>ប្រភេទ៖</b> ${isPrinted ? '📖 សៀវភៅព្រីន Hardcopy' : '📄 សៀវភៅ PDF (E-Book)'}\n` +
      `└ 👤 <b>អតិថិជន៖</b> @${username} (ID: <code>${chatId}</code>)\n` +
      (isPrinted ? `\n🚚 <b>ព័ត៌មានដឹកជញ្ជូន៖</b>\n• អ្នកទទួល៖ ${newOrder.shippingRecipient}\n• ទូរស័ព្ទ៖ ${newOrder.shippingPhone}\n• ទីតាំង៖ ${newOrder.shippingAddress}\n` : '') +
      `\n<i>* អតិថិជនកំពុងដំណើរការទូទាត់ KHQR ឬផ្ញើ Slip...</i>`
    ).catch(() => {});

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
        `⚠️ <b>ជូនដំណឹងស្តីពីស្ថានភាពស្តុក៖</b>\n━━━━━━━━━━━━━━━━━━━━\n${policyMsg}\n\n👤 Admin: @${settings.supportUsername || 'yoeurnhoeurn'}`,
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
              { text: '💬 សាកសួរ Admin បន្ថែម', url: `https://t.me/${settings.supportUsername || 'yoeurnhoeurn'}` }
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

    // Send direct PDF Document file into Telegram chat
    if (!isPrinted) {
      const pdfTargetUrl = (deliveredItems[0] && deliveredItems[0].startsWith('http'))
        ? deliveredItems[0]
        : (product?.pdfDownloadUrl || 'https://khbookstore.com/downloads/sample.pdf');
      
      await this.sendDocument(
        chatId,
        pdfTargetUrl,
        `📥 <b>ឯកសារ PDF សៀវភៅពេញលេញ៖</b>\n<b>${order.productName}</b>\n\n💡 <i>លោកអ្នកអាចចុចបើក ឬ Save ទុកក្នុង Telegram Saved Messages ដើម្បីអានពេលគ្មាន Internet។</i>`,
        { fileName: `${order.productName.slice(0, 30)}.pdf` }
      );
    }

    // STEP 5: Send Official Digital E-Receipt Card
    const khrRate = settings.khrExchangeRate || 4100;
    const finalKhr = order.totalAmountKhr || Math.round(order.totalAmount * khrRate);
    const subtotalUsd = order.subtotal || (order.totalAmount - (order.shippingFee || 0));

    let itemsList = '';
    if (order.items && order.items.length > 0) {
      order.items.forEach((it, i) => {
        itemsList += `├ 📚 <b>ទំនិញទី ${i + 1}៖</b> ${it.productName} (x${it.quantity})\n`;
      });
    } else {
      itemsList = `├ 📚 <b>ទំនិញ៖</b> ${order.productName} (x${order.quantity} ${isPrinted ? 'ក្បាល' : 'ច្បាប់'})\n`;
    }

    const receiptMsg = `🧾 <b>វិក្កយបត្រអេឡិចត្រូនិចផ្លូវការ (OFFICIAL E-RECEIPT)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 <b>QCM STORE CAMBODIA</b>\n` +
      `🛡️ <b>ស្ថានភាព៖</b> [✅ បានទូទាត់ជោគជ័យ - VERIFIED PAID]\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `┌ 🔖 <b>លេខវិក្កយបត្រ៖</b> <code>#${order.id}</code>\n` +
      `├ 📅 <b>កាលបរិច្ឆេទ៖</b> ${new Date().toLocaleDateString('km-KH')} ${new Date().toLocaleTimeString('km-KH')}\n` +
      `├ 👤 <b>អតិថិជន៖</b> ${order.customerName} (@${order.telegramUsername})\n` +
      itemsList +
      `├ 💵 <b>ថ្លៃទំនិញ (Subtotal)៖</b> $${subtotalUsd.toFixed(2)} USD\n` +
      (order.shippingFee !== undefined && order.shippingFee > 0
        ? `├ 🚚 <b>ថ្លៃដឹកជញ្ជូន (Shipping)៖</b> $${order.shippingFee.toFixed(2)} USD\n`
        : (isPrinted ? `├ 🚚 <b>ថ្លៃដឹកជញ្ជូន (Shipping)៖</b> 🎉 ឥតគិតថ្លៃ (Free Delivery)\n` : '')) +
      `├ 💰 <b>ទឹកប្រាក់សរុប (USD)៖</b> <b>$${order.totalAmount.toFixed(2)} USD</b>\n` +
      `├ 🇰🇭 <b>ទឹកប្រាក់សរុប (KHR)៖</b> <b>${finalKhr.toLocaleString()} ៛</b>\n` +
      `└ 💳 <b>វិធីសាស្រ្តទូទាត់៖</b> KHQR / Bakong / ABA Pay\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `✨ <i>សូមរក្សាទុកវិក្កយបត្រនេះសម្រាប់ផ្ទៀងផ្ទាត់ ឬសេវាបម្រើអតិថិជន 24/7!</i>`;

    await this.sendMessage(chatId, receiptMsg, { parse_mode: 'HTML' });

    // Alert Admin Channel, Team Group, and Admin Private Chat with Logistics Card
    if (isPrinted) {
      await this.notifyAdmins(
        `📦 <b>កញ្ចប់សៀវភៅត្រូវរៀបចំផ្ញើ (HARDCOPY DISPATCH ORDER)!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `┌ 🔖 <b>វិក្កយបត្រ៖</b> <code>#${order.id}</code>\n` +
        `├ 📚 <b>សៀវភៅ៖</b> <b>${order.productName}</b> (x${order.quantity} ក្បាល)\n` +
        `├ 👤 <b>អ្នកទទួល៖</b> <b>${order.shippingRecipient || order.customerName || order.telegramUsername}</b>\n` +
        `├ 📞 <b>លេខទូរស័ព្ទ៖</b> <code>${order.shippingPhone || 'មិនទាន់បញ្ជាក់'}</code>\n` +
        `├ 📍 <b>អាសយដ្ឋាន/ក្រុមហ៊ុនដឹក៖</b> ${order.shippingAddress || 'រាជធានីភ្នំពេញ'}\n` +
        `├ 💵 <b>ទឹកប្រាក់បានបង់៖</b> <code>$${order.totalAmount.toFixed(2)} USD</code>\n` +
        `├ 🏷️ <b>Telegram អតិថិជន៖</b> @${order.telegramUsername} (ID: <code>${order.telegramId}</code>)\n` +
        `└ 📦 <b>SKU សៀវភៅ៖</b> ${deliveredItems.join(', ')}\n\n` +
        `🚚 <i>សូមរៀបចំវេចខ្ចប់ និងផ្ញើតាម VET Express / J&T Express / សេវាដឹកភ្នំពេញ ជូនអតិថិជន!</i>`
      );
    } else {
      await this.notifyAdmins(
        `🛒 <b>ការលក់សៀវភៅ PDF ជោគជ័យថ្មី (New PDF Order)!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `┌ 🔖 <b>វិក្កយបត្រ៖</b> <code>#${order.id}</code>\n` +
        `├ 📄 <b>សៀវភៅ៖</b> <b>${order.productName}</b> (x${order.quantity} ច្បាប់)\n` +
        `├ 💵 <b>ទឹកប្រាក់៖</b> <code>$${order.totalAmount.toFixed(2)} USD</code>\n` +
        `└ 👤 <b>អតិថិជន៖</b> @${order.telegramUsername} (ID: <code>${order.telegramId}</code>)\n` +
        `⚡ <i>ប្រព័ន្ធបានផ្ញើទាំងតំណភ្ជាប់ & File PDF ជូនអតិថិជនរួចរាល់ដោយស្វ័យប្រវត្តិ!</i>`
      );
    }

    return true;
  }

  /**
   * Automatic dispatch notification sent to customer on Telegram when Admin marks shipped
   */
  public static async notifyOrderShipped(order: Order) {
    if (!order.telegramId) return;
    const settings = db.getSettings();
    const supportUser = settings.supportUsername || 'yoeurnhoeurn';
    const isExpress = order.shippingSpeed === 'express';

    let msg = `🚚 <b>ដំណឹងកញ្ចប់សៀវភៅត្រូវបានចេញដំណើរ (ORDER DISPATCHED)!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `┌ 🔖 <b>លេខវិក្កយបត្រ៖</b> <code>#${order.id}</code>\n` +
      `├ 📚 <b>សៀវភៅ៖</b> <b>${order.productName}</b> (x${order.quantity} ${order.bookFormat === 'printed' ? 'ក្បាល' : 'ច្បាប់'})\n` +
      `├ 🚚 <b>ក្រុមហ៊ុនដឹកជញ្ជូន៖</b> <b>${order.courierService || 'VET Express / J&T Express'}</b>\n` +
      (isExpress ? `├ ⚡ <b>ល្បឿនដឹក៖</b> <b>Same-Day Express (បន្ទាន់ក្នុងថ្ងៃ)</b>\n` : '') +
      `├ 🏷️ <b>លេខកូដតាមដាន (Tracking Code)៖</b> <code>${order.trackingNumber || 'មិនទាន់មានលេខកូដ'}</code>\n` +
      `├ 👤 <b>អ្នកទទួល៖</b> ${order.shippingRecipient || order.customerName}\n` +
      `├ 📞 <b>លេខទូរស័ព្ទ៖</b> <code>${order.shippingPhone || 'មិនទាន់បញ្ជាក់'}</code>\n` +
      `├ 📍 <b>អាសយដ្ឋាន/សាខា៖</b> ${order.shippingAddress || 'រាជធានីភ្នំពេញ'}\n` +
      (order.shippingNotes ? `├ 📝 <b>ចំណាំអ្នកដឹក៖</b> <i>${order.shippingNotes}</i>\n` : '') +
      `└ 📦 <b>ស្ថានភាពបច្ចុប្បន្ន៖</b> <b>កំពុងដឹកជញ្ជូន (In Transit)</b>\n\n` +
      `⚡ <i>កញ្ចប់សៀវភៅត្រូវបានវេចខ្ចប់ និងប្រគល់ជូនខាងក្រុមហ៊ុនដឹកជញ្ជូនរួចរាល់ហើយ។ សូមត្រៀមទូរស័ព្ទដើម្បីទទួលការខលពីអ្នកដឹកជញ្ជូន!</i>`;

    const inline_keyboard: any[] = [
      [{ text: '🔍 ពិនិត្យស្ថានភាពកញ្ចប់អីវ៉ាន់', callback_data: `track_order_${order.id}` }],
      [{ text: '💬 ទំនាក់ទំនង Admin Support', url: `https://t.me/${supportUser}` }]
    ];

    await this.sendMessage(order.telegramId, msg, {
      reply_markup: { inline_keyboard },
      parse_mode: 'HTML'
    });
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

    // 4.1 Cart System Callbacks
    if (data.startsWith('cart_add_')) {
      const parsed = parseProductAndQty(data, 'cart_add_');
      const productId = parsed ? parsed.productId : data.replace('cart_add_', '');
      const qty = parsed ? parsed.qty : 1;
      const totalInCart = this.addToCart(chatId, productId, qty);
      const prod = db.getProducts().find(p => p.id === productId);
      await this.answerCallbackQuery(query.id, `✅ បានដាក់ "${prod ? prod.name.slice(0, 18) : 'សៀវភៅ'}" (x${qty}) ចូលកន្ត្រក! (សរុប ${totalInCart})`, true);
      return;
    }

    if (data === 'cart_view') {
      await this.sendCartView(chatId, messageId);
      return;
    }

    if (data.startsWith('cart_inc_')) {
      const productId = data.replace('cart_inc_', '');
      this.updateCartQty(chatId, productId, 1);
      await this.sendCartView(chatId, messageId);
      return;
    }

    if (data.startsWith('cart_dec_')) {
      const productId = data.replace('cart_dec_', '');
      this.updateCartQty(chatId, productId, -1);
      await this.sendCartView(chatId, messageId);
      return;
    }

    if (data.startsWith('cart_rem_')) {
      const productId = data.replace('cart_rem_', '');
      this.removeFromCart(chatId, productId);
      await this.sendCartView(chatId, messageId);
      return;
    }

    if (data === 'cart_clear') {
      this.clearCart(chatId);
      await this.sendCartView(chatId, messageId);
      return;
    }

    if (data === 'cart_checkout') {
      await this.handleCartCheckout(chatId, username, firstName);
      return;
    }

    if (data.startsWith('cart_info_')) {
      const productId = data.replace('cart_info_', '');
      const prod = db.getProducts().find(p => p.id === productId);
      if (prod) {
        await this.answerCallbackQuery(query.id, `សៀវភៅ៖ ${prod.name} ($${prod.price.toFixed(2)})`);
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
          `❌ <b>វិក្កយបត្រ #${orderId} មិនត្រឹមត្រូវ</b>\n━━━━━━━━━━━━━━━━━━━━\nAdmin បានត្រួតពិនិត្យ Slip បង់ប្រាក់ ប៉ុន្តែមិនអាចផ្ទៀងផ្ទាត់បានទេ។ សូមទាក់ទងមក Admin ឬពិនិត្យការផ្ទេរប្រាក់ឡើងវិញ។\n\n👤 Admin: @${db.getSettings().supportUsername || 'yoeurnhoeurn'}`,
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

    // Step 3 Method Callbacks: Standard PP, Express PP, VET Express, J&T Express
    if (data === 'ship_method_pp_std') {
      const session = this.customerStates.get(String(chatId));
      if (session) {
        session.data.shippingSpeed = 'standard';
        session.data.courierService = 'ភ្នំពេញ ធម្មតា (Standard Delivery)';
        session.step = 'awaiting_shipping_address_pp';
        await this.promptPhnomPenhLocation(chatId, 'standard');
      }
      return;
    }

    if (data === 'ship_method_pp_exp') {
      const session = this.customerStates.get(String(chatId));
      if (session) {
        session.data.shippingSpeed = 'express';
        session.data.courierService = 'ភ្នំពេញ បន្ទាន់ក្នុងថ្ងៃ (Same-Day Express)';
        session.step = 'awaiting_shipping_address_pp';
        await this.promptPhnomPenhLocation(chatId, 'express');
      }
      return;
    }

    if (data === 'ship_method_vet') {
      const session = this.customerStates.get(String(chatId));
      if (session) {
        session.data.courierService = 'VET Express (វីរៈប៊ុនថាំ)';
        session.data.shippingSpeed = 'standard';
        session.step = 'awaiting_shipping_province';
        await this.promptProvincePicker(chatId, 'VET Express (វីរៈប៊ុនថាំ)', 0);
      }
      return;
    }

    if (data === 'ship_method_jnt') {
      const session = this.customerStates.get(String(chatId));
      if (session) {
        session.data.courierService = 'J&T Express';
        session.data.shippingSpeed = 'standard';
        session.step = 'awaiting_shipping_province';
        await this.promptProvincePicker(chatId, 'J&T Express', 0);
      }
      return;
    }

    // Province pagination & selection
    if (data.startsWith('ship_prov_page_')) {
      const page = parseInt(data.replace('ship_prov_page_', ''), 10) || 0;
      const session = this.customerStates.get(String(chatId));
      const courier = session?.data?.courierService || 'ខាងដឹកជញ្ជូន';
      await this.promptProvincePicker(chatId, courier, page);
      return;
    }

    if (data === 'ship_prov_back') {
      const session = this.customerStates.get(String(chatId));
      if (session) {
        session.step = 'awaiting_shipping_province';
        const courier = session.data.courierService || 'ខាងដឹកជញ្ជូន';
        await this.promptProvincePicker(chatId, courier, 0);
      }
      return;
    }

    if (data.startsWith('ship_prov_')) {
      const provId = data.replace('ship_prov_', '');
      const province = CAMBODIA_PROVINCES.find(p => p.id === provId);
      const session = this.customerStates.get(String(chatId));
      if (session && province) {
        const provName = `${province.name} (${province.en})`;
        session.data.province = provName;
        session.step = 'awaiting_shipping_branch';
        const courier = session.data.courierService || 'ខាងដឹកជញ្ជូន';
        await this.promptBranchPicker(chatId, courier, provName);
      }
      return;
    }

    // Branch selection
    if (data === 'ship_branch_town' || data === 'ship_branch_market' || data === 'ship_branch_bus') {
      const session = this.customerStates.get(String(chatId));
      if (session) {
        const branchLabel = data === 'ship_branch_town'
          ? 'សាខាក្រុង / ទីរួមខេត្ត'
          : data === 'ship_branch_market'
            ? 'សាខាផ្សារធំ / ផ្សារលើ'
            : 'សាខាបេនឡាន';
        session.data.branch = branchLabel;
        session.data.shippingAddress = `${session.data.courierService || 'ខាងដឹក'} - ${branchLabel}, ខេត្ត ${session.data.province || ''}`;
        session.step = 'awaiting_shipping_notes';
        await this.promptRiderNotes(chatId, session.data);
      }
      return;
    }

    // Quick Khan selection for Phnom Penh
    if (data.startsWith('ship_khan_')) {
      const khan = data.replace('ship_khan_', '');
      const session = this.customerStates.get(String(chatId));
      if (session) {
        session.data.shippingAddress = `រាជធានីភ្នំពេញ, ${khan}`;
        session.data.province = 'រាជធានីភ្នំពេញ';
        session.step = 'awaiting_shipping_notes';
        await this.promptRiderNotes(chatId, session.data);
      }
      return;
    }

    // Step 5: Rider Notes Callbacks
    if (data === 'ship_note_skip') {
      const session = this.customerStates.get(String(chatId));
      if (session) {
        await this.completeShippingCheckout(chatId, { id: typeof chatId === 'number' ? chatId : 0, username, first_name: firstName }, session.data, '');
      }
      return;
    }

    if (data === 'ship_note_call15') {
      const session = this.customerStates.get(String(chatId));
      if (session) {
        await this.completeShippingCheckout(chatId, { id: typeof chatId === 'number' ? chatId : 0, username, first_name: firstName }, session.data, 'ខលមុនពេលមកដល់ 15 នាទី');
      }
      return;
    }

    if (data === 'ship_note_afternoon') {
      const session = this.customerStates.get(String(chatId));
      if (session) {
        await this.completeShippingCheckout(chatId, { id: typeof chatId === 'number' ? chatId : 0, username, first_name: firstName }, session.data, 'ដឹកពេលរសៀល');
      }
      return;
    }

    if (data === 'ship_note_gate') {
      const session = this.customerStates.get(String(chatId));
      if (session) {
        await this.completeShippingCheckout(chatId, { id: typeof chatId === 'number' ? chatId : 0, username, first_name: firstName }, session.data, 'ទុកនៅមុខទ្វាររបងផ្ទះ');
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

    // 10. Sample Preview & Interactive QCM Quiz
    if (data.startsWith('prod_sample_')) {
      const productId = data.replace('prod_sample_', '');
      await this.handleProductSample(chatId, productId, 0);
      return;
    }

    if (data.startsWith('sample_next_')) {
      const rest = data.replace('sample_next_', '');
      const lastUnderscore = rest.lastIndexOf('_');
      if (lastUnderscore !== -1) {
        const productId = rest.slice(0, lastUnderscore);
        const qIdx = parseInt(rest.slice(lastUnderscore + 1), 10) || 0;
        await this.handleProductSample(chatId, productId, qIdx, messageId);
      }
      return;
    }

    if (data.startsWith('quiz_')) {
      const rest = data.replace('quiz_', '');
      const parts = rest.split('_');
      if (parts.length >= 3) {
        const optIdx = parseInt(parts.pop()!, 10);
        const qIdx = parseInt(parts.pop()!, 10);
        const productId = parts.join('_');
        await this.handleSampleQuizAnswer(chatId, productId, qIdx, optIdx, messageId);
      }
      return;
    }

    // 11. Self-Service Order Tracking Callbacks
    if (data.startsWith('track_order_')) {
      const orderId = data.replace('track_order_', '');
      await this.handleTrackingQuery(chatId, orderId);
      return;
    }

    if (data === 'track_menu') {
      await this.handleOrderTracking(chatId);
      return;
    }

    // 12. Quick Actions & Navigation
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

    // 13. Owner Broadcast Execution & Cancellation
    if (data.startsWith('bc_exec_')) {
      const parts = data.split('_'); // ['bc', 'exec', 'all|users|groups', '<draftId>']
      const targetType = parts[2] as 'all' | 'users' | 'groups';
      const draftId = parts.slice(3).join('_');
      const draft = this.ownerBroadcastDrafts.get(draftId);

      if (!this.isOwnerUser(chatId, username)) {
        await this.answerCallbackQuery(query.id, '❌ មានតែម្ចាស់ហាង @yoeurnhoeurn ប៉ុណ្ណោះដែលអាចបញ្ជាមុខងារនេះបាន!', true);
        return;
      }

      if (!draft) {
        await this.answerCallbackQuery(query.id, '⚠️ សារព្រាងនេះបានផុតកំណត់ ឬត្រូវបានលុបរួចហើយ!', true);
        return;
      }

      await this.answerCallbackQuery(query.id, '🚀 កំពុងចាប់ផ្តើមបញ្ជូនសារ...');
      await this.sendMessage(chatId, '⏳ <b>កំពុងដំណើរការផ្សាយសារ (Broadcasting)...</b>\nសូមរង់ចាំបន្តិច ប្រព័ន្ធនឹងផ្ញើរបាយការណ៍លទ្ធផលជូនលោកអ្នកនៅពេលបញ្ចប់។', { parse_mode: 'HTML' });

      // Clean up draft
      this.ownerBroadcastDrafts.delete(draftId);

      // Execute broadcast
      await this.executeBroadcast(targetType, { text: draft.text, photoUrl: draft.photoUrl }, chatId);
      return;
    }

    if (data.startsWith('bc_cancel_')) {
      const draftId = data.replace('bc_cancel_', '');
      this.ownerBroadcastDrafts.delete(draftId);
      await this.answerCallbackQuery(query.id, '❌ បានបោះបង់ការផ្សាយសារ។');
      await this.sendMessage(chatId, '❌ បានបោះបង់ការផ្សាយសាររួចរាល់។', {
        reply_markup: this.getMainReplyKeyboard()
      });
      return;
    }

    if (data === 'owner_prompt_bc') {
      if (this.isOwnerUser(chatId, username)) {
        await this.sendMessage(
          chatId,
          `📝 <b>សូមវាយឆាតសារ ឬផ្ញើរូបភាពដែលលោកអ្នកចង់ផ្សាយដំណឹងចូលក្នុង Chat នេះ៖</b>\n\nបន្ទាប់មក Bot នឹងរៀបចំប៊ូតុង 1-Click ដើម្បីបញ្ជូនទៅ Users ទាំងអស់ និង គ្រុបទាំងអស់ភ្លាមៗ!`,
          { parse_mode: 'HTML' }
        );
      }
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

    const isOwner = this.isOwnerUser(chatId, username);

    // Explicit owner commands
    if (isOwner) {
      if (rawText.startsWith('/broadcast') || rawText.startsWith('/bc') || rawText.startsWith('/sendall') || rawText.startsWith('/announce')) {
        const broadcastText = rawText.replace(/^\/(broadcast|bc|sendall|announce)\s*/i, '').trim();
        if (!broadcastText) {
          await this.sendMessage(
            chatId,
            `📢 <b>ប្រព័ន្ធផ្សាយដំណឹងរបស់ម្ចាស់ហាង (@yoeurnhoeurn)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
            `លោកអ្នកអាចផ្សាយសារបាន ២ របៀប៖\n` +
            `1. វាយបញ្ជា៖ <code>/bc &lt;ខ្លឹមសារសារ&gt;</code>\n` +
            `2. ឬគ្រាន់តែ <b>វាយឆាតសារ ឬផ្ញើរូបភាព</b> ចូលក្នុង Chat នេះភ្លាមៗ នោះ Bot នឹងបង្កើតប៊ូតុងបញ្ជូនសារទៅកាន់ Users និង គ្រុបទាំងអស់ដោយស្វ័យប្រវត្តិ! ⚡`,
            { reply_markup: this.getMainReplyKeyboard(), parse_mode: 'HTML' }
          );
          return;
        }
        await this.promptOwnerBroadcast(chatId, broadcastText, username);
        return;
      }

      if (rawText === '/admin' || rawText === '/owner' || rawText === '👑 Admin' || rawText === '/help_admin') {
        const { userTargets, groupTargets } = this.getAllBroadcastTargets();
        await this.sendMessage(
          chatId,
          `👑 <b>ផ្ទាំងគ្រប់គ្រងម្ចាស់ហាង (OWNER CONTROL PANEL)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>ម្ចាស់ហាង៖</b> @${username || 'yoeurnhoeurn'} (ID: <code>${chatId}</code>)\n` +
          `👥 <b>Users ទាំងអស់៖</b> <b>${userTargets.length}</b> នាក់\n` +
          `🏢 <b>គ្រុប & ឆានែល៖</b> <b>${groupTargets.length}</b> គ្រុប\n\n` +
          `💡 <b>គន្លឹះពិសេស៖</b> លោកអ្នកគ្រាន់តែវាយឆាតសារអ្វីមួយចូលក្នុង Chat នេះ នោះ Bot នឹងរៀបចំប៊ូតុង 1-Click ដើម្បីបាញ់សារនោះទៅកាន់ Users និង គ្រុបទាំងអស់ភ្លាមៗ!`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📢 សាកល្បងផ្សាយសារ (Broadcast)', callback_data: 'owner_prompt_bc' }],
                [{ text: '📦 ពិនិត្យស្តុកសៀវភៅ', callback_data: 'stock_check' }, { text: '🛍️ មើលកាតាឡុក', callback_data: 'catalog_menu' }]
              ]
            },
            parse_mode: 'HTML'
          }
        );
        return;
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

    // Tracking check (🚚 តាមដានអីវ៉ាន់) or direct Order ID search
    if (
      rawText.includes('តាមដាន') ||
      rawText.toLowerCase().includes('track')
    ) {
      await this.handleOrderTracking(chatId);
      return;
    }

    if (
      rawText.toUpperCase().startsWith('ORD-') ||
      rawText.toUpperCase().startsWith('#ORD-') ||
      (activeSession && activeSession.step === 'awaiting_tracking_search')
    ) {
      await this.handleTrackingQuery(chatId, rawText);
      return;
    }

    // Cart View (🛍️ កន្ត្រកទំនិញ)
    if (
      rawText.includes('កន្ត្រក') ||
      rawText.toLowerCase().includes('cart') ||
      rawText.toLowerCase().includes('basket')
    ) {
      await this.sendCartView(chatId);
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

    // Default fallback - show menu or prompt owner broadcast
    if (this.isOwnerUser(chatId, username)) {
      await this.promptOwnerBroadcast(chatId, rawText, username);
      return;
    }

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
      if (['group', 'supergroup', 'channel'].includes(chat.type)) {
        if (newStatus === 'administrator' || newStatus === 'member') {
          db.addKnownGroup({
            id: chat.id,
            title: chat.title || `Group ${chat.id}`,
            type: chat.type,
            addedAt: new Date().toISOString()
          });
          console.log(`[Telegram] Bot joined/admin in group: ${chat.title} (${chat.id})`);
        } else if (newStatus === 'left' || newStatus === 'kicked') {
          db.removeKnownGroup(chat.id);
          console.log(`[Telegram] Bot left group: ${chat.title} (${chat.id})`);
        }
      }
      if (newStatus === 'kicked' || newStatus === 'left') {
        db.setCustomerBlockedStatus(chat.id, true);
        console.log(`[Telegram] User ${chat.id} (${chat.username || chat.first_name || 'user'}) blocked the bot.`);
      } else if (newStatus === 'member') {
        db.setCustomerBlockedStatus(chat.id, false);
        console.log(`[Telegram] User ${chat.id} (${chat.username || chat.first_name || 'user'}) unblocked the bot.`);
      }
      return;
    }

    // Auto-record groups or channels where bot is present
    const incomingChat = update.message?.chat || update.channel_post?.chat;
    if (incomingChat && ['group', 'supergroup', 'channel'].includes(incomingChat.type)) {
      db.addKnownGroup({
        id: incomingChat.id,
        title: incomingChat.title || `Chat ${incomingChat.id}`,
        type: incomingChat.type,
        addedAt: new Date().toISOString()
      });
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

      // 3. Location Drop Pin (GPS)
      if (update.message.location) {
        await this.handleLocationMessage(
          update.message.chat.id,
          update.message.location,
          update.message.from || { id: update.message.chat.id }
        );
        return;
      }

      // 4. Text Message
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
