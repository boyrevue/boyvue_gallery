/**
 * SEO Keyword Generator
 * Generates bi-grams, tri-grams, and multilingual keyword sets
 * All content refers to legal adults 18+ years of age
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// All 20 supported languages
const LANGUAGES = {
  en: { name: 'English', flag: '🇬🇧' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
  ru: { name: 'Русский', flag: '🇷🇺' },
  es: { name: 'Español', flag: '🇪🇸' },
  zh: { name: '中文', flag: '🇨🇳' },
  ja: { name: '日本語', flag: '🇯🇵' },
  th: { name: 'ไทย', flag: '🇹🇭' },
  ko: { name: '한국어', flag: '🇰🇷' },
  pt: { name: 'Português', flag: '🇧🇷' },
  fr: { name: 'Français', flag: '🇫🇷' },
  it: { name: 'Italiano', flag: '🇮🇹' },
  nl: { name: 'Nederlands', flag: '🇳🇱' },
  pl: { name: 'Polski', flag: '🇵🇱' },
  cs: { name: 'Čeština', flag: '🇨🇿' },
  ar: { name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  el: { name: 'Ελληνικά', flag: '🇬🇷' },
  vi: { name: 'Tiếng Việt', flag: '🇻🇳' },
  id: { name: 'Indonesia', flag: '🇮🇩' },
  tr: { name: 'Türkçe', flag: '🇹🇷' },
  hu: { name: 'Magyar', flag: '🇭🇺' }
};

// Core keyword stems (unigrams)
const UNIGRAMS = {
  en: ['nude', 'naked', 'twink', 'gay', 'boy', 'young', 'man', 'male', 'teen', 'adult', 'photo', 'video', 'gallery', 'free', 'hot', 'sexy', 'amateur', 'solo', 'slim', 'smooth', 'cute'],
  de: ['nackt', 'schwul', 'junge', 'jung', 'mann', 'männlich', 'foto', 'video', 'galerie', 'kostenlos', 'heiß', 'amateur', 'schlank', 'glatt', 'süß'],
  es: ['desnudo', 'gay', 'chico', 'joven', 'hombre', 'masculino', 'foto', 'video', 'galería', 'gratis', 'caliente', 'amateur', 'delgado', 'suave', 'lindo'],
  fr: ['nu', 'gay', 'garçon', 'jeune', 'homme', 'masculin', 'photo', 'vidéo', 'galerie', 'gratuit', 'chaud', 'amateur', 'mince', 'lisse', 'mignon'],
  ru: ['голый', 'обнаженный', 'гей', 'парень', 'молодой', 'мужчина', 'мужской', 'фото', 'видео', 'галерея', 'бесплатно', 'горячий', 'любительский', 'стройный', 'гладкий'],
  zh: ['裸体', '同志', '男孩', '年轻', '男人', '男性', '照片', '视频', '画廊', '免费', '热门', '业余', '苗条', '光滑', '可爱'],
  ja: ['ヌード', 'ゲイ', '男子', '若い', '男性', '写真', '動画', 'ギャラリー', '無料', 'ホット', 'アマチュア', 'スリム', 'スムース', 'かわいい'],
  ko: ['누드', '게이', '소년', '젊은', '남자', '남성', '사진', '비디오', '갤러리', '무료', '핫', '아마추어', '날씬한', '매끈한', '귀여운'],
  th: ['เปลือย', 'เกย์', 'หนุ่ม', 'ชาย', 'ภาพ', 'วิดีโอ', 'แกลเลอรี่', 'ฟรี', 'ร้อน', 'มือสมัครเล่น', 'ผอม', 'เรียบ', 'น่ารัก'],
  pt: ['nu', 'gay', 'garoto', 'jovem', 'homem', 'masculino', 'foto', 'vídeo', 'galeria', 'grátis', 'quente', 'amador', 'magro', 'liso', 'fofo'],
  it: ['nudo', 'gay', 'ragazzo', 'giovane', 'uomo', 'maschile', 'foto', 'video', 'galleria', 'gratis', 'caldo', 'amatoriale', 'magro', 'liscio', 'carino'],
  nl: ['naakt', 'gay', 'jongen', 'jong', 'man', 'mannelijk', 'foto', 'video', 'galerij', 'gratis', 'heet', 'amateur', 'slank', 'glad', 'schattig'],
  pl: ['nagi', 'gej', 'chłopak', 'młody', 'mężczyzna', 'męski', 'zdjęcie', 'wideo', 'galeria', 'darmowy', 'gorący', 'amator', 'szczupły', 'gładki', 'uroczy'],
  cs: ['nahý', 'gay', 'kluk', 'mladý', 'muž', 'mužský', 'foto', 'video', 'galerie', 'zdarma', 'horký', 'amatér', 'štíhlý', 'hladký', 'roztomilý'],
  ar: ['عاري', 'مثلي', 'فتى', 'شاب', 'رجل', 'ذكر', 'صورة', 'فيديو', 'معرض', 'مجاني', 'ساخن', 'هاوي', 'نحيف', 'ناعم', 'لطيف'],
  el: ['γυμνός', 'γκέι', 'αγόρι', 'νέος', 'άνδρας', 'αρσενικός', 'φωτογραφία', 'βίντεο', 'γκαλερί', 'δωρεάν', 'καυτό', 'ερασιτέχνης', 'λεπτός', 'λείος', 'χαριτωμένος'],
  vi: ['khỏa thân', 'gay', 'trai', 'trẻ', 'nam', 'ảnh', 'video', 'thư viện', 'miễn phí', 'nóng', 'nghiệp dư', 'gầy', 'mịn', 'dễ thương'],
  id: ['telanjang', 'gay', 'cowok', 'muda', 'pria', 'foto', 'video', 'galeri', 'gratis', 'panas', 'amatir', 'kurus', 'halus', 'imut'],
  tr: ['çıplak', 'gay', 'oğlan', 'genç', 'erkek', 'fotoğraf', 'video', 'galeri', 'ücretsiz', 'sıcak', 'amatör', 'zayıf', 'pürüzsüz', 'tatlı'],
  hu: ['meztelen', 'meleg', 'fiú', 'fiatal', 'férfi', 'kép', 'videó', 'galéria', 'ingyenes', 'forró', 'amatőr', 'karcsú', 'sima', 'aranyos']
};

// Generate bi-grams from unigrams
function generateBigrams(words) {
  const bigrams = [];
  for (let i = 0; i < words.length; i++) {
    for (let j = 0; j < words.length; j++) {
      if (i !== j) {
        bigrams.push(`${words[i]} ${words[j]}`);
      }
    }
  }
  return bigrams;
}

// Generate tri-grams from unigrams
function generateTrigrams(words) {
  const trigrams = [];
  for (let i = 0; i < words.length; i++) {
    for (let j = 0; j < words.length; j++) {
      for (let k = 0; k < words.length; k++) {
        if (i !== j && j !== k && i !== k) {
          trigrams.push(`${words[i]} ${words[j]} ${words[k]}`);
        }
      }
    }
  }
  // Return top 500 random trigrams to avoid explosion
  return trigrams.sort(() => Math.random() - 0.5).slice(0, 500);
}

// Core keyword phrases for SEO
const CORE_PHRASES = {
  en: [
    'nude teen boys 18+', 'legal teen boys naked', '18 plus young men nude',
    'twink photos free', 'gay boy gallery', 'naked young men pics',
    'amateur twink videos', 'nude male photos', 'sexy gay boys 18+',
    'young adult male nude', 'college boys naked', 'cute twink pictures',
    'smooth boy photos', 'slim young men nude', 'hot gay twink gallery',
    'free nude boy photos', 'gay teen 18+ videos', 'naked twink gallery',
    'young gay photos', 'male nude art', 'solo twink videos',
    'athletic young men nude', 'asian twink photos', 'european gay boys',
    'latin twink gallery', 'amateur gay videos', 'hd gay photos'
  ],
  de: [
    'nackte junge männer 18+', 'schwule jungs fotos', 'twink galerie kostenlos',
    'nackte twinks bilder', 'gay video kostenlos', 'junge männer nackt fotos',
    'amateur schwule videos', 'nackte männer galerie', 'süße twink bilder',
    'schlanke junge männer nackt', 'heiße gay twink galerie'
  ],
  es: [
    'chicos desnudos 18+', 'fotos gay gratis', 'galería twink',
    'jóvenes desnudos fotos', 'videos gay amateur', 'galería hombres desnudos',
    'fotos twink lindos', 'jóvenes delgados desnudos', 'galería gay caliente'
  ],
  fr: [
    'garçons nus 18+', 'photos gay gratuites', 'galerie twink',
    'jeunes hommes nus photos', 'vidéos gay amateur', 'galerie hommes nus',
    'photos twink mignons', 'jeunes minces nus', 'galerie gay chaude'
  ],
  ru: [
    'голые парни 18+', 'гей фото бесплатно', 'твинк галерея',
    'молодые мужчины голые фото', 'гей видео любительское', 'галерея голых мужчин',
    'фото милых твинков', 'стройные молодые парни голые', 'горячая гей галерея'
  ],
  pt: [
    'garotos nus 18+', 'fotos gay grátis', 'galeria twink',
    'jovens nus fotos', 'vídeos gay amador', 'galeria homens nus',
    'fotos twink fofos', 'jovens magros nus', 'galeria gay quente'
  ],
  zh: [
    '裸体男孩18+', '同志照片免费', '小鲜肉画廊',
    '年轻男人裸体照片', '同志视频业余', '裸体男人画廊',
    '可爱小鲜肉照片', '苗条年轻男人裸体', '热门同志画廊'
  ],
  ja: [
    'ヌード男子18+', 'ゲイ写真無料', 'ツインクギャラリー',
    '若い男性ヌード写真', 'ゲイ動画アマチュア', 'ヌード男性ギャラリー',
    'かわいいツインク写真', 'スリム若い男性ヌード', 'ホットゲイギャラリー'
  ],
  ko: [
    '누드 소년 18+', '게이 사진 무료', '트윙크 갤러리',
    '젊은 남자 누드 사진', '게이 비디오 아마추어', '누드 남성 갤러리',
    '귀여운 트윙크 사진', '날씬한 젊은 남자 누드', '핫 게이 갤러리'
  ],
  th: [
    'หนุ่มเปลือย 18+', 'ภาพเกย์ฟรี', 'แกลเลอรี่ทวิงค์',
    'ชายหนุ่มเปลือยภาพ', 'วิดีโอเกย์มือสมัครเล่น', 'แกลเลอรี่ผู้ชายเปลือย',
    'ภาพทวิงค์น่ารัก', 'ชายหนุ่มผอมเปลือย', 'แกลเลอรี่เกย์ร้อน'
  ]
};

// Generate complete keyword sets
async function generateKeywordSets() {
  console.log('Generating SEO keyword sets...');

  const keywordData = {
    generated: new Date().toISOString(),
    disclaimer: 'All content refers to legal adults 18+ years of age',
    languages: {},
    stats: {}
  };

  for (const [lang, info] of Object.entries(LANGUAGES)) {
    const unigrams = UNIGRAMS[lang] || UNIGRAMS.en;
    const phrases = CORE_PHRASES[lang] || CORE_PHRASES.en;

    // Generate n-grams
    const bigrams = generateBigrams(unigrams).slice(0, 200);
    const trigrams = generateTrigrams(unigrams).slice(0, 100);

    keywordData.languages[lang] = {
      name: info.name,
      flag: info.flag,
      dir: info.dir || 'ltr',
      unigrams: unigrams,
      bigrams: bigrams,
      trigrams: trigrams,
      corePhrases: phrases
    };

    keywordData.stats[lang] = {
      unigrams: unigrams.length,
      bigrams: bigrams.length,
      trigrams: trigrams.length,
      corePhrases: phrases.length
    };
  }

  // Write JSON output
  fs.writeFileSync(
    path.join(dataDir, 'seo-keywords.json'),
    JSON.stringify(keywordData, null, 2)
  );
  console.log('Generated seo-keywords.json');

  // Generate meta description templates
  await generateMetaTemplates(keywordData);

  return keywordData;
}

// Generate meta description and title templates
async function generateMetaTemplates(keywordData) {
  const templates = {
    generated: new Date().toISOString(),
    disclaimer: 'All models are 18+ years of age',
    templates: {}
  };

  // Template patterns for each page type
  const pageTypes = {
    home: {
      en: {
        title: 'BoyVue - Free Nude Boys Photos & Gay Videos | 350K+ Images 18+',
        description: 'Browse 350,000+ free nude boys photos and gay videos. HD quality twinks, young men 18+, amateur content. Updated daily. All models verified 18+.'
      },
      de: {
        title: 'BoyVue - Kostenlose Nackte Jungs Fotos & Gay Videos | 350K+ Bilder 18+',
        description: 'Durchsuchen Sie 350.000+ kostenlose nackte Jungs Fotos und Gay Videos. HD-Qualität Twinks, junge Männer 18+. Täglich aktualisiert.'
      },
      es: {
        title: 'BoyVue - Fotos Chicos Desnudos y Videos Gay Gratis | 350K+ Imágenes 18+',
        description: 'Explora 350.000+ fotos de chicos desnudos y videos gay gratis. Calidad HD twinks, jóvenes 18+. Actualizado diariamente.'
      },
      fr: {
        title: 'BoyVue - Photos Garçons Nus et Vidéos Gay Gratuites | 350K+ Images 18+',
        description: 'Parcourez 350.000+ photos de garçons nus et vidéos gay gratuites. Qualité HD twinks, jeunes hommes 18+. Mise à jour quotidienne.'
      },
      ru: {
        title: 'BoyVue - Бесплатные Голые Парни Фото и Гей Видео | 350K+ Фото 18+',
        description: 'Смотрите 350.000+ бесплатных голые парни фото и гей видео. HD качество твинки, молодые мужчины 18+. Обновляется ежедневно.'
      },
      pt: {
        title: 'BoyVue - Fotos Garotos Nus e Vídeos Gay Grátis | 350K+ Imagens 18+',
        description: 'Navegue por 350.000+ fotos de garotos nus e vídeos gay grátis. Qualidade HD twinks, jovens 18+. Atualizado diariamente.'
      },
      zh: {
        title: 'BoyVue - 免费裸体男孩照片和同志视频 | 350K+ 图片 18+',
        description: '浏览350,000+免费裸体男孩照片和同志视频。高清小鲜肉,年轻男子18+。每日更新。'
      },
      ja: {
        title: 'BoyVue - 無料ヌード男子写真とゲイ動画 | 350K+ 画像 18+',
        description: '350,000以上の無料ヌード男子写真とゲイ動画を閲覧。HDクオリティのツインク、若い男性18+。毎日更新。'
      },
      ko: {
        title: 'BoyVue - 무료 누드 남자 사진과 게이 비디오 | 350K+ 이미지 18+',
        description: '350,000개 이상의 무료 누드 남자 사진과 게이 비디오를 검색하세요. HD 품질, 매일 업데이트.'
      },
      th: {
        title: 'BoyVue - รูปหนุ่มเปลือยและวิดีโอเกย์ฟรี | 350K+ ภาพ 18+',
        description: 'เรียกดูรูปหนุ่มเปลือยและวิดีโอเกย์ฟรีมากกว่า 350,000 รายการ คุณภาพ HD อัปเดตทุกวัน'
      }
    },
    category: {
      en: {
        title: '{category} Photos - Nude Boys Gallery | BoyVue 18+',
        description: 'Browse {count}+ {category} nude photos and videos. Free HD quality twink and young men content 18+. Updated regularly.'
      },
      de: {
        title: '{category} Fotos - Nackte Jungs Galerie | BoyVue 18+',
        description: 'Durchsuchen Sie {count}+ {category} nackte Fotos und Videos. Kostenlose HD-Qualität 18+. Regelmäßig aktualisiert.'
      },
      es: {
        title: '{category} Fotos - Galería Chicos Desnudos | BoyVue 18+',
        description: 'Explora {count}+ fotos y videos {category} desnudos. Calidad HD gratis 18+. Actualizado regularmente.'
      },
      fr: {
        title: '{category} Photos - Galerie Garçons Nus | BoyVue 18+',
        description: 'Parcourez {count}+ photos et vidéos {category} nus. Qualité HD gratuite 18+. Mis à jour régulièrement.'
      },
      ru: {
        title: '{category} Фото - Галерея Голых Парней | BoyVue 18+',
        description: 'Смотрите {count}+ {category} голые фото и видео. Бесплатное HD качество 18+. Регулярно обновляется.'
      }
    },
    photo: {
      en: {
        title: '{title} - Nude Photo | BoyVue Gallery 18+',
        description: 'View {title} nude photo in HD quality. Free adult male photography 18+. Browse more in our gallery.'
      },
      de: {
        title: '{title} - Nackt Foto | BoyVue Galerie 18+',
        description: 'Sehen Sie {title} nackt Foto in HD-Qualität. Kostenlose erwachsene männliche Fotografie 18+.'
      }
    },
    video: {
      en: {
        title: '{title} - Gay Video | BoyVue 18+',
        description: 'Watch {title} gay video in HD quality. Free adult male content 18+. Duration: {duration}.'
      },
      de: {
        title: '{title} - Gay Video | BoyVue 18+',
        description: 'Sehen Sie {title} gay video in HD-Qualität. Kostenloser erwachsener männlicher Inhalt 18+.'
      }
    }
  };

  templates.templates = pageTypes;

  fs.writeFileSync(
    path.join(dataDir, 'meta-templates.json'),
    JSON.stringify(templates, null, 2)
  );
  console.log('Generated meta-templates.json');
}

// Generate category-specific SEO data
async function generateCategorySEO() {
  console.log('Generating category SEO data...');

  const result = await pool.query(`
    SELECT id, catname, photo_count
    FROM category
    WHERE photo_count > 0
    ORDER BY photo_count DESC
    LIMIT 100
  `);

  const categorySEO = {
    generated: new Date().toISOString(),
    categories: []
  };

  for (const cat of result.rows) {
    categorySEO.categories.push({
      id: cat.id,
      name: cat.catname,
      photoCount: cat.photo_count,
      seo: {
        en: {
          title: `${cat.catname} Photos - Nude Gallery | BoyVue 18+`,
          description: `Browse ${cat.photo_count}+ ${cat.catname} nude photos and videos. Free HD quality twink and young men content 18+.`,
          keywords: `${cat.catname}, ${cat.catname} nude, ${cat.catname} photos, ${cat.catname} gallery, nude boys, twink, 18+`
        }
      }
    });
  }

  fs.writeFileSync(
    path.join(dataDir, 'category-seo.json'),
    JSON.stringify(categorySEO, null, 2)
  );
  console.log(`Generated category-seo.json with ${categorySEO.categories.length} categories`);
}

// Main execution
async function main() {
  console.log('=== SEO Keyword Generator ===');
  console.log('All content refers to legal adults 18+ years of age\n');

  try {
    await generateKeywordSets();
    await generateCategorySEO();
    console.log('\nAll SEO data generated successfully!');
  } catch (error) {
    console.error('Error generating SEO data:', error.message);
  } finally {
    await pool.end();
  }
}

main();
