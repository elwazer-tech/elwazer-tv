export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('Missing target url');
  }

  const isM3u8 = url.endsWith('.m3u8');
  const isTs = url.endsWith('.ts');
  const isHtml = url.includes('/matches-'); // لدعم جلب صفحات جدول المباريات فائق السرعة وبثبات تام

  // إذا لم يكن الطلب يخص المباريات أو الجدول، نقوم بالتحويل لتفادي انهيار فيرسل
  if (!isM3u8 && !isTs && !isHtml) {
    res.writeHead(302, { Location: url });
    return res.end();
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        'Accept': '*/*'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    // معالجة جلب جدول مباريات اليوم والأمس والغد فائق السرعة
    if (isHtml) {
      const htmlText = await response.text();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(htmlText);
    }

    if (isM3u8) {
      let text = await response.text();
      
      const finalUrl = response.url || url;
      const targetBase = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['host'];
      const proxyUrl = `${protocol}://${host}/api/proxy`;

      const lines = text.split('\n').map(line => {
        line = line.trim();
        if (line.startsWith('#') || line === '') {
          return line;
        }
        
        let absoluteUrl = line;
        if (!line.startsWith('http://') && !line.startsWith('https://')) {
          absoluteUrl = new URL(line, targetBase).href;
        }
        
        return `${proxyUrl}?url=${encodeURIComponent(absoluteUrl)}`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.status(200).send(lines.join('\n'));
    }

    // لقطع بث الـ TS الصغيرة الخاصة بالمباريات
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', contentType || 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(Buffer.from(buffer));

  } catch (error) {
    return res.status(500).send('Proxy Error: ' + error.message);
  }
}
