
const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const PAYMOB_WALLET_INTEGRATION_ID = process.env.PAYMOB_WALLET_INTEGRATION_ID;
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;

export async function initiatePaymobPayment(amount, orderId, type, itemId) {
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
    body: JSON.stringify({ auth_token: token, amount_cents: amount * 100, currency: 'EGP', items: [{ name: `${type} ${itemId}`, amount_cents: amount * 100, quantity: 1 }] })
  });
  const { id: paymobOrderId } = await orderRes.json();

  // Step 3: Get payment key for wallet
  const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: token,
      order_id: paymobOrderId,
      integration_id: PAYMOB_WALLET_INTEGRATION_ID,
      billing_data: { email: 'user@email.com' } // Add user data
    })
  });
  const { token: paymentKey } = await keyRes.json();

  // Wallet redirect URL
  return `https://accept.paymob.com/api/acceptance/iframes/?payment_token=${paymentKey}`;
}

export function verifyPaymobWebhook(req) {
  // Verify HMAC (implement using PAYMOB_HMAC_SECRET and req.body)
  // Return true if valid
  // Example: const hmac = crypto.createHmac('sha512', PAYMOB_HMAC_SECRET).update(JSON.stringify(req.body)).digest('hex');
  // return hmac === req.body.hmac;
  return true; // Placeholder
}