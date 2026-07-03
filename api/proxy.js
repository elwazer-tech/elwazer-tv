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

// البروكسي الخلفي المتوافق 100% مع فيرسل (نسخة كسر حظر التضمين Iframe)
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

  // ── مستخرج وممرر صفحات الـ Embed لكسر حظر التضمين وبدون أخطاء ──
  const isEmbedPage = decryptedUrl.includes('/embed-') || 
                      decryptedUrl.includes('anafast.org') || 
                      decryptedUrl.includes('vidspeed') ||
                      decryptedUrl.includes('mysportv.live') ||
                      decryptedUrl.includes('albaplayer');
  
  if (isEmbedPage) {
    try {
      const targetOrigin = new URL(decryptedUrl).origin;
      const embedResponse = await fetch(decryptedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Referer': targetOrigin + '/'
        }
      });
      if (embedResponse.ok) {
        let html = await embedResponse.text();
        
        // تعديل الروابط الداخلية للمشغل لتعمل من السورس الأصلي دون انقطاع
        html = html.replace(/(src|href)=["'](?!https?:\/\/|\/\/)([^"']+)["']/g, `$1="${targetOrigin}/$2"`);

        // كسر قفل الحماية وتخطي الـ X-Frame-Options للسماح بالتضمين لمدونتك
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Frame-Options', 'ALLOWALL'); // السماح بالتضمين الكامل
        res.removeHeader('Content-Security-Policy'); // إزالة سياسة الحظر
        
        return res.status(200).send(html);
      }
    } catch (e) {
      console.error('Iframe Bypass Failed:', e.message);
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
