import pg from 'pg';
import https from 'https';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// Translation cache
const translateCache = new Map();

function translate(text, targetLang) {
  if (!text || targetLang === 'en') return Promise.resolve(text);
  const key = `${text.substring(0,150)}:${targetLang}`;
  if (translateCache.has(key)) return Promise.resolve(translateCache.get(key));
  
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(text.substring(0, 400));
    https.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encoded}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          const translated = r[0].map(x => x[0]).join('');
          translateCache.set(key, translated);
          resolve(translated);
        } catch(e) { resolve(text); }
      });
    }).on('error', () => resolve(text));
    setTimeout(() => resolve(text), 3000);
  });
}

// i18n templates for category descriptions
const i18nTemplates = {
  en: {
    browse: 'Browse',
    photosVideos: 'photos and videos',
    freeGallery: 'Free gallery with HD streaming',
    collection: 'collection',
    watchNow: 'Watch now',
    highQuality: 'High quality content',
    regularUpdates: 'Regular updates',
    exclusive: 'Exclusive content'
  },
  de: {
    browse: 'Durchsuchen',
    photosVideos: 'Fotos und Videos',
    freeGallery: 'Kostenlose Galerie mit HD-Streaming',
    collection: 'Sammlung',
    watchNow: 'Jetzt ansehen',
    highQuality: 'Hochwertige Inhalte',
    regularUpdates: 'Regelmäßige Updates',
    exclusive: 'Exklusive Inhalte'
  },
  fr: {
    browse: 'Parcourir',
    photosVideos: 'photos et vidéos',
    freeGallery: 'Galerie gratuite avec streaming HD',
    collection: 'collection',
    watchNow: 'Regarder maintenant',
    highQuality: 'Contenu de haute qualité',
    regularUpdates: 'Mises à jour régulières',
    exclusive: 'Contenu exclusif'
  },
  es: {
    browse: 'Explorar',
    photosVideos: 'fotos y videos',
    freeGallery: 'Galería gratis con streaming HD',
    collection: 'colección',
    watchNow: 'Ver ahora',
    highQuality: 'Contenido de alta calidad',
    regularUpdates: 'Actualizaciones regulares',
    exclusive: 'Contenido exclusivo'
  },
  pt: {
    browse: 'Navegar',
    photosVideos: 'fotos e vídeos',
    freeGallery: 'Galeria grátis com streaming HD',
    collection: 'coleção',
    watchNow: 'Assistir agora',
    highQuality: 'Conteúdo de alta qualidade',
    regularUpdates: 'Atualizações regulares',
    exclusive: 'Conteúdo exclusivo'
  },
  it: {
    browse: 'Sfoglia',
    photosVideos: 'foto e video',
    freeGallery: 'Galleria gratuita con streaming HD',
    collection: 'collezione',
    watchNow: 'Guarda ora',
    highQuality: 'Contenuti di alta qualità',
    regularUpdates: 'Aggiornamenti regolari',
    exclusive: 'Contenuti esclusivi'
  },
  nl: {
    browse: 'Bekijk',
    photosVideos: "foto's en video's",
    freeGallery: 'Gratis galerij met HD-streaming',
    collection: 'collectie',
    watchNow: 'Nu bekijken',
    highQuality: 'Hoge kwaliteit content',
    regularUpdates: 'Regelmatige updates',
    exclusive: 'Exclusieve content'
  },
  ru: {
    browse: 'Просмотреть',
    photosVideos: 'фото и видео',
    freeGallery: 'Бесплатная галерея с HD стримингом',
    collection: 'коллекция',
    watchNow: 'Смотреть сейчас',
    highQuality: 'Высокое качество',
    regularUpdates: 'Регулярные обновления',
    exclusive: 'Эксклюзивный контент'
  },
  pl: {
    browse: 'Przeglądaj',
    photosVideos: 'zdjęć i filmów',
    freeGallery: 'Darmowa galeria z HD streaming',
    collection: 'kolekcja',
    watchNow: 'Oglądaj teraz',
    highQuality: 'Wysokiej jakości',
    regularUpdates: 'Regularne aktualizacje',
    exclusive: 'Ekskluzywna zawartość'
  },
  ja: {
    browse: '閲覧',
    photosVideos: '写真と動画',
    freeGallery: 'HDストリーミング付き無料ギャラリー',
    collection: 'コレクション',
    watchNow: '今すぐ見る',
    highQuality: '高品質コンテンツ',
    regularUpdates: '定期更新',
    exclusive: '限定コンテンツ'
  },
  zh: {
    browse: '浏览',
    photosVideos: '照片和视频',
    freeGallery: '免费高清流媒体画廊',
    collection: '合集',
    watchNow: '立即观看',
    highQuality: '高质量内容',
    regularUpdates: '定期更新',
    exclusive: '独家内容'
  },
  ko: {
    browse: '둘러보기',
    photosVideos: '사진과 동영상',
    freeGallery: 'HD 스트리밍 무료 갤러리',
    collection: '컬렉션',
    watchNow: '지금 보기',
    highQuality: '고품질 콘텐츠',
    regularUpdates: '정기 업데이트',
    exclusive: '독점 콘텐츠'
  },
  th: {
    browse: 'เรียกดู',
    photosVideos: 'รูปภาพและวิดีโอ',
    freeGallery: 'แกลเลอรีฟรีพร้อม HD สตรีมมิ่ง',
    collection: 'คอลเลกชัน',
    watchNow: 'ดูเลย',
    highQuality: 'เนื้อหาคุณภาพสูง',
    regularUpdates: 'อัปเดตเป็นประจำ',
    exclusive: 'เนื้อหาพิเศษ'
  },
  tr: {
    browse: 'Göz at',
    photosVideos: 'fotoğraf ve video',
    freeGallery: 'HD yayın ile ücretsiz galeri',
    collection: 'koleksiyon',
    watchNow: 'Şimdi izle',
    highQuality: 'Yüksek kaliteli içerik',
    regularUpdates: 'Düzenli güncellemeler',
    exclusive: 'Özel içerik'
  },
  ar: {
    browse: 'تصفح',
    photosVideos: 'صور وفيديوهات',
    freeGallery: 'معرض مجاني مع بث عالي الدقة',
    collection: 'مجموعة',
    watchNow: 'شاهد الآن',
    highQuality: 'محتوى عالي الجودة',
    regularUpdates: 'تحديثات منتظمة',
    exclusive: 'محتوى حصري'
  }
};

