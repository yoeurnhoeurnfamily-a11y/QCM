import QRCode from 'qrcode';
import { db } from './db';
import { buildAcledaPaymentUrl, DEFAULT_KHQR_HOLDER_NAME, DEFAULT_KHQR_PAYMENT_URL } from './cutluy';

export async function renderCheckoutHtml(params: {
  orderId?: string;
  amount: number;
  productName?: string;
  customerName?: string;
  paymentData?: string;
}): Promise<string> {
  const settings = db.getSettings();
  const amount = Number(params.amount) || 3.50;
  const khrRate = settings.khrExchangeRate || 4100;
  const amountKhr = Math.round(amount * khrRate);
  const accountHolderName = settings.accountHolderName || DEFAULT_KHQR_HOLDER_NAME;
  const basePaymentUrl = settings.paymentLink || DEFAULT_KHQR_PAYMENT_URL;
  const dynamicUrl = buildAcledaPaymentUrl(basePaymentUrl, amount, params.orderId);
  const orderId = params.orderId || `ORD-${Date.now().toString().slice(-6)}`;
  const productName = params.productName || 'កម្រងសំណួរ QCM & វិញ្ញាសាត្រៀមប្រឡង';
  const botUsername = settings.botUsername || 'qcmstore_bot';

  // Generate high-resolution KHQR Image
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(dynamicUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 10,
      color: {
        dark: '#001E4F',
        light: '#FFFFFF'
      }
    });
  } catch {
    qrDataUrl = '';
  }

  return `<!DOCTYPE html>
<html lang="km">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ទូទាត់ប្រាក់ ACLEDA KHQR - ${accountHolderName} ($${amount.toFixed(2)})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0B1120;
      color: #F8FAFC;
      font-family: 'Kantumruy Pro', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .card {
      background: #0F172A;
      border: 1px solid #1E293B;
      border-radius: 24px;
      max-width: 440px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
    }
    .header {
      background: linear-gradient(135deg, #002B66 0%, #001E4F 100%);
      padding: 24px;
      text-align: center;
      position: relative;
      border-bottom: 2px solid #E2B755;
    }
    .logo-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.1);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      color: #E2B755;
      margin-bottom: 12px;
      border: 1px solid rgba(226, 183, 85, 0.3);
    }
    .bank-title {
      font-size: 17px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: 0.3px;
    }
    .bank-sub {
      font-size: 11px;
      color: #94A3B8;
      margin-top: 2px;
    }
    .amount-box {
      margin-top: 16px;
      background: rgba(0, 0, 0, 0.3);
      padding: 14px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .amount-label {
      font-size: 11px;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .amount-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 32px;
      font-weight: 700;
      color: #10B981;
      margin-top: 2px;
    }
    .amount-khr {
      font-size: 13px;
      color: #E2B755;
      font-weight: 600;
      margin-top: 2px;
    }
    .content {
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .account-info {
      width: 100%;
      background: #1E293B;
      padding: 12px 16px;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .account-info span { color: #94A3B8; }
    .account-info strong { color: #FFFFFF; font-size: 13px; }
    .qr-frame {
      background: #FFFFFF;
      padding: 14px;
      border-radius: 20px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      border: 4px solid #E2B755;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 250px;
      height: 250px;
    }
    .qr-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .order-meta {
      width: 100%;
      font-size: 11px;
      color: #94A3B8;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid #1E293B;
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
    }
    .actions {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .btn {
      width: 100%;
      padding: 14px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-acleda {
      background: linear-gradient(135deg, #003366 0%, #001E4F 100%);
      color: #FFFFFF;
      border: 1px solid #E2B755;
      box-shadow: 0 4px 14px rgba(0, 30, 79, 0.5);
    }
    .btn-acleda:hover {
      background: #002B66;
      transform: translateY(-1px);
    }
    .btn-bot {
      background: #2563EB;
      color: #FFFFFF;
    }
    .btn-bot:hover { background: #1D4ED8; }
    .instructions {
      font-size: 11px;
      color: #64748B;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">
        <span>🏛️ ACLEDA BANK & BAKONG KHQR</span>
      </div>
      <h1 class="bank-title">ធនាគារ អេស៊ីលីដា ភីអិលស៊ី</h1>
      <p class="bank-sub">ACLEDA Bank Plc. • KHQR Payment Gateway</p>

      <div class="amount-box">
        <div class="amount-label">តម្លៃសៀវភៅទិញសរុប (Total Amount)</div>
        <div class="amount-value">$${amount.toFixed(2)} USD</div>
        <div class="amount-khr">≈ ${amountKhr.toLocaleString()} ខ្មែររៀល (KHR)</div>
      </div>
    </div>

    <div class="content">
      <div class="account-info">
        <span>ឈ្មោះគណនី (Name):</span>
        <strong>${accountHolderName}</strong>
      </div>

      <div class="qr-frame">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="ACLEDA KHQR" class="qr-img" />` : '<div style="color:black">QR Error</div>'}
      </div>

      <div class="order-meta">
        <div class="meta-row">
          <span>📚 សៀវភៅ៖</span>
          <strong style="color: #F8FAFC; max-width: 220px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${productName}</strong>
        </div>
        <div class="meta-row">
          <span>🔖 លេខវិក្កយបត្រ៖</span>
          <strong style="font-family: monospace; color: #38BDF8;">#${orderId}</strong>
        </div>
        <div class="meta-row">
          <span>⚡ ស្ថានភាព៖</span>
          <strong style="color: #F59E0B;">⏳ កំពុងរង់ចាំការទូទាត់</strong>
        </div>
      </div>

      <div class="actions">
        <a href="${dynamicUrl}" class="btn btn-acleda">
          <span>📲 បើកក្នុង ACLEDA Mobile ($${amount.toFixed(2)})</span>
        </a>

        <a href="https://t.me/${botUsername}" class="btn btn-bot">
          <span>💬 ផ្ញើ Slip ចូល Telegram Bot</span>
        </a>
      </div>

      <p class="instructions">
        ស្កេនជាមួយ App ធនាគារណាមួយ (ACLEDA, ABA, Wing, Bakong...)<br>
        ប្រព័ន្ធនឹងផ្ទៀងផ្ទាត់ និងប្រគល់សៀវភៅជូនភ្លាមៗ 24/7!
      </p>
    </div>
  </div>

  <script>
    // If opened on mobile, attempt deep link click
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      console.log('Mobile device detected, ready for ACLEDA Mobile app launch');
    }
  </script>
</body>
</html>`;
}
