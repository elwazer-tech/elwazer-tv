// Cloudflare Worker Proxy + Link Encryptor Dashboard
// نسخة مطورة وموفرة للطلبات بنسبة 95% عبر تمرير قطع الفيديو مباشرة وتخفيف الضغط

const SECRET_KEY = 'elwazer_tv_secret_key'; 
const ALLOWED_DOMAINS = ['wezoo.elwazer772.workers.dev', 'elwazer-tech.github.io', 'elwazer-tv.blogspot.com'];

function xorEncryptDecrypt(str, key) {
  let output = '';
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    output += String.fromCharCode(charCode);
  }
  return output;
}

function base64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binString = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binString += String.fromCharCode(bytes[i]);
  }
  return btoa(binString);
}

function base64Decode(str) {
  const binString = atob(str);
  const size = binString.length;
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function decodeURL(str) {
  try {
    if (!str) return '';
    if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('<')) {
      return str;
    }
    const b64Decoded = base64Decode(str);
    return xorEncryptDecrypt(b64Decoded, SECRET_KEY);
  } catch(e) {
    return str;
  }
}

function encodeURL(str) {
  try {
    const xored = xorEncryptDecrypt(str, SECRET_KEY);
    return base64Encode(xored);
  } catch(e) {
    return str;
  }
}

