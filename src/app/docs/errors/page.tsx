export default function Errors() {
  return (
    <>
      <h1>Errors</h1>
      <pre><code>{`{
  "success": false,
  "error": { "code": "INVALID_REQUEST", "message": "Amount must be greater than zero" }
}`}</code></pre>
      <h2>Codes</h2>
      <ul>
        <li><code>UNAUTHORIZED</code> — missing or invalid API key / public key (401)</li>
        <li><code>IDEMPOTENCY_REQUIRED</code> — missing <code>Idempotency-Key</code> header (400)</li>
        <li><code>INVALID_REQUEST</code> — Zod validation failed (400)</li>
        <li><code>NOT_FOUND</code> — transaction not found (404)</li>
        <li><code>PROVIDER_ERROR</code> — Saweria upstream error (502)</li>
        <li><code>AMOUNT_MISMATCH</code> — webhook reported less than expected (400)</li>
        <li><code>RATE_LIMITED</code> — slow down (429)</li>
        <li><code>EMAIL_TAKEN</code> — registration email exists (409)</li>
        <li><code>INVALID_CREDENTIALS</code> — bad login (401)</li>
      </ul>
    </>
  );
}