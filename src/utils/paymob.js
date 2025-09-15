
// const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
// const PAYMOB_WALLET_INTEGRATION_ID = process.env.PAYMOB_WALLET_INTEGRATION_ID;
// const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;

// export async function initiatePaymobPayment(amount, orderId, type, itemId) {
//   // Step 1: Auth
//   const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ api_key: PAYMOB_API_KEY })
//   });
//   const { token } = await authRes.json();

//   console.log("token => " ,token)

//   // Step 2: Register order
//   const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ auth_token: token, amount_cents: amount * 100, currency: 'EGP', items: [{ name: `${type} ${itemId}`, amount_cents: amount * 100, quantity: 1 }] })
//   });
//   const { id: paymobOrderId } = await orderRes.json();

//   console.log("orderRes => " ,orderRes)

//   // Step 3: Get payment key for wallet
//   const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       auth_token: token,
//       order_id: paymobOrderId,
//       integration_id: PAYMOB_WALLET_INTEGRATION_ID,
//       billing_data: { email: 'user@email.com' } // Add user data
//     })
//   });
//   const { token: paymentKey } = await keyRes.json();

//     console.log("paymentKey => " ,paymentKey)


//   // Wallet redirect URL
//   return `https://accept.paymob.com/api/acceptance/iframes/?payment_token=${paymentKey}`;
// }

// export function verifyPaymobWebhook(req) {
//   // Verify HMAC (implement using PAYMOB_HMAC_SECRET and req.body)
//   // Return true if valid
//   // Example: const hmac = crypto.createHmac('sha512', PAYMOB_HMAC_SECRET).update(JSON.stringify(req.body)).digest('hex');
//   // return hmac === req.body.hmac;
//   return true; // Placeholder
// }



import crypto from "crypto";
import prisma from "../loaders/prisma.js";


const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const PAYMOB_CARD_INTEGRATION_ID = process.env.PAYMOB_CARD_INTEGRATION_ID;
const PAYMOB_IFRAME_ID = process.env.PAYMOB_CARD_IFRAME_ID;
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;

export async function initiatePaymobPayment(amount, orderId, type, itemId, userId) {
  // Step 1: Auth
  const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: PAYMOB_API_KEY })
  });
  const { token } = await authRes.json();

  // Step 2: Register order
  const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: token,
      delivery_needed: false,
      amount_cents: amount * 100,
      currency: 'EGP',
      items: [{
        name: `${type} ${itemId}`,
        amount_cents: amount * 100,
        quantity: 1
      }]
    })
  });
  const { id: paymobOrderId } = await orderRes.json();

  const user = await prisma.user.findUnique({
    where: {id: userId}
  })


  // Step 3: Get Payment Key
  const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: token,
      order_id: paymobOrderId,
      integration_id: PAYMOB_CARD_INTEGRATION_ID,
      amount_cents: amount * 100,
      currency: 'EGP',
      billing_data: {
        first_name: user.firstName || "Student",
        last_name: user.lastName || "User",
        email: user.email || "test@example.com",
        phone_number: user.phone || "+201000000000",
        apartment: "NA",
        floor: "NA",
        street: "NA",
        building: "NA",
        shipping_method: "NA",
        postal_code: "NA",
        city: "NA",
        country: "EG",
        state: "NA"
      }
    })
  });

  console.log("keyRes => ", keyRes)

  const { token: paymentKey } = await keyRes.json();

  // Step 4: Return iframe URL (Card checkout)
  return `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`;
}


export function verifyPaymobWebhook(req) {
  const hmacSent = req.query.hmac; // Paymob sends HMAC in query params
  const secret = PAYMOB_HMAC_SECRET;

  // Flatten object as per Paymob docs
  const { amount_cents, created_at, currency, error_occured, has_parent_transaction,
    id, integration_id, is_3d_secure, is_auth, is_capture, is_refunded, is_standalone_payment,
    is_voided, order, owner, pending, source_data_pan, source_data_sub_type,
    source_data_type, success } = req.body.obj;

  const string = `${amount_cents}${created_at}${currency}${error_occured}${has_parent_transaction}${id}${integration_id}${is_3d_secure}${is_auth}${is_capture}${is_refunded}${is_standalone_payment}${is_voided}${order.id}${owner}${pending}${source_data_pan}${source_data_sub_type}${source_data_type}${success}`;

  const hmac = crypto.createHmac('sha512', secret).update(string).digest('hex');

  console.log("hmacSent => ", hmacSent)
  console.log("hmac => ", hmac)

  return hmac === hmacSent;
}
