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

// دالة التشفير الآمن باستخدام المفتاح السري لقطع الـ TS
function encodeURL(str) {
  try {
    const xored = xorEncryptDecrypt(str, SECRET_KEY);
    return Buffer.from(xored, 'utf-8').toString('base64');
  } catch(e) {
    return str;
  }
}

// البروكسي الخلفي المطور والمعدل لدعم قطع البث الحديثة fmp4 و m4s
module.exports = async (req, res) => {
  let { url, ref } = req.query; // قراءة الـ url والـ ref (الـ Referer المخصص)

  if (!url) {
    return res.status(400).send('Missing target url');
  }

  const decryptedUrl = decodeURL(url);
  const targetReferer = ref ? decodeURL(ref) : ''; // فك تشفير الـ Referer إذا كان ممرراً مشفراً

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
  const isHtml = decryptedUrl.includes('/matches-'); 

  // دعم بروكسة جميع قطع البث المباشر الحديثة والتقليدية لمنع إعادة توجيه المتصفح للحظر
  const isMediaSegment = decryptedUrl.includes('.ts') || 
                         decryptedUrl.includes('.fmp4') || 
                         decryptedUrl.includes('.m4s') || 
                         decryptedUrl.includes('.mp4') || 
                         decryptedUrl.includes('.key') || 
                         decryptedUrl.includes('.aac') || 
                         decryptedUrl.includes('seg');

  if (!isM3u8 && !isMediaSegment && !isHtml) {
    res.writeHead(302, { Location: decryptedUrl });
    return res.end();
  }

  try {
    const headers = {
      'Accept': '*/*'
    };

    if (target
