// مفتاح التشفير السري الموحد
const SECRET_KEY = 'elwazer_tv_secret_key'; 

function xorEncryptDecrypt(str, key) {
  let output = '';
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    output += String.fromCharCode(charCode);
  }
  return output;
}

// دالة فك التشفير الآمن باستخدام المفتاح السري
function decodeURL(str) {
  try {
    if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('<')) {
      return str;
    }
    const b64Decoded = Buffer.from(str, 'base64').toString('utf-8');
    return xorEncryptDecrypt(b64Decoded, SECRET_KEY);
  } catch(e) {
    return str;
  }
}

// دالة التشفير الآمن باستخدام المفتاح السري لقطع الـ TS
function encodeURL(str) {
  try {
    const xored = xorEncryptDecrypt(str, SECRET_KEY);
    return Buffer.from(xored, 'utf-8').toString('base64');
  } catch(e) {
    return str;
  }
}

// دالة فك تشفير حزم جافا سكريبت التلقائية Packer Unpacker
function unpackPacker(code) {
  try {
    const matcher = code.match(/eval\(function\(p,a,c,k,e,r\)\{.*return\s+p\}\('(.*)',\s*(\d+),\s*(\d+),\s*'(.*)'\.split\('\|'\)/);
    if (!matcher) {
      const matcher2 = code.match(/eval\(function\(p,a,c,k,e,d\)\{.*return\s+p\}\('(.*)',\s*(\d+),\s*(\d+),\s*'(.*)'\.split\('\|'\)/);
      if (!matcher2) return code;
      return runUnpack(matcher2[1], parseInt(matcher2[2]), parseInt(matcher2[3]), matcher2[4].split('|'));
    }
    return runUnpack(matcher[1], parseInt(matcher[2]), parseInt(matcher[3]), matcher[4].split('|'));
  } catch (e) {
    return code;
  }
}

function runUnpack(p, a, c, k) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

// البروكسي الخلفي المتوافق بالكامل مع فيرسل
module.exports = async (req, res) => {
  let { url } = req.query;

  if (!url) {
    return res.status(400).send('Missing target url');
  }

  const decryptedUrl = decodeURL(url);

  // ── قفل النطاق الصارم (Strict Domain Lock) ──
  const referer = req.headers['referer'] || '';
  const allowedDomains = ['elwazer-tv.vercel.app', 'elwazer-tech.github.io', 'blogspot.com'];
  
  if (!referer) {
    return res.status(403).send('Forbidden: Direct access is not allowed.');
  }
  
  const isAllowed = allowedDomains.some(domain => referer.includes(domain));
  if (!isAllowed) {
    return res.status(403).send('Forbidden: Domain not allowed.');
  }

  // ── مستخرج الروابط التلقائي الذكي من صفحات الـ Embed ──
  const isEmbedPage = decryptedUrl.includes('/embed-') || decryptedUrl.includes('anafast.org') || decryptedUrl.includes('vidspeed');
  
  if (isEmbedPage) {
    try {
      const embedResponse = await fetch(decryptedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Referer': decryptedUrl
        }
      });
      if (embedResponse.ok) {
        let html = await embedResponse.text();
        const unpackedHtml = unpackPacker(html);
        
        // البحث عن رابط البث المباشر الفعلي mp4 أو m3u8 المخفي بداخل الصفحة
        const streamRx = /(https?:\/\/[^"'\s]+\.(?:mp4|m3u8)[^"'\s]*)/i;
        const match = unpackedHtml.match(streamRx);
        
        if (match && match[1]) {
          const rawStreamUrl = match[1];
          // عمل تحويل تلقائي ولحظي للمتصفح إلى رابط الفيديو الفعلي لتشغيله بمشغلك الخاص!
          res.writeHead(302, { Location: rawStreamUrl });
          return res.end();
        }
      }
    } catch (e) {
      console.error('Auto Extraction Failed:', e.message);
    }
  }

  const isM3u8 = decryptedUrl.includes('.m3u8');
  const isTs = decryptedUrl.includes('.ts');
  const isHtml = decryptedUrl.includes('/matches-'); 

  if (!isM3u8 && !isTs && !isHtml) {
    res.writeHead(302, { Location: decryptedUrl });
    return res.end();
  }

  try {
    const response = await fetch(decryptedUrl, {
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        'Accept': '*/*'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    if (isHtml) {
      const htmlText = await response.text();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(htmlText);
    }

    if (isM3u8) {
      let text = await response.text();
      
      const finalUrl = response.url || decryptedUrl;
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
        
        const encryptedTs = encodeURL(absoluteUrl);
        return `${proxyUrl}?url=${encodeURIComponent(encryptedTs)}`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.status(200).send(lines.join('\n'));
    }

    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', contentType || 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(Buffer.from(buffer));

  } catch (error) {
    return res.status(500).send('Proxy Error: ' + error.message);
  }
};
