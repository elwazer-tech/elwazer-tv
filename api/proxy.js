// api/proxy.js

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
    if (!str) return '';
    if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('<')) {
      return str;
    }
    const b64Decoded = Buffer.from(str, 'base64').toString('utf-8');
    return xorEncryptDecrypt(b64Decoded, SECRET_KEY);
  } catch(e) {
    return str;
  }
}

// دالة التشفير الآمن باستخدام المفتاح السري لقطع الـ TS والـ fmp4
function encodeURL(str) {
  try {
    const xored = xorEncryptDecrypt(str, SECRET_KEY);
    return Buffer.from(xored, 'utf-8').toString('base64');
  } catch(e) {
    return str;
  }
}

// البروكسي الخلفي الذكي لفك تشفير الـ Referer المدمج تلقائياً وتسريع جلب المباريات
module.exports = async (req, res) => {
  let { url, ref } = req.query; // قراءة الـ url والـ ref (الـ Referer المخصص)

  if (!url) {
    return res.status(400).send('Missing target url');
  }

  let decryptedUrl = decodeURL(url);
  let targetReferer = ref ? decodeURL(ref) : ''; // فك تشفير الـ Referer إذا كان ممرراً مشفراً

  // الكشف التلقائي والذكي عن الـ Referer المدمج داخل الرابط بعد فك تشفيره (لحل مشكلة التشفير المزدوج)
  if (!targetReferer && decryptedUrl.includes('|')) {
    const parts = decryptedUrl.split('|');
    decryptedUrl = parts[0];
    const refParam = parts.find(p => p.toLowerCase().startsWith('referer='));
    if (refParam) {
      targetReferer = refParam.split('=')[1];
    }
  }

  // ── قفل النطاق الصارم (Strict Domain Lock) ──
  const refererHeader = req.headers['referer'] || '';
  const allowedDomains = ['elwazer-tv.vercel.app', 'elwazer-tech.github.io', 'elwazer-tv.blogspot.com'];
  
  if (!refererHeader) {
    return res.status(403).send('Forbidden: Direct access is not allowed.');
  }
  
  const isAllowed = allowedDomains.some(domain => refererHeader.includes(domain));
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
          'Referer': targetReferer || (targetOrigin + '/')
        }
      });
      if (embedResponse.ok) {
        let html = await embedResponse.text();
        html = html.replace(/(src|href)=["'](?!https?:\/\/|\/\/)([^"']+)["']/g, `$1="${targetOrigin}/$2"`);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.removeHeader('Content-Security-Policy');
        return res.status(200).send(html);
      }
    } catch (e) {
      console.error('Iframe Bypass Failed:', e.message);
    }
  }

  const isM3u8 = decryptedUrl.includes('.m3u8');
  const isHtml = decryptedUrl.includes('/matches-'); 

  // دعم بروكسة جميع قطع البث المباشر الحديثة والتقليدية وملفات التكوين لمنع الحظر والتقطيع
  const isMediaSegment = decryptedUrl.includes('.ts') || 
                         decryptedUrl.includes('.fmp4') || 
                         decryptedUrl.includes('.m4s') || 
                         decryptedUrl.includes('.mp4') || 
                         decryptedUrl.includes('.key') || 
                         decryptedUrl.includes('.aac') || 
                         decryptedUrl.includes('seg') ||
                         decryptedUrl.includes('fragment');

  if (!isM3u8 && !isMediaSegment && !isHtml) {
    res.writeHead(302, { Location: decryptedUrl });
    return res.end();
  }

  try {
    const headers = {
      'Accept': '*/*'
    };

    if (isHtml) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    } else if (targetReferer) {
      headers['Referer'] = targetReferer;
      try {
        headers['Origin'] = new URL(targetReferer).origin;
      } catch (e) {}
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    } else {
      headers['User-Agent'] = 'VLC/3.0.18 LibVLC/3.0.18';
    }

    const response = await fetch(decryptedUrl, { headers });
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

      const getProxyUrl = (targetUrl) => {
        const encrypted = encodeURL(targetUrl);
        let pUrl = `${proxyUrl}?url=${encodeURIComponent(encrypted)}`;
        if (targetReferer) { // نستخدم targetReferer لضمان تمريره لقطع الفيديو حتى في التشفير المزدوج
          pUrl += `&ref=${encodeURIComponent(targetReferer)}`;
        }
        return pUrl;
      };

      const lines = text.split('\n').map(line => {
        line = line.trim();
        if (line === '') return line;

        if (line.startsWith('#')) {
          if (line.includes('URI=')) {
            return line.replace(/URI=["']([^"']+)["']/g, (match, relUrl) => {
              let absoluteUrl = relUrl;
              if (!relUrl.startsWith('http://') && !relUrl.startsWith('https://')) {
                absoluteUrl = new URL(relUrl, targetBase).href;
              }
              return `URI="${getProxyUrl(absoluteUrl)}"`;
            });
          }
          return line;
        }
        
        let absoluteUrl = line;
        if (!line.startsWith('http://') && !line.startsWith('https://')) {
          absoluteUrl = new URL(line, targetBase).href;
        }
        return getProxyUrl(absoluteUrl);
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
