import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AppStoreData, Product, StockItem, Customer, Order, Coupon, BotSettings, BackupRecord, EditHistoryEntry } from '../src/types/store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const BACKUP_DIR = path.resolve(__dirname, '../data/backups');
const DB_FILE = path.join(DATA_DIR, 'store.json');

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_bacii_01',
    name: 'សៀវភៅ វិញ្ញាសាត្រៀមប្រឡងបាក់ឌុប BacII ២០២៦ & គន្លឹះដោះស្រាយ (PDF)',
    category: 'សៀវភៅត្រៀមប្រឡង',
    bookFormat: 'pdf',
    author: 'សាស្រ្តាចារ្យ គណិត-វិទ្យាសាស្ត្រ (ក្រុមការងារបាក់ឌុបនិទ្ទេស A)',
    pages: 350,
    fileSize: '24.5 MB',
    pdfDownloadUrl: 'https://khbookstore.com/downloads/pdf/bacii-2026-exam-prep-master.pdf',
    description: 'កម្រងវិញ្ញាសាត្រៀមប្រឡងបាក់ឌុបថ្នាក់ជាតិ (គណិតវិទ្យា, រូបវិទ្យា, គីមីវិទ្យា, ជីវវិទ្យា) ព្រមជាមួយដំណោះស្រាយលម្អិត រូបមន្តគន្លឹះ និងគន្លឹះយកនិទ្ទេស A។ ឯកសារ PDF ច្បាស់កម្រិត HD អាចអានលើ iPad, Tablet និងទូរស័ព្ទ។',
    price: 3.50,
    bulkPricingEnabled: true,
    tiers: [
      { minQty: 3, maxQty: 5, pricePerUnit: 2.80 },
      { minQty: 6, maxQty: null, pricePerUnit: 2.20 }
    ],
    instructions: '1. ចុច Link ដោនឡូតឯកសារ PDF គុណភាពខ្ពស់\n2. ភ្ជាប់មកជាមួយ File កម្រងរូបមន្តសង្ខេប 4 មុខវិជ្ជា\n3. អាចទាញយកអាប់ដេតវិញ្ញាសាថ្មីៗបន្ថែមដោយឥតគិតថ្លៃ!',
    badge: '🔥 HOT បាក់ឌុប',
    isActive: true,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: 'prod_qcm_state_02',
    name: 'កម្រងសំណួរ QCM វប្បធម៌ទូទៅ & ចំណេះដឹងទូទៅ ត្រៀមប្រឡងក្របខ័ណ្ឌរដ្ឋ (PDF)',
    category: 'កម្រងសំណួរ QCM',
    bookFormat: 'pdf',
    author: 'បណ្ឌិត ហេង វ៉ាន់ដា & ក្រុមស្រាវជ្រាវក្រសួងមុខងារសាធារណៈ',
    pages: 280,
    fileSize: '18.2 MB',
    pdfDownloadUrl: 'https://khbookstore.com/downloads/pdf/qcm-general-knowledge-state-exam.pdf',
    description: 'កម្រងសំណួរជ្រើសរើសចម្លើយ QCM ជាង ១,២០០ សំណួរ គ្របដណ្តប់លើប្រវត្តិសាស្ត្រខ្មែរ ភូមិសាស្ត្រ ច្បាប់រដ្ឋធម្មនុញ្ញ អាស៊ាន សេដ្ឋកិច្ច និងអង្គការអន្តរជាតិ មានចម្លើយត្រឹមត្រូវ ១០០% សម្រាប់ត្រៀមប្រឡងចូលក្រសួងនានា។',
    price: 2.50,
    bulkPricingEnabled: true,
    tiers: [
      { minQty: 3, maxQty: 5, pricePerUnit: 2.00 },
      { minQty: 6, maxQty: null, pricePerUnit: 1.75 }
    ],
    instructions: '1. ចុច Link ទាញយក PDF ភ្លាមៗ\n2. មាន Key ចម្លើយ និងការពន្យល់ហេតុផលនៅចុងជំពូកនីមួយៗ\n3. ភ្ជាប់ Mock Exam ធ្វើតេស្តសាកល្បង 60 នាទី!',
    badge: '⭐ QCM រដ្ឋ BEST',
    isActive: true,
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString()
  },
  {
    id: 'prod_teacher_qcm_03',
    name: 'កម្រងសំណួរ QCM គរុកោសល្យ & វិធីសាស្ត្របង្រៀន ត្រៀមប្រឡងគ្រូ (សៀវភៅព្រីន)',
    category: 'កម្រងសំណួរ QCM',
    bookFormat: 'printed',
    author: 'សាស្ត្រាចារ្យ វិទ្យាស្ថានជាតិអប់រំ (NIE)',
    pages: 310,
    description: 'សៀវភៅព្រីនកម្រាស់ ៣១០ ទំព័រ ក្រដាសសកម្រាស់ 80gsm ក្របបិទស្បែករឹង បូកសរុបកម្រងសំណួរ QCM គរុកោសល្យ ចិត្តវិទ្យាអប់រំ និងវិធីសាស្ត្របង្រៀនទំនើប ត្រៀមប្រឡងគ្រូបឋម អនុវិទ្យាល័យ និងវិទ្យាល័យ។ ដឹកជញ្ជូនរហ័សទូទាំង ២៥ ខេត្ត-ក្រុង!',
    price: 7.50,
    bulkPricingEnabled: true,
    tiers: [
      { minQty: 3, maxQty: 5, pricePerUnit: 6.80 },
      { minQty: 6, maxQty: null, pricePerUnit: 6.00 }
    ],
    instructions: '1. ក្រុមការងារនឹងវេចខ្ចប់សៀវភៅក្នុងរយៈពេល 24 ម៉ោង\n2. ផ្ញើតាមរយៈ Virak Buntham / J&T / Grab Express\n3. លេខកូដតាមដាន (Tracking Code) នឹងផ្ញើតាម Telegram!',
    badge: '📖 ព្រីន គ្រូបង្រៀន',
    isActive: true,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
  },
  {
    id: 'prod_med_qcm_04',
    name: 'កម្រងវិញ្ញាសា & សំណួរចម្លើយ QCM ត្រៀមប្រឡងចូលពេទ្យ UHS & ឱសថ (PDF)',
    category: 'សៀវភៅត្រៀមប្រឡង',
    bookFormat: 'pdf',
    author: 'ក្រុមវេជ្ជបណ្ឌិត & ឱសថការីឆ្នើម សាកលវិទ្យាល័យវិទ្យាសាស្ត្រសុខាភិបាល',
    pages: 420,
    fileSize: '32.0 MB',
    pdfDownloadUrl: 'https://khbookstore.com/downloads/pdf/uhs-medical-exam-qcm-2026.pdf',
    description: 'វិញ្ញាសាត្រៀមប្រឡងចូលរៀនវេជ្ជបណ្ឌិត ឱសថសាស្រ្ត ទន្តវទ្យាសាស្ត្រ និងគិលានុបដ្ឋាក។ រួមបញ្ចូលសំណួរ QCM គីមីវិទ្យា ជីវវិទ្យា រូបវិទ្យា ព្រមទាំងគន្លឹះដោះស្រាយលឿននិងត្រឹមត្រូវ។',
    price: 4.00,
    bulkPricingEnabled: true,
    tiers: [
      { minQty: 3, maxQty: null, pricePerUnit: 3.30 }
    ],
    instructions: '1. ចុច Link ដោនឡូតឯកសារ PDF ភ្លាមៗ\n2. អាចបើកអានលើទូរស័ព្ទ កុំព្យូទ័រ និង iPad\n3. ទទួលបានសិទ្ធិចូលរួម Group Telegram ពិភាក្សាវិញ្ញាសា!',
    badge: '🩺 QCM ពេទ្យ HOT',
    isActive: true,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
  },
  {
    id: 'prod_summary_physics_05',
    name: 'សៀវភៅ សង្ខេបមេរៀនរូបវិទ្យា & គីមីវិទ្យា ថ្នាក់ទី១២ (សៀវភៅព្រីន)',
    category: 'ឯកសារសិក្សា & សង្ខេបមេរៀន',
    bookFormat: 'printed',
    author: 'គ្រូឧទ្ទេស ជ័យ ថាវី (វិទ្យាល័យព្រះស៊ីសុវត្ថិ)',
    pages: 265,
    description: 'សៀវភៅព្រីនពណ៌ធម្មជាតិ សង្ខេបមេរៀន រូបមន្តសំខាន់ៗ ឧទាហរណ៍លំហាត់គំរូ ព្រមទាំងលំហាត់អនុវត្តន៍សម្រាប់សិស្សថ្នាក់ទី១២ ងាយស្រួលទន្ទេញចាំ និងរំលឹកមុនថ្ងៃប្រឡង។',
    price: 6.00,
    bulkPricingEnabled: true,
    tiers: [
      { minQty: 3, maxQty: null, pricePerUnit: 5.20 }
    ],
    instructions: '1. ដឹកជញ្ជូនរហ័សដល់ផ្ទះ ឬសាលារៀន (ភ្នំពេញ ១ ថ្ងៃ, ខេត្ត ២ ថ្ងៃ)\n2. ភ្ជាប់មកជាមួយតារាងខ្នាត & រូបមន្ត 1 សន្លឹក\n3. ពិនិត្យសៀវភៅពេលទទួលបាន!',
    badge: '📖 ព្រីន សង្ខេបមេរៀន',
    isActive: true,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
  },
  {
    id: 'prod_english_scholarship_06',
    name: 'កម្រងវិញ្ញាសា Grammar, Reading & Vocab ត្រៀមប្រឡងអាហារូបករណ៍ (PDF)',
    category: 'ឯកសារសិក្សា & សង្ខេបមេរៀន',
    bookFormat: 'pdf',
    author: 'Chevening & MEXT Scholars Network',
    pages: 310,
    fileSize: '21.0 MB',
    pdfDownloadUrl: 'https://khbookstore.com/downloads/pdf/english-scholarship-master-prep.pdf',
    description: 'ឯកសារសិក្សាស្រាវជ្រាវ និងវិញ្ញាសាភាសាអង់គ្លេសកម្រិត Intermediate ដល់ Advanced សម្រាប់ត្រៀមប្រឡងអាហារូបករណ៍រដ្ឋាភិបាលជប៉ុន ចក្រភពអង់គ្លេស អូស្ត្រាលី និងអាហារូបករណ៍សកលវិទ្យាល័យក្នុងស្រុក។',
    price: 3.00,
    bulkPricingEnabled: true,
    tiers: [
      { minQty: 3, maxQty: null, pricePerUnit: 2.50 }
    ],
    instructions: '1. ចុចលើ Link ទាញយក PDF\n2. មាន Audio MP3 Listening Test ភ្ជាប់មកជាមួយស្រាប់\n3. គន្លឹះសរសេរ Statement of Purpose (SOP) គំរូ!',
    badge: '🎓 អាហារូបករណ៍',
    isActive: true,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
  }
];

