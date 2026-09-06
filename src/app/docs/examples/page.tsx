export default function Examples() {
  return (
    <>
      <h1>Examples</h1>
      <h2>JavaScript (Node)</h2>
      <pre><code>{`const res = await fetch(\`\${API_URL}/api/v1/payments\`, {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${APIKEY}\`,
    "X-User-Id": ID_USERS,
    "Idempotency-Key": "ORDER-1",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ amount: 25000, reference_id: "ORDER-1" })
});
const { data } = await res.json();`}</code></pre>

      <h2>Browser (customer page)</h2>
      <pre><code>{`<img src={\`\${API_URL}/api/v1/payments/\${data.transaction_id}/qr?public_key=\${PUBLIC_KEY}\`} />`}</code></pre>

      <h2>PHP</h2>
      <pre><code>{`$ch = curl_init("$API_URL/api/v1/payments");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Authorization: Bearer $APIKEY",
  "X-User-Id: $ID_USERS",
  "Idempotency-Key: ORDER-1",
  "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["amount"=>25000,"reference_id"=>"ORDER-1"]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
echo curl_exec($ch);`}</code></pre>

      <h2>Python</h2>
      <pre><code>{`import requests
r = requests.post(f"{API_URL}/api/v1/payments",
  headers={
    "Authorization": f"Bearer {APIKEY}",
    "X-User-Id": ID_USERS,
    "Idempotency-Key": "ORDER-1"
  },
  json={"amount": 25000, "reference_id": "ORDER-1"})
print(r.json())`}</code></pre>
    </>
  );
}