const { VnpayAdapter } = require('./dist/modules/payments/adapters/vnpay.adapter');
const qs = require('qs');
const crypto = require('crypto');

class MockConfigService {
  constructor(env) {
    this.env = env;
  }
  get(key, defaultVal) {
    return this.env[key] !== undefined ? this.env[key] : defaultVal;
  }
}

async function testVnpay() {
  console.log('--- TEST VNPAY ADAPTER ---');
  
  const config = new MockConfigService({
    VNPAY_TMN_CODE: 'TESTCODE',
    VNPAY_HASH_SECRET: 'TESTSECRET1234567890',
    VNPAY_SANDBOX_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    VNPAY_RETURN_URL: 'http://localhost:3000/payment/result',
  });

  const adapter = new VnpayAdapter(config);
  
  const params = {
    amount: 100000,
    orderId: 'ORDER_123456',
    orderDescription: 'Test Order 123456',
    ipAddress: '127.0.0.1',
    idempotencyKey: 'IDEMP_KEY_123',
  };

  const url = await adapter.createPaymentUrl(params);
  console.log('Generated URL:', url);
  
  if (!url.includes('vnp_SecureHash=') || !url.includes('vnp_Amount=10000000')) {
    console.error('FAIL: URL missing secure hash or incorrect amount');
  } else {
    console.log('SUCCESS: URL format appears correct.');
  }

  const queryStr = url.split('?')[1];
  const queryObj = qs.parse(queryStr);

  const mockCallback = { ...queryObj };
  mockCallback['vnp_ResponseCode'] = '00';
  mockCallback['vnp_TransactionStatus'] = '00';
  mockCallback['vnp_TransactionNo'] = '123456789';

  let vnp_Params = { ...mockCallback };
  delete vnp_Params['vnp_SecureHash'];
  
  const sorted = {};
  Object.keys(vnp_Params).sort().forEach(k => {
    sorted[k] = vnp_Params[k];
  });
  
  const signData = qs.stringify(sorted, { encode: false });
  const hmac = crypto.createHmac('sha512', 'TESTSECRET1234567890');
  mockCallback['vnp_SecureHash'] = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  const result = await adapter.verifyCallback(mockCallback);
  if (result && result.status === 'SUCCESS' && result.amount === 100000 && result.providerTransactionId === '123456789') {
    console.log('SUCCESS: Valid signature verified and mapped correctly.', result);
  } else {
    console.error('FAIL: Signature verification failed or mapping incorrect', result);
  }

  mockCallback['vnp_SecureHash'] = 'invalidhash123';
  const badResult = await adapter.verifyCallback(mockCallback);
  if (badResult === null) {
    console.log('SUCCESS: Invalid signature correctly rejected.');
  } else {
    console.error('FAIL: Invalid signature was accepted!');
  }
}

testVnpay();
