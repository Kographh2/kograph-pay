export default function Authentication() {
  return (
    <>
      <h1>Authentication</h1>
      <p>Every API request must include three headers:</p>
      <pre><code>{`Authorization: Bearer <APIKEY>
X-User-Id:    <ID-USERS>
Content-Type: application/json
Idempotency-Key: <unique-per-request>`}</code></pre>
      <p>The pair <code>(APIKEY, ID-USERS)</code> is validated server-side. The APIKEY is stored hashed; the ID-USERS identifies the account that owns the resulting transactions.</p>
      <h2>Public key</h2>
      <p>The <code>PUBLIC-KEY</code> is a separate token, intended for use in the browser. It can only read a single transaction&apos;s public status and serves the QR image:</p>
      <pre><code>{`X-Public-Key: <PUBLIC-KEY>`}</code></pre>
      <p>The public key may be passed either as a header or as a <code>?public_key=…</code> / <code>?pk=…</code> query string parameter.</p>
    </>
  );
}