#!/usr/bin/env node
/**
 * SERP Content Generator
 * Generates meta keywords and 3 SERP snippets for each i18n keyword in all languages
 */

import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// SERP templates by language
const SERP_TEMPLATES = {
  en: {
    titles: [
      '{keyword} - Free HD Gallery | BoyVue',
      '{keyword} Videos & Photos | BoyVue.com',
      'Best {keyword} Content - BoyVue Gallery'
    ],
    descriptions: [
      'Explore our extensive collection of {keyword} content. High quality photos and videos updated daily. 18+ adult content only.',
      'Browse {keyword} galleries with thousands of HD photos and videos. Premium adult content at BoyVue. Must be 18+.',
      'Discover the best {keyword} content online. Free preview gallery with daily updates. Adults only - 18+ verification required.'
    ],
    contentSnippet: 'Welcome to our {keyword} gallery featuring exclusive 18+ adult content. Browse thousands of high-quality photos and videos.'
  },
  de: {
    titles: [
      '{keyword} - Kostenlose HD Galerie | BoyVue',
      '{keyword} Videos & Fotos | BoyVue.com',
      'Beste {keyword} Inhalte - BoyVue Galerie'
    ],
    descriptions: [
      'Entdecken Sie unsere umfangreiche Sammlung von {keyword}. Hochwertige Fotos und Videos täglich aktualisiert. Nur für Erwachsene 18+.',
      'Durchsuchen Sie {keyword} Galerien mit Tausenden von HD-Fotos und Videos. Premium-Inhalte für Erwachsene bei BoyVue. Ab 18 Jahren.',
      'Entdecken Sie die besten {keyword} Inhalte online. Kostenlose Vorschau-Galerie mit täglichen Updates. Nur für Erwachsene - 18+ erforderlich.'
    ],
    contentSnippet: 'Willkommen in unserer {keyword} Galerie mit exklusiven Inhalten für Erwachsene ab 18 Jahren. Durchsuchen Sie Tausende hochwertige Fotos und Videos.'
  },
  es: {
    titles: [
      '{keyword} - Galería HD Gratis | BoyVue',
      '{keyword} Videos y Fotos | BoyVue.com',
      'Mejor {keyword} Contenido - Galería BoyVue'
    ],
    descriptions: [
      'Explora nuestra extensa colección de {keyword}. Fotos y videos de alta calidad actualizados diariamente. Solo adultos 18+.',
      'Navega por galerías de {keyword} con miles de fotos y videos HD. Contenido premium para adultos en BoyVue. Mayores de 18.',
      'Descubre el mejor contenido de {keyword} en línea. Galería de vista previa gratuita con actualizaciones diarias. Solo adultos - se requiere 18+.'
    ],
    contentSnippet: 'Bienvenido a nuestra galería de {keyword} con contenido exclusivo para adultos mayores de 18 años. Explora miles de fotos y videos de alta calidad.'
  },
  fr: {
    titles: [
      '{keyword} - Galerie HD Gratuite | BoyVue',
      '{keyword} Vidéos & Photos | BoyVue.com',
      'Meilleur {keyword} Contenu - Galerie BoyVue'
    ],
    descriptions: [
      'Explorez notre vaste collection de {keyword}. Photos et vidéos de haute qualité mises à jour quotidiennement. Contenu adulte 18+ uniquement.',
      'Parcourez les galeries {keyword} avec des milliers de photos et vidéos HD. Contenu premium pour adultes sur BoyVue. 18 ans et plus.',
      'Découvrez le meilleur contenu {keyword} en ligne. Galerie gratuite avec mises à jour quotidiennes. Adultes uniquement - vérification 18+ requise.'
    ],
    contentSnippet: 'Bienvenue dans notre galerie {keyword} avec du contenu exclusif pour adultes de 18 ans et plus. Parcourez des milliers de photos et vidéos de haute qualité.'
  },
  pt: {
    titles: [
      '{keyword} - Galeria HD Grátis | BoyVue',
      '{keyword} Vídeos e Fotos | BoyVue.com',
      'Melhor {keyword} Conteúdo - Galeria BoyVue'
    ],
    descriptions: [
      'Explore nossa extensa coleção de {keyword}. Fotos e vídeos de alta qualidade atualizados diariamente. Conteúdo adulto apenas 18+.',
      'Navegue pelas galerias de {keyword} com milhares de fotos e vídeos HD. Conteúdo premium para adultos no BoyVue. Maiores de 18.',
      'Descubra o melhor conteúdo de {keyword} online. Galeria de prévia gratuita com atualizações diárias. Apenas adultos - verificação 18+ necessária.'
    ],
    contentSnippet: 'Bem-vindo à nossa galeria {keyword} com conteúdo exclusivo para adultos maiores de 18 anos. Navegue por milhares de fotos e vídeos de alta qualidade.'
  },
  ru: {
    titles: [
      '{keyword} - Бесплатная HD Галерея | BoyVue',
      '{keyword} Видео и Фото | BoyVue.com',
      'Лучший {keyword} Контент - Галерея BoyVue'
    ],
    descriptions: [
      'Исследуйте нашу обширную коллекцию {keyword}. Качественные фото и видео обновляются ежедневно. Только для взрослых 18+.',
      'Просматривайте галереи {keyword} с тысячами HD фото и видео. Премиум контент для взрослых на BoyVue. Только 18+.',
      'Откройте лучший контент {keyword} онлайн. Бесплатная галерея с ежедневными обновлениями. Только для взрослых - требуется 18+.'
    ],
    contentSnippet: 'Добро пожаловать в нашу галерею {keyword} с эксклюзивным контентом для взрослых от 18 лет. Просматривайте тысячи качественных фото и видео.'
  },
  ja: {
    titles: [
      '{keyword} - 無料HDギャラリー | BoyVue',
      '{keyword} 動画と写真 | BoyVue.com',
      '最高の{keyword}コンテンツ - BoyVueギャラリー'
    ],
    descriptions: [
      '{keyword}の豊富なコレクションをご覧ください。毎日更新される高品質な写真と動画。18歳以上の成人向けコンテンツ。',
      '数千のHD写真と動画を含む{keyword}ギャラリーを閲覧。BoyVueのプレミアム成人向けコンテンツ。18歳以上限定。',
      '最高の{keyword}コンテンツをオンラインで発見。毎日更新される無料プレビューギャラリー。成人限定 - 18歳以上の確認が必要。'
    ],
    contentSnippet: '{keyword}ギャラリーへようこそ。18歳以上の成人向け限定コンテンツです。数千の高品質な写真と動画をご覧ください。'
  },
  zh: {
    titles: [
      '{keyword} - 免费高清图库 | BoyVue',
      '{keyword} 视频和照片 | BoyVue.com',
      '最佳{keyword}内容 - BoyVue图库'
    ],
    descriptions: [
      '浏览我们丰富的{keyword}收藏。每日更新高质量照片和视频。仅限18岁以上成人内容。',
      '浏览包含数千张高清照片和视频的{keyword}图库。BoyVue优质成人内容。仅限18岁以上。',
      '在线发现最佳{keyword}内容。每日更新的免费预览图库。仅限成人 - 需要18岁以上验证。'
    ],
    contentSnippet: '欢迎来到我们的{keyword}图库，提供18岁以上成人专属内容。浏览数千张高质量照片和视频。'
  },
  ko: {
    titles: [
      '{keyword} - 무료 HD 갤러리 | BoyVue',
      '{keyword} 동영상 및 사진 | BoyVue.com',
      '최고의 {keyword} 콘텐츠 - BoyVue 갤러리'
    ],
    descriptions: [
      '{keyword}의 광범위한 컬렉션을 탐색하세요. 매일 업데이트되는 고품질 사진과 동영상. 18세 이상 성인 콘텐츠만.',
      '수천 개의 HD 사진과 동영상이 있는 {keyword} 갤러리를 탐색하세요. BoyVue의 프리미엄 성인 콘텐츠. 18세 이상만.',
      '온라인에서 최고의 {keyword} 콘텐츠를 발견하세요. 매일 업데이트되는 무료 미리보기 갤러리. 성인 전용 - 18세 이상 확인 필요.'
    ],
    contentSnippet: '{keyword} 갤러리에 오신 것을 환영합니다. 18세 이상 성인 전용 독점 콘텐츠입니다. 수천 개의 고품질 사진과 동영상을 탐색하세요.'
  },
  th: {
    titles: [
      '{keyword} - แกลเลอรี HD ฟรี | BoyVue',
      '{keyword} วิดีโอและรูปภาพ | BoyVue.com',
      'เนื้อหา {keyword} ที่ดีที่สุด - แกลเลอรี BoyVue'
    ],
    descriptions: [
      'สำรวจคอลเลกชัน {keyword} ที่กว้างขวางของเรา รูปภาพและวิดีโอคุณภาพสูงอัปเดตทุกวัน เนื้อหาสำหรับผู้ใหญ่ 18+ เท่านั้น',
      'เรียกดูแกลเลอรี {keyword} พร้อมรูปภาพและวิดีโอ HD หลายพันรายการ เนื้อหาพรีเมียมสำหรับผู้ใหญ่ที่ BoyVue อายุ 18 ปีขึ้นไป',
      'ค้นพบเนื้อหา {keyword} ที่ดีที่สุดออนไลน์ แกลเลอรีตัวอย่างฟรีพร้อมอัปเดตทุกวัน สำหรับผู้ใหญ่เท่านั้น - ต้องยืนยันอายุ 18+'
    ],
    contentSnippet: 'ยินดีต้อนรับสู่แกลเลอรี {keyword} ของเรา พร้อมเนื้อหาพิเศษสำหรับผู้ใหญ่อายุ 18 ปีขึ้นไป เรียกดูรูปภาพและวิดีโอคุณภาพสูงหลายพันรายการ'
  },
  it: {
    titles: [
      '{keyword} - Galleria HD Gratuita | BoyVue',
      '{keyword} Video e Foto | BoyVue.com',
      'Miglior {keyword} Contenuto - Galleria BoyVue'
    ],
    descriptions: [
      'Esplora la nostra vasta collezione di {keyword}. Foto e video di alta qualità aggiornati quotidianamente. Solo contenuti per adulti 18+.',
      'Sfoglia le gallerie {keyword} con migliaia di foto e video HD. Contenuti premium per adulti su BoyVue. Solo 18+.',
      'Scopri i migliori contenuti {keyword} online. Galleria di anteprima gratuita con aggiornamenti giornalieri. Solo adulti - richiesta verifica 18+.'
    ],
    contentSnippet: 'Benvenuto nella nostra galleria {keyword} con contenuti esclusivi per adulti dai 18 anni in su. Sfoglia migliaia di foto e video di alta qualità.'
  },
  nl: {
    titles: [
      '{keyword} - Gratis HD Galerij | BoyVue',
      '{keyword} Videos & Fotos | BoyVue.com',
      'Beste {keyword} Content - BoyVue Galerij'
    ],
    descriptions: [
      'Verken onze uitgebreide collectie {keyword}. Hoogwaardige fotos en videos dagelijks bijgewerkt. Alleen 18+ volwassen content.',
      'Blader door {keyword} galerijen met duizenden HD fotos en videos. Premium volwassen content op BoyVue. Alleen 18+.',
      'Ontdek de beste {keyword} content online. Gratis preview galerij met dagelijkse updates. Alleen volwassenen - 18+ verificatie vereist.'
    ],
    contentSnippet: 'Welkom bij onze {keyword} galerij met exclusieve content voor volwassenen van 18 jaar en ouder. Blader door duizenden hoogwaardige fotos en videos.'
  },
  pl: {
    titles: [
      '{keyword} - Darmowa Galeria HD | BoyVue',
      '{keyword} Filmy i Zdjęcia | BoyVue.com',
      'Najlepsza {keyword} Treść - Galeria BoyVue'
    ],
    descriptions: [
      'Odkryj naszą obszerną kolekcję {keyword}. Wysokiej jakości zdjęcia i filmy aktualizowane codziennie. Tylko treści dla dorosłych 18+.',
      'Przeglądaj galerie {keyword} z tysiącami zdjęć i filmów HD. Premium treści dla dorosłych na BoyVue. Tylko 18+.',
      'Odkryj najlepsze treści {keyword} online. Darmowa galeria podglądu z codziennymi aktualizacjami. Tylko dla dorosłych - wymagana weryfikacja 18+.'
    ],
    contentSnippet: 'Witamy w naszej galerii {keyword} z ekskluzywnymi treściami dla dorosłych od 18 lat. Przeglądaj tysiące wysokiej jakości zdjęć i filmów.'
  },
  tr: {
    titles: [
      '{keyword} - Ücretsiz HD Galeri | BoyVue',
      '{keyword} Videolar ve Fotoğraflar | BoyVue.com',
      'En İyi {keyword} İçerik - BoyVue Galeri'
    ],
    descriptions: [
      'Geniş {keyword} koleksiyonumuzu keşfedin. Her gün güncellenen yüksek kaliteli fotoğraflar ve videolar. Sadece 18+ yetişkin içerik.',
      'Binlerce HD fotoğraf ve video içeren {keyword} galerilerine göz atın. BoyVue\'da premium yetişkin içerik. Sadece 18+.',
      'En iyi {keyword} içeriğini çevrimiçi keşfedin. Günlük güncellemelerle ücretsiz önizleme galerisi. Sadece yetişkinler - 18+ doğrulama gerekli.'
    ],
    contentSnippet: '18 yaş ve üzeri yetişkinlere özel içeriklerle {keyword} galerimize hoş geldiniz. Binlerce yüksek kaliteli fotoğraf ve videoyu keşfedin.'
  },
  ar: {
    titles: [
      '{keyword} - معرض HD مجاني | BoyVue',
      '{keyword} فيديوهات وصور | BoyVue.com',
      'أفضل محتوى {keyword} - معرض BoyVue'
    ],
    descriptions: [
      'استكشف مجموعتنا الواسعة من {keyword}. صور وفيديوهات عالية الجودة يتم تحديثها يوميًا. محتوى للبالغين فقط 18+.',
      'تصفح معارض {keyword} مع آلاف الصور والفيديوهات بدقة عالية. محتوى متميز للبالغين على BoyVue. للبالغين فقط 18+.',
      'اكتشف أفضل محتوى {keyword} عبر الإنترنت. معرض معاينة مجاني مع تحديثات يومية. للبالغين فقط - مطلوب التحقق من العمر 18+.'
    ],
    contentSnippet: 'مرحبًا بك في معرض {keyword} الخاص بنا مع محتوى حصري للبالغين من سن 18 عامًا فما فوق. تصفح آلاف الصور والفيديوهات عالية الجودة.'
  },
  cs: {
    titles: [
      '{keyword} - Zdarma HD Galerie | BoyVue',
      '{keyword} Videa a Fotky | BoyVue.com',
      'Nejlepší {keyword} Obsah - Galerie BoyVue'
    ],
    descriptions: [
      'Prozkoumejte naši rozsáhlou sbírku {keyword}. Kvalitní fotky a videa denně aktualizované. Pouze obsah pro dospělé 18+.',
      'Procházejte galerie {keyword} s tisíci HD fotek a videí. Prémiový obsah pro dospělé na BoyVue. Pouze 18+.',
      'Objevte nejlepší obsah {keyword} online. Zdarma náhledová galerie s denními aktualizacemi. Pouze pro dospělé - vyžadováno ověření 18+.'
    ],
    contentSnippet: 'Vítejte v naší galerii {keyword} s exkluzivním obsahem pro dospělé od 18 let. Procházejte tisíce kvalitních fotek a videí.'
  },
  hu: {
    titles: [
      '{keyword} - Ingyenes HD Galéria | BoyVue',
      '{keyword} Videók és Fotók | BoyVue.com',
      'Legjobb {keyword} Tartalom - BoyVue Galéria'
    ],
    descriptions: [
      'Fedezze fel kiterjedt {keyword} gyűjteményünket. Naponta frissülő kiváló minőségű fotók és videók. Csak 18+ felnőtt tartalom.',
      'Böngésszen a {keyword} galériákban több ezer HD fotóval és videóval. Prémium felnőtt tartalom a BoyVue-n. Csak 18+.',
      'Fedezze fel a legjobb {keyword} tartalmat online. Ingyenes előnézeti galéria napi frissítésekkel. Csak felnőtteknek - 18+ ellenőrzés szükséges.'
    ],
    contentSnippet: 'Üdvözöljük a {keyword} galériánkban, exkluzív tartalommal 18 éven felüli felnőttek számára. Böngésszen több ezer kiváló minőségű fotó és videó között.'
  },
  el: {
    titles: [
      '{keyword} - Δωρεάν HD Γκαλερί | BoyVue',
      '{keyword} Βίντεο & Φωτογραφίες | BoyVue.com',
      'Καλύτερο {keyword} Περιεχόμενο - Γκαλερί BoyVue'
    ],
    descriptions: [
      'Εξερευνήστε την εκτεταμένη συλλογή μας {keyword}. Υψηλής ποιότητας φωτογραφίες και βίντεο που ενημερώνονται καθημερινά. Μόνο περιεχόμενο για ενήλικες 18+.',
      'Περιηγηθείτε στις γκαλερί {keyword} με χιλιάδες HD φωτογραφίες και βίντεο. Premium περιεχόμενο για ενήλικες στο BoyVue. Μόνο 18+.',
      'Ανακαλύψτε το καλύτερο περιεχόμενο {keyword} online. Δωρεάν γκαλερί προεπισκόπησης με καθημερινές ενημερώσεις. Μόνο για ενήλικες - απαιτείται επαλήθευση 18+.'
    ],
    contentSnippet: 'Καλώς ήρθατε στη γκαλερί μας {keyword} με αποκλειστικό περιεχόμενο για ενήλικες 18 ετών και άνω. Περιηγηθείτε σε χιλιάδες υψηλής ποιότητας φωτογραφίες και βίντεο.'
  },
  vi: {
    titles: [
      '{keyword} - Thư viện HD Miễn phí | BoyVue',
      '{keyword} Video & Ảnh | BoyVue.com',
      'Nội dung {keyword} Tốt nhất - Thư viện BoyVue'
    ],
    descriptions: [
      'Khám phá bộ sưu tập {keyword} phong phú của chúng tôi. Ảnh và video chất lượng cao được cập nhật hàng ngày. Chỉ nội dung người lớn 18+.',
      'Duyệt qua các thư viện {keyword} với hàng ngàn ảnh và video HD. Nội dung cao cấp dành cho người lớn tại BoyVue. Chỉ 18+.',
      'Khám phá nội dung {keyword} tốt nhất trực tuyến. Thư viện xem trước miễn phí với cập nhật hàng ngày. Chỉ dành cho người lớn - yêu cầu xác minh 18+.'
    ],
    contentSnippet: 'Chào mừng đến với thư viện {keyword} của chúng tôi với nội dung độc quyền dành cho người lớn từ 18 tuổi trở lên. Duyệt qua hàng ngàn ảnh và video chất lượng cao.'
  },
  id: {
    titles: [
      '{keyword} - Galeri HD Gratis | BoyVue',
      '{keyword} Video & Foto | BoyVue.com',
      'Konten {keyword} Terbaik - Galeri BoyVue'
    ],
    descriptions: [
      'Jelajahi koleksi {keyword} kami yang luas. Foto dan video berkualitas tinggi diperbarui setiap hari. Hanya konten dewasa 18+.',
      'Telusuri galeri {keyword} dengan ribuan foto dan video HD. Konten premium untuk dewasa di BoyVue. Hanya 18+.',
      'Temukan konten {keyword} terbaik secara online. Galeri pratinjau gratis dengan pembaruan harian. Khusus dewasa - verifikasi 18+ diperlukan.'
    ],
    contentSnippet: 'Selamat datang di galeri {keyword} kami dengan konten eksklusif untuk dewasa berusia 18 tahun ke atas. Jelajahi ribuan foto dan video berkualitas tinggi.'
  }
};

