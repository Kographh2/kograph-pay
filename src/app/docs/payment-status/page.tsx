export default function PaymentStatus() {
  return (
    <>
      <h1>Payment status</h1>
      <pre><code>{`GET /api/v1/payments/{transactionId}
Authorization: Bearer <APIKEY>
X-User-Id:    <ID-USERS>`}</code></pre>
      <pre><code>{`{
  "success": true,
  "data": {
    "transaction_id": "trx_abc123",
    "reference_id": "ORDER-1",
    "amount": 25000,
    "status": "paid",
    "paid_at": "2026-09-05T15:02:00+07:00"
  }
}`}</code></pre>
      <p>Lookup by your own reference id:</p>
      <pre><code>{`GET /api/v1/payments/reference/{referenceId}`}</code></pre>
      <p>Public read endpoint (browser-friendly, no API key):</p>
      <pre><code>{`GET /api/v1/public/payments/{transactionId}
X-Public-Key: <PUBLIC-KEY>`}</code></pre>
    </>
  );
}