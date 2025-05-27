export default async function handler(req, res) {
  const targetUrl = 'https://script.google.com/macros/s/AKfycbz3CSvc9M2uG0et-H5-awxV3bMHSThBv25zOsMcayfOemv0V15ps3SUbvclV2RBxEkJdw/exec';

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: 'Proxy failed' });
  }
}