// Category keyword templates (brand name stays same, descriptors translated)
const categoryPatterns = {
  'AlexBoys': { type: 'studio', variations: ['alexboys', 'alex boys'] },
  'BelAmiOnLine': { type: 'studio', variations: ['belami', 'bel ami', 'belami online'] },
  'BoyFun': { type: 'studio', variations: ['boyfun', 'boy fun'] },
  'Staxus': { type: 'studio', variations: ['staxus'] },
  'EnglishLads': { type: 'studio', variations: ['english lads', 'englishlads', 'uk lads'] },
  'JapanBoyz': { type: 'studio', variations: ['japanboyz', 'japan boyz', 'japanese boys'] },
  'GayLifeNetwork': { type: 'studio', variations: ['gay life network', 'gaylifenetwork'] },
  'EnigmaticBoys': { type: 'studio', variations: ['enigmatic boys', 'enigmaticboys'] },
  'Todays Post': { type: 'generic', variations: ['new', 'latest', 'daily'] },
  'Lost Treasures': { type: 'generic', variations: ['classic', 'vintage', 'archive'] },
  '8teenBoy': { type: 'studio', variations: ['8teenboy', '8teen boy'] },
  'HelixStudios': { type: 'studio', variations: ['helix studios', 'helix'] },
  'FreshmenEurope': { type: 'studio', variations: ['freshmen', 'freshmen europe'] },
  'CorbinFisher': { type: 'studio', variations: ['corbin fisher', 'cf'] },
  'SeanCody': { type: 'studio', variations: ['sean cody', 'sc'] },
  'Fratmen': { type: 'studio', variations: ['fratmen', 'frat men'] },
  'ActiveDuty': { type: 'studio', variations: ['active duty', 'activeduty'] },
  'RandyBlue': { type: 'studio', variations: ['randy blue', 'randyblue'] },
  'NextDoorStudios': { type: 'studio', variations: ['next door', 'nextdoor'] },
  'BoyCrush': { type: 'studio', variations: ['boy crush', 'boycrush'] },
  'EastBoys': { type: 'studio', variations: ['east boys', 'eastboys'] }
};

