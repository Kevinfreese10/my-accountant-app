import crypto from 'crypto';

const payload: Record<string, string> = {
  "pf_payment_id": "302124135",
  "custom_str4": "",
  "custom_str5": "",
  "custom_str1": "",
  "amount_gross": "450.00",
  "signature": "b9bc3bb2ad1a387ce5d41461c19bfd19",
  "payment_status": "COMPLETE",
  "custom_int3": "",
  "m_payment_id": "9890",
  "name_last": "Freese",
  "custom_str3": "",
  "custom_int1": "",
  "item_description": "Annual Returns",
  "item_name": "Order #9890",
  "custom_int2": "",
  "custom_str2": "",
  "email_address": "freesekevin@gmail.com",
  "custom_int4": "",
  "merchant_id": "23836312",
  "name_first": "Kevin",
  "amount_net": "431.14",
  "custom_int5": "",
  "amount_fee": "-18.86"
};

const passphrases = ["Thinkestry10$", "KhaiFreese10", ""];

// Let's try standard PayFast ITN order, alphabetical order, etc.
// 1. Alphabetical Order (commonly used by many PayFast SDKs despite doc claiming otherwise)
console.log("--- Alphabetical Order ---");
for (const passphrase of passphrases) {
  const keys = Object.keys(payload).filter(k => k !== 'signature' && payload[k] !== '').sort();
  const signatureString = keys.map(k => `${k}=${encodeURIComponent(payload[k]).replace(/%20/g, '+')}`).join('&') + (passphrase ? `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}` : '');
  const hash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log(`Passphrase: ${passphrase || 'None'}`);
  console.log(`String: ${signatureString}`);
  console.log(`MD5: ${hash} | Match: ${hash === payload.signature}`);
}

// 2. Documentation order / Standard Order
// Standard Order from PayFast PHP SDK:
const standardOrder = [
  'm_payment_id',
  'pf_payment_id',
  'payment_status',
  'item_name',
  'item_description',
  'amount_gross',
  'amount_fee',
  'amount_net',
  'custom_str1',
  'custom_str2',
  'custom_str3',
  'custom_str4',
  'custom_str5',
  'custom_int1',
  'custom_int2',
  'custom_int3',
  'custom_int4',
  'custom_int5',
  'name_first',
  'name_last',
  'email_address',
  'merchant_id'
];

console.log("\n--- Documentation / SDK Order ---");
for (const passphrase of passphrases) {
  const keys = standardOrder.filter(k => payload[k] !== undefined && payload[k] !== '');
  const signatureString = keys.map(k => `${k}=${encodeURIComponent(payload[k]).replace(/%20/g, '+')}`).join('&') + (passphrase ? `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}` : '');
  const hash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log(`Passphrase: ${passphrase || 'None'}`);
  console.log(`String: ${signatureString}`);
  console.log(`MD5: ${hash} | Match: ${hash === payload.signature}`);
}

// 3. What if we include empty values in the order?
console.log("\n--- Standard Order with Empty Fields (our current code behaviour but with standard order) ---");
for (const passphrase of passphrases) {
  const keys = standardOrder;
  const signatureString = keys.map(k => `${k}=${encodeURIComponent(payload[k] || '').replace(/%20/g, '+')}`).join('&') + (passphrase ? `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}` : '');
  const hash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log(`Passphrase: ${passphrase || 'None'}`);
  console.log(`MD5: ${hash} | Match: ${hash === payload.signature}`);
}

// 4. Try all permutations or standard keys
console.log("\n--- Standard Order but with URL-decoded values vs URL-encoded values ---");
for (const passphrase of passphrases) {
  const keys = standardOrder.filter(k => payload[k] !== undefined && payload[k] !== '');
  const signatureString = keys.map(k => `${k}=${payload[k]}`).join('&') + (passphrase ? `&passphrase=${passphrase}` : '');
  const hash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log(`Passphrase: ${passphrase || 'None'}`);
  console.log(`String: ${signatureString}`);
  console.log(`MD5: ${hash} | Match: ${hash === payload.signature}`);
}
