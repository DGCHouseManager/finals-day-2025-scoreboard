module.exports = async (req, res) => {
  const url = process.env.GOOGLE_SCRIPT_URL;

  if (!url) {
    return res.status(500).json({ error: 'Missing GOOGLE_SCRIPT_URL environment variable' });
  }

  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body),
    });

    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to forward request to Google Apps Script' });
  }
};
