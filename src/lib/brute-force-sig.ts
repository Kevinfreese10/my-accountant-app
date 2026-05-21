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

const passphrases = [
  "Thinkestry10$", 
  "KhaiFreese10", 
  "Thinkestry10", 
  "KhaiFreese10$", 
  "info@myacc.co.za", 
  ""
];

// Helper to URL encode as PayFast expects (spaces as +, uppercase percent encoding)
function payfastEncode(str: string, usePlusForSpace = true, uppercasePercent = true): string {
  let encoded = encodeURIComponent(str);
  if (usePlusForSpace) {
    encoded = encoded.replace(/%20/g, '+');
  }
  if (uppercasePercent) {
    encoded = encoded.replace(/%[0-9a-fA-F]{2}/g, (match) => match.toUpperCase());
  } else {
    encoded = encoded.replace(/%[0-9a-fA-F]{2}/g, (match) => match.toLowerCase());
  }
  return encoded;
}

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

function runTest() {
  console.log("Starting brute force signature matching with plain-text passphrases...");

  const orders = [
    { name: "Standard Order", keys: standardOrder },
    { name: "Alphabetical Order", keys: Object.keys(payload).sort() }
  ];

  for (const order of orders) {
    for (const excludeEmpty of [true, false]) {
      for (const usePlusForSpace of [true, false]) {
        for (const uppercasePercent of [true, false]) {
          for (const passphrase of passphrases) {
            for (const encodePass of [true, false]) {
              let activeKeys = order.keys.filter(k => k !== 'signature');
              if (excludeEmpty) {
                activeKeys = activeKeys.filter(k => payload[k] !== undefined && payload[k] !== '');
              }

              // Build signature string
              const pairs: string[] = [];
              for (const key of activeKeys) {
                const val = payload[key] || '';
                pairs.push(`${key}=${payfastEncode(val, usePlusForSpace, uppercasePercent)}`);
              }
              let sigStr = pairs.join('&');
              if (passphrase) {
                const passVal = encodePass ? payfastEncode(passphrase, usePlusForSpace, uppercasePercent) : passphrase;
                sigStr += `&passphrase=${passVal}`;
              }

              const hash = crypto.createHash('md5').update(sigStr).digest('hex');
              if (hash === payload.signature) {
                console.log("!!! MATCH FOUND !!!");
                console.log(`Order style: ${order.name}`);
                console.log(`Exclude empty: ${excludeEmpty}`);
                console.log(`Use plus for space: ${usePlusForSpace}`);
                console.log(`Uppercase percent: ${uppercasePercent}`);
                console.log(`Encode passphrase: ${encodePass}`);
                console.log(`Passphrase: "${passphrase}"`);
                console.log(`Signature string: ${sigStr}`);
                console.log(`Hash: ${hash}`);
                return;
              }
            }
          }
        }
      }
    }
  }

  // Let's also check the actual order as keys in the payload
  const rawKeys = Object.keys(payload);
  for (const excludeEmpty of [true, false]) {
    for (const usePlusForSpace of [true, false]) {
      for (const uppercasePercent of [true, false]) {
        for (const passphrase of passphrases) {
          for (const encodePass of [true, false]) {
            let activeKeys = rawKeys.filter(k => k !== 'signature');
            if (excludeEmpty) {
              activeKeys = activeKeys.filter(k => payload[k] !== undefined && payload[k] !== '');
            }

            const pairs: string[] = [];
            for (const key of activeKeys) {
              const val = payload[key] || '';
              pairs.push(`${key}=${payfastEncode(val, usePlusForSpace, uppercasePercent)}`);
            }
            let sigStr = pairs.join('&');
            if (passphrase) {
              const passVal = encodePass ? payfastEncode(passphrase, usePlusForSpace, uppercasePercent) : passphrase;
              sigStr += `&passphrase=${passVal}`;
            }

            const hash = crypto.createHash('md5').update(sigStr).digest('hex');
            if (hash === payload.signature) {
              console.log("!!! MATCH FOUND IN RAW KEYS !!!");
              console.log(`Exclude empty: ${excludeEmpty}`);
              console.log(`Use plus for space: ${usePlusForSpace}`);
              console.log(`Uppercase percent: ${uppercasePercent}`);
              console.log(`Encode passphrase: ${encodePass}`);
              console.log(`Passphrase: "${passphrase}"`);
              console.log(`Signature string: ${sigStr}`);
              console.log(`Hash: ${hash}`);
              return;
            }
          }
        }
      }
    }
  }

  console.log("No match found even with plain-text passphrase.");
}

runTest();