export default {
  async fetch(request, env, ctx) {
    const urlObj = new URL(request.url);

    // 1. مسار خاص لعرض صفحة التشفير الذكية مدمجة بالسيرفر لتسهيل الاستخدام
    if (urlObj.pathname === '/encrypt' || urlObj.pathname === '/encrypt.html') {
      const dynamicProxyPrefix = `${urlObj.origin}${urlObj.pathname.replace('/encrypt.html', '').replace('/encrypt', '')}/?url=`;
      
      const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>لوحة تشفير الروابط - Elwazer TV</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
    :root {
      --void: #070809;
      --base: #0e1014;
      --card: #13161c;
      --border: #1e2330;
      --red: #e63946;
      --red-hover: #ff4757;
      --green: #2ecc71;
    }
    body { 
      font-family: 'Tajawal', sans-serif; 
      background: var(--void); 
      color: #dde3f0; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh; 
      margin: 0; 
    }
    .card { 
      background: var(--card); 
      border: 1px solid var(--border); 
      padding: 30px; 
      border-radius: 12px; 
      width: 100%; 
      max-width: 550px; 
      text-align: center; 
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
    }
    h2 { font-weight: 800; margin-bottom: 8px; color: #fff; }
    input { 
      width: 100%; 
      padding: 12px; 
      background: #191d26; 
      border: 1px solid var(--border); 
      color: #fff; 
      border-radius: 8px; 
      margin-bottom: 20px; 
      font-size: 14px; 
      box-sizing: border-box; 
      outline: none;
      font-family: monospace;
    }
    input:focus { border-color: var(--red); }
    .btn-group { display: flex; gap: 10px; margin-bottom: 20px; }
    button { 
      flex: 1;
      background: #191d26; 
      color: #fff; 
      border: 1px solid var(--border); 
      padding: 12px; 
      border-radius: 8px; 
      cursor: pointer; 
      font-weight: bold; 
      font-family: 'Tajawal', sans-serif;
      transition: all 0.15s;
    }
    button.primary { background: var(--red); border-color: var(--red); }
    button.primary:hover { background: var(--red-hover); border-color: var(--red-hover); }
    button.secondary:hover { background: var(--border); border-color: #2a3048; }
    
    .result-container { position: relative; width: 100%; }
    textarea { 
      width: 100%; 
      height: 110px; 
      background: #191d26; 
      border: 1px solid var(--border); 
      color: var(--green); 
      border-radius: 8px; 
      padding: 12px; 
      font-family: monospace; 
      resize: none; 
      box-sizing: border-box; 
      outline: none;
      font-size: 13px;
    }
    .btn-copy {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: var(--green);
      margin-top: 12px;
      width: 100%;
    }
    .btn-copy:hover {
      background: rgba(34, 197, 94, 0.2);
    }
    #toast-msg {
      display: none;
      color: var(--green);
      font-size: 13px;
      margin-top: 8px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>مشفّر الروابط الذكي والمزدوج</h2>
    <p style="color: #7a8499; margin-bottom: 20px; font-size: 13px;">ضع الرابط الأصلي بالأسفل لإنتاج الكود المناسب لملف config.json فوراً</p>
    
    <input type="text" id="rawUrl" placeholder="أدخل رابط الـ IPTV أو الفيلم هنا...">
    
    <div class="btn-group">
      <button class="primary" onclick="generateDouble()">⚽ تشفير مزدوج (للمباريات)</button>
      <button class="secondary" onclick="generateSingle()">🎬 تشفير عادي (للأفلام)</button>
    </div>
    
    <div class="result-container">
      <textarea id="result" readonly="readonly" placeholder="سيظهر الكود المشفر هنا..."></textarea>
      <button class="btn-copy" onclick="copyCode()">📋 نسخ الكود المشفر</button>
      <div id="toast-msg">✓ تم نسخ الكود بنجاح إلى الحافظة!</div>
    </div>
  </div>

  <script>
    const SECRET_KEY = '${SECRET_KEY}'; 
    const PROXY_PREFIX = '${dynamicProxyPrefix}';

    function xorEncryptDecrypt(str, key) {
      let output = '';
      for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        output += String.fromCharCode(charCode);
      }
      return output;
    }

    function encryptRaw(url) {
      const xored = xorEncryptDecrypt(url, SECRET_KEY);
      return btoa(xored);
    }

    function generateSingle() {
      const url = document.getElementById('rawUrl').value.trim();
      if(!url) return alert('الرجاء إدخال رابط أولاً');
      const encrypted = encryptRaw(url);
      document.getElementById('result').value = encrypted;
    }

    function generateDouble() {
      const url = document.getElementById('rawUrl').value.trim();
      if(!url) return alert('الرجاء إدخال رابط أولاً');
      
      const step1 = encryptRaw(url);
      const combinedUrl = PROXY_PREFIX + step1;
      const finalEncrypted = encryptRaw(combinedUrl);
      
      document.getElementById('result').value = finalEncrypted;
    }

    function copyCode() {
      const resultArea = document.getElementById('result');
      if (!resultArea.value) {
        alert('الرجاء تشفير رابط أولاً لنسخه!');
        return;
      }
      navigator.clipboard.writeText(resultArea.value).then(() => {
        const toast = document.getElementById('toast-msg');
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2500);
      }).catch(err => {
        alert('فشل النسخ التلقائي، يرجى نسخ الكود يدوياً');
      });
    }
  </script>
</body>
</html>
      `;
      return new Response(htmlContent, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // 2. معالجة طلبات البروكسي كالمعتاد
    let { searchParams } = urlObj;
    let url = searchParams.get('url');
    let ref = searchParams.get('ref');

    if (!url) {
      return new Response('Missing target URL', { status: 400 });
    }

    let decryptedUrl = decodeURL(url);
    let targetReferer = ref ? decodeURL(ref) : '';

    if (!targetReferer && decryptedUrl.includes('|')) {
      const parts = decryptedUrl.split('|');
      decryptedUrl = parts[0];
      const refParam = parts.find(p => p.toLowerCase().startsWith('referer='));
      if (refParam) {
        targetReferer = refParam.split('=')[1];
      }
    }

    const refererHeader = request.headers.get('referer') || '';
    const isAllowed = ALLOWED_DOMAINS.some(domain => refererHeader.includes(domain));
    
    if (!refererHeader && ALLOWED_DOMAINS.length > 0) {
      return new Response('Forbidden: Direct access is not allowed.', { status: 403 });
    }
    if (!isAllowed && ALLOWED_DOMAINS.length > 0) {
      return new Response('Forbidden: Domain not allowed.', { status: 403 });
    }

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
          
          return new Response(html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'X-Frame-Options': 'ALLOWALL'
            }
          });
        }
      } catch (e) {
        console.error('Iframe Bypass Failed:', e.message);
      }
    }

    const isM3u8 = decryptedUrl.includes('.m3u8');
    const isHtml = decryptedUrl.includes('/matches') || decryptedUrl.includes('/matches-') || decryptedUrl.includes('filgoal.com'); 

    const isMediaSegment = decryptedUrl.includes('.ts') || 
                           decryptedUrl.includes('.fmp4') || 
                           decryptedUrl.includes('.m4s') || 
                           decryptedUrl.includes('.mp4') || 
                           decryptedUrl.includes('.key') || 
                           decryptedUrl.includes('.aac') || 
                           decryptedUrl.includes('seg') ||
                           decryptedUrl.includes('fragment');

    if (!isM3u8 && !isMediaSegment && !isHtml) {
      return Response.redirect(decryptedUrl, 302);
    }

    try {
      const headers = new Headers({
        'Accept': '*/*'
      });

      if (isHtml) {
        headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      } else if (targetReferer) {
        headers.set('Referer', targetReferer);
        try {
          headers.set('Origin', new URL(targetReferer).origin);
        } catch (e) {}
        headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      } else {
        headers.set('User-Agent', 'VLC/3.0.18 LibVLC/3.0.18');
      }

      const response = await fetch(decryptedUrl, { headers });
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      if (isHtml) {
        const htmlText = await response.text();
        responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
        return new Response(htmlText, { status: 200, headers: responseHeaders });
      }

      if (isM3u8) {
        let text = await response.text();
        const finalUrl = response.url || decryptedUrl;
        const targetBase = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
        const proxyUrl = `${urlObj.origin}${urlObj.pathname}`;

        const getProxyUrl = (targetUrl) => {
          // لتوفير الطلبات بنسبة 95%:
          // إذا كان الرابط هو قطعة فيديو .ts أو .mp4، نمررها مباشرة لتعمل في جهاز الزائر دون المرور بسيرفر كلاود فلير
          if (targetUrl.includes('.ts') || targetUrl.includes('.mp4') || targetUrl.includes('.m4s') || targetUrl.includes('.key') || targetUrl.includes('.aac') || targetUrl.includes('seg') || targetUrl.includes('fragment')) {
            return targetUrl;
          }

          const encrypted = encodeURL(targetUrl);
          let pUrl = `${proxyUrl}?url=${encodeURIComponent(encrypted)}`;
          if (targetReferer) {
            pUrl += `&ref=${encodeURIComponent(encodeURL(targetReferer))}`;
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

        responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
        return new Response(lines.join('\n'), { status: 200, headers: responseHeaders });
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'video/mp2t';
      responseHeaders.set('Content-Type', contentType);
      responseHeaders.set('Cache-Control', 'public, max-age=86400');
      return new Response(buffer, { status: 200, headers: responseHeaders });

    } catch (error) {
      return new Response('Proxy Error: ' + error.message, { status: 500 });
    }
  }
};
