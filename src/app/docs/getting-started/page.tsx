export default function GettingStarted() {
  return (
    <>
      <h1>Getting started</h1>
      <p>QRIS Engine is a per-account QRIS payment gateway. You sign up, mint credentials, and start calling the API in minutes.</p>

      <h2>1. Create an account</h2>
      <p>Visit <code>/register</code> and create an account. You will be assigned the <strong>USER</strong> role. The first admin must be created from the environment (see README).</p>

      <h2>2. Mint your credentials</h2>
      <p>From the dashboard:</p>
      <ul>
        <li><strong>ID-USERS</strong> — your account id (visible on the dashboard).</li>
        <li><strong>APIKEY</strong> — server-side secret. Used to call the API from your backend. Never expose it to the browser.</li>
        <li><strong>PUBLIC-KEY</strong> — public token. Used by the customer-facing <code>/pay/:id</code> page. Safe to embed in HTML.</li>
      </ul>

      <h2>3. Create a payment</h2>
      <pre><code>{`curl -X POST $API_URL/api/v1/payments \\
  -H "Authorization: Bearer $APIKEY" \\
  -H "X-User-Id: $ID_USERS" \\
  -H "Idempotency-Key: ORDER-1" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 25000,
    "reference_id": "ORDER-1",
    "customer_name": "Budi"
  }'`}</code></pre>

      <h2>4. Display the QR</h2>
      <pre><code>{`<img src={\`\${API_URL}/api/v1/payments/\${transaction_id}/qr?public_key=\${PUBLIC_KEY}\`} />`}</code></pre>
      <p>Or open the hosted pay page:</p>
      <pre><code>{`/pay/<transaction_id>?pk=<PUBLIC_KEY>`}</code></pre>

      <h2>5. Detect payment</h2>
      <p>Either poll the status endpoint or rely on Saweria&apos;s webhook to your server. The hosted <code>/pay/:id</code> page polls automatically using the public key.</p>
    </>
  );
}