const INITIAL_STOCK: StockItem[] = [
  // 1. BacII 2026 Exam Prep (PDF Licenses)
  { id: 'stk_bac_101', productId: 'prod_bacii_01', content: 'https://khbookstore.com/dl/pdf_bacii_2026_exam_prep.pdf?token=kh_bk_bac_alpha_9812', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_bac_102', productId: 'prod_bacii_01', content: 'https://khbookstore.com/dl/pdf_bacii_2026_exam_prep.pdf?token=kh_bk_bac_beta_5541', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_bac_103', productId: 'prod_bacii_01', content: 'https://khbookstore.com/dl/pdf_bacii_2026_exam_prep.pdf?token=kh_bk_bac_gamma_7712', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_bac_104', productId: 'prod_bacii_01', content: 'https://khbookstore.com/dl/pdf_bacii_2026_exam_prep.pdf?token=kh_bk_bac_delta_3321', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_bac_105', productId: 'prod_bacii_01', content: 'https://khbookstore.com/dl/pdf_bacii_2026_exam_prep.pdf?token=kh_bk_bac_eps_9011', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },

  // 2. QCM State Exam (PDF Licenses)
  { id: 'stk_qcm_201', productId: 'prod_qcm_state_02', content: 'https://khbookstore.com/dl/pdf_qcm_general_knowledge_state.pdf?token=kh_bk_qcm_state_001', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_qcm_202', productId: 'prod_qcm_state_02', content: 'https://khbookstore.com/dl/pdf_qcm_general_knowledge_state.pdf?token=kh_bk_qcm_state_002', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_qcm_203', productId: 'prod_qcm_state_02', content: 'https://khbookstore.com/dl/pdf_qcm_general_knowledge_state.pdf?token=kh_bk_qcm_state_003', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_qcm_204', productId: 'prod_qcm_state_02', content: 'https://khbookstore.com/dl/pdf_qcm_general_knowledge_state.pdf?token=kh_bk_qcm_state_004', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },

  // 3. Teacher Pedagogy QCM (Printed Copies)
  { id: 'stk_tch_301', productId: 'prod_teacher_qcm_03', content: 'ISBN-978-9924-NIE-TCH-001 | ឃ្លាំងភ្នំពេញ ធ្នើ A2 | ក្បាលទី 1', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_tch_302', productId: 'prod_teacher_qcm_03', content: 'ISBN-978-9924-NIE-TCH-002 | ឃ្លាំងភ្នំពេញ ធ្នើ A2 | ក្បាលទី 2', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_tch_303', productId: 'prod_teacher_qcm_03', content: 'ISBN-978-9924-NIE-TCH-003 | ឃ្លាំងភ្នំពេញ ធ្នើ A2 | ក្បាលទី 3', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_tch_304', productId: 'prod_teacher_qcm_03', content: 'ISBN-978-9924-NIE-TCH-004 | ឃ្លាំងភ្នំពេញ ធ្នើ A2 | ក្បាលទី 4', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },

  // 4. UHS Medical QCM (PDF Licenses)
  { id: 'stk_med_401', productId: 'prod_med_qcm_04', content: 'https://khbookstore.com/dl/pdf_uhs_medical_exam_qcm.pdf?token=kh_bk_med_401', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_med_402', productId: 'prod_med_qcm_04', content: 'https://khbookstore.com/dl/pdf_uhs_medical_exam_qcm.pdf?token=kh_bk_med_402', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_med_403', productId: 'prod_med_qcm_04', content: 'https://khbookstore.com/dl/pdf_uhs_medical_exam_qcm.pdf?token=kh_bk_med_403', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },

  // 5. Physics & Chemistry Summary (Printed Copies)
  { id: 'stk_phy_501', productId: 'prod_summary_physics_05', content: 'ISBN-978-9924-PHY-12-001 | ឃ្លាំងភ្នំពេញ ធ្នើ B1 | ក្បាលទី 1', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_phy_502', productId: 'prod_summary_physics_05', content: 'ISBN-978-9924-PHY-12-002 | ឃ្លាំងភ្នំពេញ ធ្នើ B1 | ក្បាលទី 2', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_phy_503', productId: 'prod_summary_physics_05', content: 'ISBN-978-9924-PHY-12-003 | ឃ្លាំងភ្នំពេញ ធ្នើ B1 | ក្បាលទី 3', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },

  // 6. English Scholarship Prep (PDF Licenses)
  { id: 'stk_eng_601', productId: 'prod_english_scholarship_06', content: 'https://khbookstore.com/dl/pdf_english_scholarship_master.pdf?token=kh_bk_eng_601', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null },
  { id: 'stk_eng_602', productId: 'prod_english_scholarship_06', content: 'https://khbookstore.com/dl/pdf_english_scholarship_master.pdf?token=kh_bk_eng_602', status: 'available', reservedUntil: null, orderId: null, addedAt: new Date().toISOString(), soldAt: null }
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust_8801',
    telegramId: 58829104,
    username: 'sokha_reader',
    firstName: 'Sokha',
    lastName: 'Chheng',
    joinedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    totalOrders: 3,
    totalSpent: 12.50,
    referredBy: null,
    referralCode: 'ref_58829104',
    walletBalance: 0.60,
    phone: '012 889 900',
    defaultShippingAddress: 'ផ្ទះលេខ 45 ផ្លូវ 271 សង្កាត់បឹងទំពុន ខណ្ឌមានជ័យ ភ្នំពេញ'
  },
  {
    id: 'cust_8802',
    telegramId: 92837192,
    username: 'dara_reader',
    firstName: 'Dara',
    lastName: 'Vannak',
    joinedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    totalOrders: 2,
    totalSpent: 14.50,
    referredBy: '58829104',
    referralCode: 'ref_92837192',
    walletBalance: 0.40,
    phone: '098 776 543',
    defaultShippingAddress: 'បុរីពិភពថ្មីចំការដូង ផ្លូវលេខ 3 ផ្ទះ 12 ភ្នំពេញ'
  },
  {
    id: 'cust_8803',
    telegramId: 77291038,
    username: 'rith_books',
    firstName: 'Rith',
    joinedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    totalOrders: 1,
    totalSpent: 8.00,
    referredBy: '58829104',
    referralCode: 'ref_77291038',
    walletBalance: 0.00,
    phone: '077 123 456',
    defaultShippingAddress: 'ភូមិវត្តបូព៌ សង្កាត់សាលាកំរើក ក្រុងសៀមរាប ខេត្តសៀមរាប'
  }
];

const INITIAL_COUPONS: Coupon[] = [
  {
    id: 'cpn_01',
    code: 'WELCOME10',
    type: 'percentage',
    value: 10,
    minOrderAmount: 2.0,
    maxUses: 100,
    usedCount: 8,
    expiresAt: new Date(Date.now() + 60 * 86400000).toISOString(),
    isActive: true
  },
  {
    id: 'cpn_02',
    code: 'READBOOK1',
    type: 'fixed',
    value: 1.00,
    minOrderAmount: 5.0,
    maxUses: 50,
    usedCount: 14,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    isActive: true
  }
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-781920',
    referenceId: 'ORD-781920',
    telegramId: '58829104',
    telegramUsername: 'sokha_reader',
    customerName: 'Sokha Chheng',
    productId: 'prod_bacii_01',
    productName: 'សៀវភៅ វិញ្ញាសាត្រៀមប្រឡងបាក់ឌុប BacII ២០២៦ & គន្លឹះដោះស្រាយ (PDF)',
    quantity: 1,
    unitPrice: 3.50,
    subtotal: 3.50,
    discountAmount: 0,
    couponCode: null,
    totalAmount: 3.50,
    status: 'completed',
    paymentProvider: 'cutluy',
    cutluyPaymentId: 'pay_sim_001',
    checkoutUrl: null,
    qrString: '00020101021229300016cutluy.khqr.mock5802KH530384054043.50',
    expiresAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    deliveredItems: ['https://khbookstore.com/dl/pdf_bacii_2026_exam_prep.pdf?token=kh_bk_bac_delivered_01'],
    referralTelegramId: null,
    commissionEarned: 0,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    completedAt: new Date(Date.now() - 3 * 86400000 + 45000).toISOString(),
    bookFormat: 'pdf',
    pdfDownloadUrl: 'https://khbookstore.com/dl/pdf_bacii_2026_exam_prep.pdf?token=kh_bk_bac_delivered_01'
  },
  {
    id: 'ORD-892104',
    referenceId: 'ORD-892104',
    telegramId: '92837192',
    telegramUsername: 'dara_reader',
    customerName: 'Dara Vannak',
    productId: 'prod_teacher_qcm_03',
    productName: 'កម្រងសំណួរ QCM គរុកោសល្យ & វិធីសាស្ត្របង្រៀន ត្រៀមប្រឡងគ្រូ (សៀវភៅព្រីន)',
    quantity: 1,
    unitPrice: 7.50,
    subtotal: 7.50,
    discountAmount: 0,
    couponCode: null,
    totalAmount: 7.50,
    status: 'completed',
    paymentProvider: 'cutluy',
    cutluyPaymentId: 'pay_sim_002',
    checkoutUrl: null,
    qrString: '00020101021229300016cutluy.khqr.mock5802KH530384054047.50',
    expiresAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    deliveredItems: ['ISBN-978-9924-NIE-TCH-001 | ឃ្លាំងភ្នំពេញ ធ្នើ A2 | ក្បាលទី 1'],
    referralTelegramId: '58829104',
    commissionEarned: 0.20,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    completedAt: new Date(Date.now() - 1 * 86400000 + 38000).toISOString(),
    bookFormat: 'printed',
    shippingRecipient: 'Dara Vannak',
    shippingPhone: '098 776 543',
    shippingAddress: 'បុរីពិភពថ្មីចំការដូង ផ្លូវលេខ 3 ផ្ទះ 12 ភ្នំពេញ',
    shippingStatus: 'shipped',
    trackingNumber: 'VET-PHN-88291'
  }
];

export const DEFAULT_TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9128630112:AAG71Vdgs1HCVtREOt34dT4ofeBQBMkxrYc';
export const DEFAULT_TELEGRAM_BOT_USERNAME = 'qcmstore_bot';

const INITIAL_SETTINGS: BotSettings = {
  botToken: DEFAULT_TELEGRAM_BOT_TOKEN,
  botUsername: DEFAULT_TELEGRAM_BOT_USERNAME,
  channelId: '',
  adminTelegramId: '',
  adminGroupId: '',
  supportUsername: 'kh_bookstore_support',
  welcomeMessage: 'សូមស្វាគមន៍មកកាន់ បណ្ណាគារសៀវភៅត្រៀមប្រឡង & QCM KH Store! 📚🎓\n\nយើងខ្ញុំមានផ្គត់ផ្គង់៖\n• 📘 សៀវភៅត្រៀមប្រឡងបាក់ឌុប & ក្របខ័ណ្ឌរដ្ឋ\n• 📝 កម្រងសំណួរ QCM & វិញ្ញាសាជ្រើសរើសចម្លើយ\n• 📑 ឯកសារសិក្សា សង្ខេបមេរៀន & ត្រៀមអាហារូបករណ៍\n\n✨ ទាញយកជា PDF ភ្លាមៗ ឬ កម្មង់សៀវភៅព្រីនដឹកជូនដល់ផ្ទះ!\n🎟️ បញ្ចុះតម្លៃ 10% ភ្លាមៗ ដោយប្រើ Coupon: WELCOME10\n\n👇 សូមចុចលើ Menu [🛒 ទិញសៀវភៅ] ខាងក្រោមដើម្បីចាប់ផ្តើម៖',
  postPurchaseInstructions: '✨ សូមអរគុណចំពោះការគាំទ្រការអាន និងការរៀនសូត្រ!\n📄 សម្រាប់សៀវភៅ PDF៖ លោកអ្នកអាចចុច Link ទាញយកអានបានភ្លាមៗ។\n📖 សម្រាប់សៀវភៅព្រីន៖ ក្រុមការងារនឹងផ្ញើជូនតាមសេវាដឹកជញ្ជូនរហ័ស 24-48 ម៉ោង។ ប្រសិនបើមានចម្ងល់ សូមទាក់ទងមកកាន់ Admin តាមរយៈប៊ូតុងជំនួយ។',
  cutluyApiKey: '',
  qrExpiryMinutes: 5,
  referralEnabled: true,
  referralCommissionPerAccount: 0.20,
  alertAdminOnNewStock: true,
  broadcastOnNewStock: false,
  stockDepletedPolicyMessage: '⚠️ សូមអភ័យទោស! ស្តុកសៀវភៅត្រូវបានលក់អស់ក្នុងពេលដំណាលគ្នា។ សូមទាក់ទង Admin ដើម្បីទទួលបានការបញ្ចូលស្តុក ឬសងប្រាក់វិញភ្លាមៗ។',
  isPollingActive: true,
  shippingFeePhnomPenh: 1.25,
  shippingFeeSameDay: 2.00,
  shippingFeeProvince: 1.75,
  freeShippingThreshold: 15.00,
  khrExchangeRate: 4100
};

class StoreDatabase {
  private data: AppStoreData;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): AppStoreData {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        const rawOrders: Order[] = parsed.orders || INITIAL_ORDERS;
        const seenOrderIds = new Set<string>();
        const uniqueOrders: Order[] = [];
        for (const ord of rawOrders) {
          if (ord && ord.id && !seenOrderIds.has(ord.id)) {
            seenOrderIds.add(ord.id);
            uniqueOrders.push(ord);
          }
        }

        const mergedSettings: BotSettings = {
          ...INITIAL_SETTINGS,
          ...(parsed.settings || {})
        };

        // Guarantee permanent bot token is never empty
        if (!mergedSettings.botToken || mergedSettings.botToken.trim() === '') {
          mergedSettings.botToken = DEFAULT_TELEGRAM_BOT_TOKEN;
          mergedSettings.botUsername = DEFAULT_TELEGRAM_BOT_USERNAME;
          mergedSettings.isPollingActive = true;
        }

        return {
          products: parsed.products || INITIAL_PRODUCTS,
          stock: parsed.stock || INITIAL_STOCK,
          customers: parsed.customers || INITIAL_CUSTOMERS,
          orders: uniqueOrders,
          coupons: parsed.coupons || INITIAL_COUPONS,
          settings: mergedSettings
        };
      }
    } catch (err) {
      console.error('Error loading database, initializing with seed data:', err);
    }

    const initialData: AppStoreData = {
      products: INITIAL_PRODUCTS,
      stock: INITIAL_STOCK,
      customers: INITIAL_CUSTOMERS,
      orders: INITIAL_ORDERS,
      coupons: INITIAL_COUPONS,
      settings: INITIAL_SETTINGS
    };

    this.saveData(initialData);
    return initialData;
  }

  public saveData(data?: AppStoreData, createBackup = true): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }

      // Automatically create snapshot before saving changes so old data is NEVER lost
      if (createBackup && fs.existsSync(DB_FILE)) {
        try {
          const snapshotName = `store_backup_${Date.now()}.json`;
          fs.copyFileSync(DB_FILE, path.join(BACKUP_DIR, snapshotName));
          // Keep newest 20 backups to conserve disk while ensuring safety
          const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort().reverse();
          if (files.length > 20) {
            for (let i = 20; i < files.length; i++) {
              fs.unlinkSync(path.join(BACKUP_DIR, files[i]));
            }
          }
        } catch (backupErr) {
          console.warn('Auto-backup snapshot notice:', backupErr);
        }
      }

      const dataToSave = data || this.data;
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing to database file:', err);
    }
  }

  // Getters
  public getData(): AppStoreData {
    return this.data;
  }

  public getProducts(): Product[] {
    return this.data.products;
  }

  public getStock(): StockItem[] {
    return this.data.stock;
  }

  public getCustomers(): Customer[] {
    return this.data.customers;
  }

  public getOrders(): Order[] {
    return this.data.orders;
  }

  public getCoupons(): Coupon[] {
    return this.data.coupons;
  }

  public getSettings(): BotSettings {
    return this.data.settings;
  }

  // Mutators with Auto-Save and History Preservation
  public updateSettings(settings: Partial<BotSettings>): BotSettings {
    this.data.settings = { ...this.data.settings, ...settings };
    this.saveData(undefined, true);
    return this.data.settings;
  }

  public addProduct(product: Product): Product {
    this.data.products.push(product);
    this.saveData(undefined, true);
    return product;
  }

  public updateProduct(id: string, updates: Partial<Product>): Product | null {
    const idx = this.data.products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    const existing = this.data.products[idx];
    const history: EditHistoryEntry[] = existing.editHistory ? [...existing.editHistory] : [];
    history.unshift({
      timestamp: new Date().toISOString(),
      action: 'កែប្រែព័ត៌មានសៀវភៅ',
      note: `កែប្រែ: ${Object.keys(updates).join(', ')}`,
      previousData: {
        name: existing.name,
        price: existing.price,
        category: existing.category,
        bookFormat: existing.bookFormat,
        badge: existing.badge,
        isActive: existing.isActive
      }
    });
    if (history.length > 10) history.pop();

    this.data.products[idx] = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      editHistory: history
    };
    this.saveData(undefined, true);
    return this.data.products[idx];
  }

  public reload(): AppStoreData {
    this.data = this.loadData();
    return this.data;
  }

  public deleteProduct(id: string): boolean {
    const beforeLen = this.data.products.length;
    this.data.products = this.data.products.filter(p => p.id !== id);
    if (this.data.products.length !== beforeLen) {
      this.data.stock = this.data.stock.filter(s => s.productId !== id);
      this.saveData(undefined, true);
      return true;
    }
    return false;
  }

  public addStockItems(items: StockItem[]): StockItem[] {
    this.data.stock.push(...items);
    this.saveData(undefined, true);
    return items;
  }

  public deleteStockItem(id: string): boolean {
    const beforeLen = this.data.stock.length;
    this.data.stock = this.data.stock.filter(s => s.id !== id);
    if (this.data.stock.length !== beforeLen) {
      this.saveData(undefined, true);
      return true;
    }
    return false;
  }

  public updateStockItem(id: string, updates: Partial<StockItem>): StockItem | null {
    const idx = this.data.stock.findIndex(s => s.id === id);
    if (idx === -1) return null;
    const existing = this.data.stock[idx];
    const history: EditHistoryEntry[] = existing.editHistory ? [...existing.editHistory] : [];
    history.unshift({
      timestamp: new Date().toISOString(),
      action: 'កែប្រែស្តុក',
      note: `ស្ថានភាព: ${updates.status || existing.status}`,
      previousData: {
        content: existing.content,
        status: existing.status
      }
    });
    if (history.length > 10) history.pop();

    this.data.stock[idx] = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      editHistory: history
    };
    this.saveData(undefined, true);
    return this.data.stock[idx];
  }

  public getAvailableStockCount(productId: string): number {
    return this.data.stock.filter(s => s.productId === productId && s.status === 'available').length;
  }

  public reserveStock(productId: string, quantity: number, orderId: string, expiryMinutes: number): StockItem[] | null {
    const available = this.data.stock.filter(s => s.productId === productId && s.status === 'available');
    if (available.length < quantity) {
      return null;
    }

    const reservedUntil = Date.now() + expiryMinutes * 60 * 1000;
    const reservedItems = available.slice(0, quantity);
    for (const item of reservedItems) {
      item.status = 'reserved';
      item.reservedUntil = reservedUntil;
      item.orderId = orderId;
    }

    this.saveData();
    return reservedItems;
  }

  public releaseExpiredReservations(): number {
    const now = Date.now();
    let releasedCount = 0;
    for (const item of this.data.stock) {
      if (item.status === 'reserved' && item.reservedUntil && item.reservedUntil < now) {
        item.status = 'available';
        item.reservedUntil = null;
        item.orderId = null;
        releasedCount++;
      }
    }

    for (const order of this.data.orders) {
      if (order.status === 'pending') {
        const orderExpiry = new Date(order.expiresAt).getTime();
        if (orderExpiry < now) {
          order.status = 'expired';
          releasedCount++;
        }
      }
    }

    if (releasedCount > 0) {
      this.saveData();
    }
    return releasedCount;
  }

  public cancelOrder(orderId: string): boolean {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return false;

    if (order.status === 'pending') {
      order.status = 'expired';
      // Release any stock reserved for this order
      for (const item of this.data.stock) {
        if (item.orderId === orderId && item.status === 'reserved') {
          item.status = 'available';
          item.reservedUntil = null;
          item.orderId = null;
        }
      }
      this.saveData();
      return true;
    }
    return false;
  }

  public getCustomerByTelegramId(telegramId: number | string): Customer | undefined {
    const numId = typeof telegramId === 'string' ? parseInt(telegramId, 10) : telegramId;
    return this.data.customers.find(c => c.telegramId === numId);
  }

  public upsertCustomer(telegramId: number, username: string, firstName: string, lastName?: string, referrerId?: string): Customer {
    let customer = this.data.customers.find(c => c.telegramId === telegramId);
    if (!customer) {
      customer = {
        id: `cust_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        telegramId,
        username: username || '',
        firstName: firstName || 'User',
        lastName,
        joinedAt: new Date().toISOString(),
        totalOrders: 0,
        totalSpent: 0,
        referredBy: referrerId && referrerId !== String(telegramId) ? referrerId : null,
        referralCode: `ref_${telegramId}`,
        walletBalance: 0,
        isBlocked: false
      };
      this.data.customers.push(customer);
    } else {
      customer.username = username || customer.username;
      customer.firstName = firstName || customer.firstName;
      if (lastName) customer.lastName = lastName;
      if (!customer.referredBy && referrerId && referrerId !== String(telegramId)) {
        customer.referredBy = referrerId;
      }
      customer.isBlocked = false;
      delete customer.botBlockedAt;
    }
    this.saveData();
    return customer;
  }

  public setCustomerBlockedStatus(telegramId: number | string, isBlocked: boolean): boolean {
    const numId = typeof telegramId === 'string' ? parseInt(telegramId, 10) : telegramId;
    if (isNaN(numId)) return false;
    const customer = this.data.customers.find(c => c.telegramId === numId);
    if (customer) {
      customer.isBlocked = isBlocked;
      if (isBlocked) {
        customer.botBlockedAt = new Date().toISOString();
      } else {
        delete customer.botBlockedAt;
      }
      this.saveData();
      return true;
    }
    return false;
  }

  public isCustomerBlocked(telegramId: number | string): boolean {
    const numId = typeof telegramId === 'string' ? parseInt(telegramId, 10) : telegramId;
    if (isNaN(numId)) return false;
    const customer = this.data.customers.find(c => c.telegramId === numId);
    return Boolean(customer?.isBlocked);
  }

  public addOrder(order: Order): Order {
    const existingIdx = this.data.orders.findIndex(o => o.id === order.id);
    if (existingIdx !== -1) {
      this.data.orders[existingIdx] = { ...this.data.orders[existingIdx], ...order };
      this.saveData();
      return this.data.orders[existingIdx];
    }
    this.data.orders.unshift(order);
    this.saveData();
    return order;
  }

  public updateOrder(id: string, updates: Partial<Order>): Order | null {
    const idx = this.data.orders.findIndex(o => o.id === id);
    if (idx === -1) return null;
    const existing = this.data.orders[idx];
    const history: EditHistoryEntry[] = existing.editHistory ? [...existing.editHistory] : [];
    history.unshift({
      timestamp: new Date().toISOString(),
      action: 'កែប្រែព័ត៌មាន Order',
      note: `កែប្រែ: ${Object.keys(updates).join(', ')}`,
      previousData: {
        customerName: existing.customerName,
        status: existing.status,
        totalAmount: existing.totalAmount,
        quantity: existing.quantity,
        shippingRecipient: existing.shippingRecipient,
        shippingPhone: existing.shippingPhone,
        shippingAddress: existing.shippingAddress,
        trackingNumber: existing.trackingNumber,
        shippingStatus: existing.shippingStatus
      }
    });
    if (history.length > 10) history.pop();

    this.data.orders[idx] = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      editHistory: history
    };
    this.saveData(undefined, true);
    return this.data.orders[idx];
  }

  public deleteOrder(id: string): boolean {
    const beforeLen = this.data.orders.length;
    // Release any reserved stock tied to this order
    for (const item of this.data.stock) {
      if (item.orderId === id && item.status === 'reserved') {
        item.status = 'available';
        item.reservedUntil = null;
        item.orderId = null;
      }
    }
    this.data.orders = this.data.orders.filter(o => o.id !== id);
    if (this.data.orders.length !== beforeLen) {
      this.saveData(undefined, true);
      return true;
    }
    return false;
  }

  public addCoupon(coupon: Coupon): Coupon {
    this.data.coupons.push(coupon);
    this.saveData(undefined, true);
    return coupon;
  }

  public updateCoupon(id: string, updates: Partial<Coupon>): Coupon | null {
    const idx = this.data.coupons.findIndex(c => c.id === id);
    if (idx === -1) return null;
    const existing = this.data.coupons[idx];
    const history: EditHistoryEntry[] = existing.editHistory ? [...existing.editHistory] : [];
    history.unshift({
      timestamp: new Date().toISOString(),
      action: 'កែប្រែ Coupon',
      note: `កែប្រែ: ${Object.keys(updates).join(', ')}`,
      previousData: {
        code: existing.code,
        value: existing.value,
        type: existing.type,
        isActive: existing.isActive,
        minOrderAmount: existing.minOrderAmount,
        maxUses: existing.maxUses
      }
    });
    if (history.length > 10) history.pop();

    this.data.coupons[idx] = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      editHistory: history
    };
    this.saveData(undefined, true);
    return this.data.coupons[idx];
  }

  public deleteCoupon(id: string): boolean {
    const beforeLen = this.data.coupons.length;
    this.data.coupons = this.data.coupons.filter(c => c.id !== id);
    if (this.data.coupons.length !== beforeLen) {
      this.saveData(undefined, true);
      return true;
    }
    return false;
  }

  public updateCustomer(id: string, updates: Partial<Customer>): Customer | null {
    const idx = this.data.customers.findIndex(c => c.id === id || String(c.telegramId) === id);
    if (idx === -1) return null;
    const existing = this.data.customers[idx];
    const history: EditHistoryEntry[] = existing.editHistory ? [...existing.editHistory] : [];
    history.unshift({
      timestamp: new Date().toISOString(),
      action: 'កែប្រែព័ត៌មានអតិថិជន',
      note: `កែប្រែ: ${Object.keys(updates).join(', ')}`,
      previousData: {
        firstName: existing.firstName,
        lastName: existing.lastName,
        username: existing.username,
        phone: existing.phone,
        defaultShippingAddress: existing.defaultShippingAddress,
        walletBalance: existing.walletBalance
      }
    });
    if (history.length > 10) history.pop();

    this.data.customers[idx] = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      editHistory: history
    };
    this.saveData(undefined, true);
    return this.data.customers[idx];
  }

  public deleteCustomer(id: string): boolean {
    const beforeLen = this.data.customers.length;
    this.data.customers = this.data.customers.filter(c => c.id !== id && String(c.telegramId) !== id);
    if (this.data.customers.length !== beforeLen) {
      this.saveData(undefined, true);
      return true;
    }
    return false;
  }

  public updateCustomerBalance(telegramId: number, delta: number): Customer | null {
    const customer = this.data.customers.find(c => c.telegramId === telegramId);
    if (!customer) return null;
    customer.walletBalance = Math.max(0, Number((customer.walletBalance + delta).toFixed(2)));
    this.saveData(undefined, true);
    return customer;
  }

  // Backup & Restore Services
  public getBackups(): BackupRecord[] {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        return [];
      }
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort().reverse();
      const records: BackupRecord[] = [];
      for (const f of files) {
        try {
          const filepath = path.join(BACKUP_DIR, f);
          const stat = fs.statSync(filepath);
          const content = fs.readFileSync(filepath, 'utf-8');
          const parsed = JSON.parse(content);
          records.push({
            filename: f,
            timestamp: new Date(stat.mtimeMs).toISOString(),
            sizeKb: Number((stat.size / 1024).toFixed(1)),
            itemCount: {
              products: parsed.products?.length || 0,
              orders: parsed.orders?.length || 0,
              stock: parsed.stock?.length || 0,
              customers: parsed.customers?.length || 0,
              coupons: parsed.coupons?.length || 0
            }
          });
        } catch {
          // ignore corrupted single backup file
        }
      }
      return records;
    } catch {
      return [];
    }
  }

  public createManualBackup(): BackupRecord {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const filename = `manual_backup_${Date.now()}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(this.data, null, 2), 'utf-8');
    const stat = fs.statSync(filepath);
    return {
      filename,
      timestamp: new Date().toISOString(),
      sizeKb: Number((stat.size / 1024).toFixed(1)),
      itemCount: {
        products: this.data.products.length,
        orders: this.data.orders.length,
        stock: this.data.stock.length,
        customers: this.data.customers.length,
        coupons: this.data.coupons.length
      }
    };
  }

  public restoreBackup(filename: string): boolean {
    const safeName = path.basename(filename);
    const filepath = path.join(BACKUP_DIR, safeName);
    if (!fs.existsSync(filepath)) return false;
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.products || !parsed.orders) return false;
      this.data = parsed;
      this.saveData(this.data, false);
      return true;
    } catch (err) {
      console.error('Failed to restore backup:', err);
      return false;
    }
  }
}

export const db = new StoreDatabase();
