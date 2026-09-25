const { Readable } = require('stream');

module.exports = async (req, res) => {
  const { url } = req.query;

  // التأكد من وجود رابط
  if (!url) {
    return res.status(400).send("Error: URL parameter is required");
  }

  // السماح للمتصفح بالوصول وتخطي الـ CORS
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

    // دعم تقديم وترجيع الفيديو (Range Requests)
    if (req.headers.range) {
      fetchHeaders['Range'] = req.headers.range;
    }

    // جلب الفيديو وتتبع التحويلات (Redirects) التلقائية
    const upstream = await fetch(url, {
      headers: fetchHeaders,
      redirect: 'follow'
    });

    // تمرير الهيدرز الهامة للمشغل
    ['content-range', 'accept-ranges', 'content-length', 'content-type'].forEach(h => {
      if (upstream.headers.has(h)) {
        res.setHeader(h, upstream.headers.get(h));
      }
    });

    res.status(upstream.status);

    // بث الفيديو مباشرة للمتصفح بدون تقطيع
    Readable.fromWeb(upstream.body).pipe(res);

  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).send("Proxy Streaming Error: " + error.message);
  }
};
