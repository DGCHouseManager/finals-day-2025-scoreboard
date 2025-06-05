const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbz3CSvc9M2uG0et-H5-awxV3bMHSThBv25zOsMcayfOemv0V15ps3SUbvclV2RBxEkJdw/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const result = await response.text();
    res.status(200).send(result);
  } catch (err) {
    res.status(500).json({ error: 'Proxy request failed', details: err.message });
  }
};
