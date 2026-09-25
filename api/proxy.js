const { Readable } = require('stream');

module.exports = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("Error: URL parameter is required");
  }

  // السماح لجميع المتصفحات وتخطي CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    };

    // دعم تقديم وترجيع الفيديو
    if (req.headers.range) {
      fetchHeaders['Range'] = req.headers.range;
    }

    // جلب البث وتتبع بورت 2095 والتحويلات
    const upstream = await fetch(url, {
      headers: fetchHeaders,
      redirect: 'follow',
    });

    ['content-range', 'accept-ranges', 'content-length', 'content-type'].forEach(h => {
      if (upstream.headers.has(h)) {
        res.setHeader(h, upstream.headers.get(h));
      }
    });

    res.setHeader('Content-Disposition', 'inline');
    res.status(upstream.status);

    // بث الفيديو مباشرة
    Readable.fromWeb(upstream.body).pipe(res);

  } catch (error) {
    res.status(500).send("Proxy Streaming Error: " + error.message);
  }
};
