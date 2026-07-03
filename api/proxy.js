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

// البروكسي الخلفي المتوافق 100% مع فيرسل (نسخة CommonJS المحدثة لفايرفوكس)
module.exports = async (req, res) => {
  let { url } = req.query;

  if (!url) {
    return res.status(400).send('Missing target url');
  }

  const decryptedUrl = decodeURL(url);

  // ── قفل النطاق الصارم والمطور لمتصفح فايرفوكس (Strict Domain Lock for Firefox) ──
  const referer = req.headers['referer'] || '';
  const origin = req.headers['origin'] || ''; // فايرفوكس يرسل الـ Origin حتى لو قام بحظر الـ Referer للخصوصية
  const allowedDomains = ['elwazer-tv.vercel.app', 'elwazer-tech.github.io', 'blogspot.com'];
  
  // منع الطلب تماماً إذا كان خالياً من الهيدرز (مثل برامج التحميل و VLC)
  if (!referer && !origin) {
    return res.status(403).send('Forbidden: Direct access is not allowed.');
  }
  
  // التحقق من توافق الدومين عبر الـ Referer أو الـ Origin الاحتياطي
  const isAllowed = allowedDomains.some(domain => referer.includes(domain) || origin.includes(domain));
  if (!isAllowed) {
    return res.status(403).send('Forbidden: Domain not allowed.');
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