// Translated keyword suffixes by language
const keywordSuffixes = {
  en: ['gallery', 'photos', 'videos', 'free', 'HD'],
  de: ['galerie', 'fotos', 'videos', 'kostenlos', 'HD'],
  fr: ['galerie', 'photos', 'vidéos', 'gratuit', 'HD'],
  es: ['galería', 'fotos', 'videos', 'gratis', 'HD'],
  pt: ['galeria', 'fotos', 'vídeos', 'grátis', 'HD'],
  it: ['galleria', 'foto', 'video', 'gratis', 'HD'],
  nl: ['galerij', 'fotos', 'videos', 'gratis', 'HD'],
  ru: ['галерея', 'фото', 'видео', 'бесплатно', 'HD'],
  pl: ['galeria', 'zdjęcia', 'filmy', 'za darmo', 'HD'],
  ja: ['ギャラリー', '写真', '動画', '無料', 'HD'],
  zh: ['画廊', '照片', '视频', '免费', '高清'],
  ko: ['갤러리', '사진', '동영상', '무료', 'HD'],
  th: ['แกลเลอรี', 'รูปภาพ', 'วิดีโอ', 'ฟรี', 'HD'],
  tr: ['galeri', 'fotoğraflar', 'videolar', 'ücretsiz', 'HD'],
  ar: ['معرض', 'صور', 'فيديو', 'مجاني', 'HD']
};

// Generate SEO for a category in a specific language
function generateCategorySeoForLang(cat, lang) {
  const t = i18nTemplates[lang] || i18nTemplates.en;
  const suffixes = keywordSuffixes[lang] || keywordSuffixes.en;
  const pattern = categoryPatterns[cat.catname];
  
  // Generate keywords
  let keywords = [];
  if (pattern) {
    // Use brand variations
    keywords = pattern.variations.slice(0, 2);
    // Add with translated suffixes (but keep brand in original)
    keywords.push(`${pattern.variations[0]} ${suffixes[0]}`); // brand + gallery
    keywords.push(`${pattern.variations[0]} ${suffixes[1]}`); // brand + photos
    keywords.push(`${pattern.variations[0]} ${suffixes[2]}`); // brand + videos
  } else {
    // Generic category
    const baseName = cat.catname.toLowerCase();
    keywords = [
      baseName,
      `${baseName} ${suffixes[0]}`,
      `${baseName} ${suffixes[1]}`,
      `${baseName} ${suffixes[2]}`
    ];
  }
  
  // Limit to 5 keywords to avoid stuffing
  keywords = keywords.slice(0, 5);
  
  // Generate natural description
  const count = cat.photo_count.toLocaleString();
  const description = `${t.browse} ${count} ${cat.catname} ${t.photosVideos}. ${t.freeGallery}. ${t.regularUpdates}.`;
  
  // Generate title (max 60 chars)
  let title = `${cat.catname} - ${t.freeGallery} | BoyVue`;
  if (title.length > 60) {
    title = `${cat.catname} | BoyVue Gallery`;
  }
  
  return {
    title: title.substring(0, 60),
    description: description.substring(0, 155),
    keywords: keywords.join(', ')
  };
}

async function generateAllCategorySeo() {
  console.log('Generating i18n-compliant category SEO...\n');
  
  const languages = Object.keys(i18nTemplates);
  
  // Get all categories
  const cats = await pool.query(`
    SELECT id, catname, photo_count 
    FROM category 
    WHERE photo_count > 0 
    ORDER BY photo_count DESC
  `);
  
  console.log(`Processing ${cats.rows.length} categories × ${languages.length} languages...\n`);
  
  let count = 0;
  
  for (const cat of cats.rows) {
    for (const lang of languages) {
      try {
        const seo = generateCategorySeoForLang(cat, lang);
        
        await pool.query(`
          INSERT INTO category_seo (category_id, language, seo_title, seo_description, seo_keywords, generated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (category_id, language) 
          DO UPDATE SET 
            seo_title = EXCLUDED.seo_title, 
            seo_description = EXCLUDED.seo_description, 
            seo_keywords = EXCLUDED.seo_keywords, 
            generated_at = NOW()
        `, [cat.id, lang, seo.title, seo.description, seo.keywords]);
        
        count++;
      } catch(e) {
        console.error(`Error for ${cat.catname}/${lang}:`, e.message);
      }
    }
    console.log(`✓ ${cat.catname} (${languages.length} languages)`);
  }
  
  console.log(`\n✅ Generated ${count} category SEO entries`);
  
  // Show samples
  console.log('\n--- Sample SEO entries ---\n');
  
  const samples = await pool.query(`
    SELECT c.catname, cs.language, cs.seo_title, cs.seo_keywords
    FROM category_seo cs
    JOIN category c ON cs.category_id = c.id
    WHERE c.catname IN ('BelAmiOnLine', 'Staxus', 'JapanBoyz')
    AND cs.language IN ('en', 'de', 'ja', 'ru')
    ORDER BY c.catname, cs.language
  `);
  
  for (const row of samples.rows) {
    console.log(`[${row.language}] ${row.catname}:`);
    console.log(`  Title: ${row.seo_title}`);
    console.log(`  Keywords: ${row.seo_keywords}\n`);
  }
  
  pool.end();
}

generateAllCategorySeo();
