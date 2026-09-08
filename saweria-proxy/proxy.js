import express from 'express';

const app = express();
app.use(express.json());

const SAWERIA_BACKEND = 'https://backend.saweria.co';

app.post('/saweria/*', async (req, res) => {
  try {
    const path = req.path.replace('/saweria', '');
    const url = `${SAWERIA_BACKEND}${path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(req.headers.authorization && { Authorization: req.headers.authorization }),
    };

    const saweriaRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

    const text = await saweriaRes.text();
    res.set({
      'Content-Type': saweriaRes.headers.get('content-type') || 'application/json',
    });
    res.status(saweriaRes.status).send(text);
  } catch (err) {
    console.error('[proxy] error:', err);
    res.status(500).json({ error: 'Proxy failed', message: err instanceof Error ? err.message : String(err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Saweria proxy listening on ${port}`);
});
