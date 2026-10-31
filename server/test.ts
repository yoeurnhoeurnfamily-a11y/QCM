import { db } from './db';
import { parseProductAndQty, calculateOrderPrice, TelegramBotService } from './telegram';
import { CutLuyService } from './cutluy';

async function runTests() {
  console.log('🧪 Starting CutLuy KHQR Store & Bot Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // TEST 1: parseProductAndQty with underscore in product ID (e.g. prod_canva_01)
  console.log('1. Testing parseProductAndQty:');
  const parsed1 = parseProductAndQty('qty_adj_prod_canva_01_3', 'qty_adj_');
  assert(parsed1?.productId === 'prod_canva_01', 'Correctly parses productId with underscore');
  assert(parsed1?.qty === 3, 'Correctly parses quantity 3');

  const parsed2 = parseProductAndQty('order_checkout_prod_capcut_02_5', 'order_checkout_');
  assert(parsed2?.productId === 'prod_capcut_02', 'Correctly parses checkout action product');
  assert(parsed2?.qty === 5, 'Correctly parses checkout quantity 5');

  // TEST 2: Bulk pricing calculation
  console.log('\n2. Testing Bulk Pricing calculation:');
  const productCanva = db.getProducts().find(p => p.id === 'prod_canva_01')!;
  const priceQty1 = calculateOrderPrice(productCanva, 1);
  assert(priceQty1.unitPrice === 1.50 && priceQty1.totalAmount === 1.50 && !priceQty1.isDiscounted, 'Qty 1 uses base price $1.50');

  const priceQty5 = calculateOrderPrice(productCanva, 5);
  assert(priceQty5.unitPrice === 1.20 && priceQty5.totalAmount === 6.00 && priceQty5.isDiscounted, 'Qty 5 qualifies for Tier 1 ($1.20/unit)');

  const priceQty10 = calculateOrderPrice(productCanva, 10);
  assert(priceQty10.unitPrice === 1.00 && priceQty10.totalAmount === 10.00 && priceQty10.isDiscounted, 'Qty 10 qualifies for Tier 2 ($1.00/unit)');

  // TEST 3: CutLuy KHQR generation
  console.log('\n3. Testing CutLuy KHQR generation:');
  const paymentRes = await CutLuyService.createPayment('ORD-TEST99', 6.00);
  assert(paymentRes.success, 'CutLuy createPayment returned success');
  assert(paymentRes.qrString.includes('cutluy.khqr'), 'KHQR string contains valid merchant tag');
  assert(paymentRes.qrBuffer instanceof Buffer && paymentRes.qrBuffer.length > 0, 'Generated QR PNG buffer is valid');
  assert(Boolean(paymentRes.qrDataUrl?.startsWith('data:image/png;base64,')), 'Generated QR Data URL is valid');

  // TEST 4: Atomic Stock Reservation
  console.log('\n4. Testing Atomic Stock Reservation & Expiry:');
  const initialAvailable = db.getAvailableStockCount('prod_canva_01');
  assert(initialAvailable >= 2, `Sufficient stock for test (have ${initialAvailable})`);

  const reserved = db.reserveStock('prod_canva_01', 2, 'ORD-RESERVE-TEST', 5);
  assert(reserved !== null && reserved.length === 2, 'Successfully reserved 2 items');
  assert(db.getAvailableStockCount('prod_canva_01') === initialAvailable - 2, 'Available stock decremented by 2');

  // Cancel reservation
  const canceled = db.cancelOrder('ORD-RESERVE-TEST');
  // Add a dummy order to test cancelOrder
  db.addOrder({
    id: 'ORD-RESERVE-TEST',
    referenceId: 'ORD-RESERVE-TEST',
    telegramId: 'sim_1234',
    telegramUsername: 'test_user',
    customerName: 'Test',
    productId: 'prod_canva_01',
    productName: 'Canva Pro',
    quantity: 2,
    unitPrice: 1.50,
    subtotal: 3.00,
    discountAmount: 0,
    couponCode: null,
    totalAmount: 3.00,
    status: 'pending',
    paymentProvider: 'cutluy',
    cutluyPaymentId: 'pay_test',
    checkoutUrl: null,
    qrString: 'test',
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    deliveredItems: [],
    referralTelegramId: null,
    commissionEarned: 0,
    createdAt: new Date().toISOString(),
    completedAt: null
  });

  const cancelSuccess = db.cancelOrder('ORD-RESERVE-TEST');
  assert(cancelSuccess, 'Order canceled successfully');
  assert(db.getAvailableStockCount('prod_canva_01') === initialAvailable, 'Reserved stock restored to available');

  // TEST 5: Customer Upsert & Referral linking
  console.log('\n5. Testing Customer Upsert & Referral tracking:');
  const custNew = db.upsertCustomer(999888, 'referral_tester', 'RefUser', undefined, '58829104');
  assert(custNew.telegramId === 999888, 'Customer registered');
  assert(custNew.referredBy === '58829104', 'Referral recorded correctly');

  // CLEANUP test data
  const data = db.getData();
  data.orders = data.orders.filter(o => o.id !== 'ORD-RESERVE-TEST');
  data.customers = data.customers.filter(c => c.telegramId !== 999888);
  db.saveData();

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