// Match keywords to categories
async function matchKeywordToCategory(keyword) {
  const keywordLower = keyword.toLowerCase().replace(/^18\+\s*/, '');

  // Try exact match first
  const exactMatch = await pool.query(
    'SELECT id, catname FROM category WHERE LOWER(catname) = $1',
    [keywordLower]
  );
  if (exactMatch.rows.length > 0) return exactMatch.rows[0];

  // Try partial match
  const partialMatch = await pool.query(
    `SELECT id, catname FROM category
     WHERE LOWER(catname) LIKE $1 OR $2 LIKE '%' || LOWER(catname) || '%'
     ORDER BY photo_count DESC LIMIT 1`,
    [`%${keywordLower}%`, keywordLower]
  );
  if (partialMatch.rows.length > 0) return partialMatch.rows[0];

  return null;
}

// Generate SERPs for all keywords
async function generateSerpContent() {
  console.log('Generating SERP content from i18n keywords...\n');

  // Get all i18n keywords grouped by English term
  const keywords = await pool.query(`
    SELECT english_term, language, translated_term, category
    FROM seo_i18n_terms
    ORDER BY english_term, language
  `);

  // Group by English term
  const keywordMap = {};
  for (const row of keywords.rows) {
    if (!keywordMap[row.english_term]) {
      keywordMap[row.english_term] = { category: row.category, translations: {} };
    }
    keywordMap[row.english_term].translations[row.language] = row.translated_term;
  }

  console.log(`Processing ${Object.keys(keywordMap).length} keywords...\n`);

  let generated = 0;
  let linked = 0;

  for (const [englishTerm, data] of Object.entries(keywordMap)) {
    console.log(`Keyword: ${englishTerm}`);

    // Try to match to a category
    const category = await matchKeywordToCategory(englishTerm);
    const categoryId = category?.id || null;
    if (categoryId) {
      linked++;
      console.log(`  -> Linked to category: ${category.catname}`);
    }

    // Generate SERP for each language
    for (const [lang, translatedTerm] of Object.entries(data.translations)) {
      const template = SERP_TEMPLATES[lang] || SERP_TEMPLATES.en;

      // Generate 3 SERP variations
      const serp1Title = template.titles[0].replace(/{keyword}/g, translatedTerm).substring(0, 70);
      const serp1Desc = template.descriptions[0].replace(/{keyword}/g, translatedTerm).substring(0, 160);
      const serp2Title = template.titles[1].replace(/{keyword}/g, translatedTerm).substring(0, 70);
      const serp2Desc = template.descriptions[1].replace(/{keyword}/g, translatedTerm).substring(0, 160);
      const serp3Title = template.titles[2].replace(/{keyword}/g, translatedTerm).substring(0, 70);
      const serp3Desc = template.descriptions[2].replace(/{keyword}/g, translatedTerm).substring(0, 160);

      const contentSnippet = template.contentSnippet.replace(/{keyword}/g, translatedTerm);

      // Build meta keywords (English term + translated term + variations)
      const metaKeywords = [
        translatedTerm,
        englishTerm,
        `${translatedTerm} gallery`,
        `${translatedTerm} photos`,
        `${translatedTerm} videos`,
        'BoyVue',
        '18+'
      ].join(', ');

      // Build target URL
      const targetUrl = categoryId
        ? `/${lang === 'en' ? '' : lang + '/'}category/${encodeURIComponent(category.catname.toLowerCase().replace(/\s+/g, '-'))}`
        : `/${lang === 'en' ? '' : lang + '/'}search?q=${encodeURIComponent(translatedTerm)}`;

      // Insert or update SERP content
      await pool.query(`
        INSERT INTO seo_serp_content (
          keyword_term, language, translated_keyword,
          serp1_title, serp1_description,
          serp2_title, serp2_description,
          serp3_title, serp3_description,
          meta_keywords, content_snippet,
          category_id, target_url, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (keyword_term, language) DO UPDATE SET
          translated_keyword = EXCLUDED.translated_keyword,
          serp1_title = EXCLUDED.serp1_title,
          serp1_description = EXCLUDED.serp1_description,
          serp2_title = EXCLUDED.serp2_title,
          serp2_description = EXCLUDED.serp2_description,
          serp3_title = EXCLUDED.serp3_title,
          serp3_description = EXCLUDED.serp3_description,
          meta_keywords = EXCLUDED.meta_keywords,
          content_snippet = EXCLUDED.content_snippet,
          category_id = EXCLUDED.category_id,
          target_url = EXCLUDED.target_url,
          updated_at = NOW()
      `, [
        englishTerm, lang, translatedTerm,
        serp1Title, serp1Desc,
        serp2Title, serp2Desc,
        serp3Title, serp3Desc,
        metaKeywords, contentSnippet,
        categoryId, targetUrl
      ]);

      generated++;
    }
  }

  // Update category seo_keywords arrays
  console.log('\nUpdating category SEO keywords...');

  const categoryKeywords = await pool.query(`
    SELECT category_id, array_agg(DISTINCT keyword_term) as keywords
    FROM seo_serp_content
    WHERE category_id IS NOT NULL
    GROUP BY category_id
  `);

  for (const row of categoryKeywords.rows) {
    await pool.query(
      'UPDATE category SET seo_keywords = $1 WHERE id = $2',
      [row.keywords, row.category_id]
    );
  }

  // Final stats
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total_serps,
      COUNT(DISTINCT keyword_term) as unique_keywords,
      COUNT(DISTINCT language) as languages,
      COUNT(DISTINCT category_id) FILTER (WHERE category_id IS NOT NULL) as linked_categories
    FROM seo_serp_content
  `);

  console.log('\n=== SERP GENERATION COMPLETE ===');
  console.log(`Total SERP entries: ${stats.rows[0].total_serps}`);
  console.log(`Unique keywords: ${stats.rows[0].unique_keywords}`);
  console.log(`Languages: ${stats.rows[0].languages}`);
  console.log(`Linked to categories: ${stats.rows[0].linked_categories}`);

  await pool.end();
}

generateSerpContent().catch(console.error);
