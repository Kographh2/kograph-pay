export default function Webhooks() {
  return (
    <>
      <h1>Webhooks</h1>
      <p>Saweria posts donation events to <code>POST /api/v1/webhooks/saweria</code>. On the first payment, this API auto-registers that URL with Saweria via <code>saweria-createqr</code>.</p>
      <h2>Payload</h2>
      <pre><code>{`{
  "version": "2022.01",
  "created_at": "2026-09-05T15:02:00+07:00",
  "id": "00000000-0000-0000-0000-000000000000",
  "type": "donation",
  "amount_raw": 25000,
  "cut": 1250,
  "donator_name": "Budi",
  "donator_email": "budi@example.com",
  "donator_is_user": false,
  "message": "Thanks!",
  "etc": { "amount_to_display": 25000 }
}`}</code></pre>
      <h2>Matching</h2>
      <p>We match by <code>id</code> against the stored <code>providerTransactionId</code> on the transaction. Amount is validated (<code>amount_raw &gt;= expected</code>). Duplicates are deduped by <code>(provider, eventId)</code>.</p>
    </>
  );
}