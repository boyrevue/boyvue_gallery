import https from 'https';

const cache = new Map();

export function translate(text, targetLang) {
  if (!text || targetLang === 'en') return Promise.resolve(text);
  
  const key = `${text}:${targetLang}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(text.substring(0, 400));
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encoded}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          const translated = r[0].map(x => x[0]).join('');
          cache.set(key, translated);
          resolve(translated);
        } catch(e) { resolve(text); }
      });
    }).on('error', () => resolve(text));
    
    setTimeout(() => resolve(text), 3000);
  });
}
