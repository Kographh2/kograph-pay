export default function CreatePayment() {
  return (
    <>
      <h1>Create payment</h1>
      <pre><code>{`POST /api/v1/payments
Authorization: Bearer <APIKEY>
X-User-Id:    <ID-USERS>
Idempotency-Key: ORDER-1
Content-Type: application/json

{
  "amount": 25000,
  "reference_id": "ORDER-1",
  "customer_name": "Budi",
  "customer_email": "budi@example.com",
  "description": "Pembelian Produk"
}`}</code></pre>
      <h2>Response</h2>
      <pre><code>{`{
  "success": true,
  "data": {
    "transaction_id": "trx_abc123",
    "reference_id": "ORDER-1",
    "amount": 25000,
    "currency": "IDR",
    "status": "pending",
    "qr_image_url": "https://files.catbox.moe/...jpg",
    "payment_url": "https://saweria.co/qris/...",
    "expires_at": "2026-09-05T15:00:00+07:00"
  }
}`}</code></pre>
      <h2>Idempotency</h2>
      <p>The <code>Idempotency-Key</code> header is required. Re-posting the same <code>reference_id</code> for the same user returns the original transaction.</p>
    </>
  );
}