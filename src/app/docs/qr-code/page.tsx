export default function QrCode() {
  return (
    <>
      <h1>QR code</h1>
      <h2>Direct image</h2>
      <pre><code>{`GET /api/v1/payments/{transactionId}/qr
X-Public-Key: <PUBLIC-KEY>`}</code></pre>
      <pre><code>{`<img src="{API_URL}/api/v1/payments/{id}/qr?public_key={PUBLIC_KEY}" />`}</code></pre>
      <h2>Hosted pay page</h2>
      <pre><code>{`<a href="{API_URL}/pay/{id}?pk={PUBLIC_KEY}">Pay now</a>`}</code></pre>
      <p>The pay page polls <code>/api/v1/public/payments/:id</code> every 4 seconds using the public key, and shows a live countdown.</p>
    </>
  );
}