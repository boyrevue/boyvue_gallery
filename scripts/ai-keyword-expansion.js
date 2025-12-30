/**
 * AI-Powered Keyword Expansion
 * Analyzes existing categories and generates 100+ relevant long-tail keywords
 * Links keywords to matching categories and generates translated SERP content
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

// Rate limiter for translation API
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Translation function using MyMemory API
async function translateTerm(term, targetLang) {
  if (targetLang === 'en') return term;
  try {
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|${targetLang}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    return term;
  } catch (error) {
    return term;
  }
}

const SUPPORTED_LANGUAGES = ['en', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'ja', 'ko', 'zh', 'tr', 'th', 'vi', 'id', 'el', 'cs', 'hu', 'ar'];

// AI-Generated Keyword Categories based on semantic analysis
const KEYWORD_PATTERNS = {
  // Body type keywords
  bodyTypes: [
    'twink', 'jock', 'muscular', 'slim', 'athletic', 'fit', 'smooth', 'hairy',
    'lean', 'toned', 'young looking', 'cute face'
  ],

  // Geographic/Ethnic keywords
  geographic: [
    'european', 'asian', 'latino', 'american', 'british', 'german', 'french',
    'czech', 'russian', 'japanese', 'brazilian', 'spanish', 'italian', 'dutch',
    'eastern european', 'scandinavian'
  ],

  // Content types
  contentTypes: [
    'photos', 'videos', 'gallery', 'pics', 'images', 'collection', 'archive',
    'HD videos', '4K videos', 'streaming', 'download'
  ],

  // Scene types
  sceneTypes: [
    'solo', 'duo', 'group', 'outdoor', 'shower', 'bedroom', 'studio',
    'amateur', 'professional', 'homemade', 'POV'
  ],

  // Quality descriptors
  quality: [
    'HD', 'high quality', 'premium', 'exclusive', 'best', 'top rated',
    'popular', 'trending', 'new', 'latest', 'fresh', 'daily updates'
  ],

  // Action keywords
  actions: [
    'posing', 'flexing', 'stripping', 'showering', 'swimming', 'workout',
    'massage', 'modeling'
  ]
};

// Category-to-keyword mapping based on AI analysis of category names
const CATEGORY_KEYWORD_MAP = {
  // Studio-specific keywords
  'BelAmiOnLine': ['belami', 'bel ami online', 'belami boys', 'belami models', 'belami exclusive'],
  'Staxus': ['staxus', 'staxus boys', 'staxus twinks', 'staxus videos', 'staxus exclusive'],
  'HelixStudios': ['helix', 'helix studios', 'helix boys', 'helix twinks'],
  'BoyFun': ['boyfun', 'boy fun', 'boyfun videos', 'boyfun models'],
  'EastBoys': ['eastboys', 'east boys', 'eastern european boys', 'czech boys'],
  'JapanBoyz': ['japanboyz', 'japan boyz', 'japanese boys', 'asian twinks', 'japanese twinks'],
  'EnglishLads': ['englishlads', 'english lads', 'british boys', 'uk boys', 'british twinks'],
  'FreshMen': ['freshmen', 'freshmen europe', 'freshmen boys', 'european freshmen'],
  'Czech Hunter': ['czech hunter', 'czechhunter', 'czech boys', 'prague boys'],
  'French-Twinks': ['french twinks', 'french boys', 'paris boys', 'french gay'],
  'RuTwinks': ['rutwinks', 'russian twinks', 'russian boys', 'moscow boys'],
  'LatinosFun': ['latinos fun', 'latino boys', 'latin twinks', 'hispanic boys'],
  'PeterFever': ['peterfever', 'peter fever', 'asian hunks', 'asian muscular'],
  'BoyCrush': ['boycrush', 'boy crush', 'boycrush twinks', 'cute twinks'],
  '8teenBoy': ['8teenboy', '8teen boy', 'teen boys', 'young twinks'],
  'BeautifulTwinks': ['beautiful twinks', 'pretty boys', 'cute twinks', 'handsome twinks'],
  'FitYoungMen': ['fityoungmen', 'fit young men', 'athletic boys', 'muscular twinks'],
  'HammerBoys': ['hammerboys', 'hammer boys', 'hung boys', 'well endowed'],
  '19Nitten': ['19nitten', 'nineteen', 'barely legal', 'young adults'],
  'Todays Post': ['daily updates', 'new content', 'latest uploads', 'fresh content'],
  'Lost Treasures': ['classic', 'vintage', 'archive', 'retro', 'throwback']
};

// All website/studio names to include as keywords
const STUDIO_NAMES = [
  'BelAmiOnLine', 'Staxus', 'HelixStudios', 'BoyFun', 'EastBoys', 'JapanBoyz',
  'EnglishLads', 'FreshMen', 'Czech Hunter', 'French Twinks', 'RuTwinks',
  'LatinosFun', 'PeterFever', 'BoyCrush', '8teenBoy', 'BeautifulTwinks',
  'FitYoungMen', 'HammerBoys', '19Nitten', 'AlexBoys', 'EnigmaticBoys',
  'BlakeMason', 'BareTwinks', 'BadPuppy', 'JizzAddiction', 'Phoenixxx',
  'EuroBoyXXX', 'SouthernStrokes', 'Spritzz', 'OTBboyz', 'CameraBoys',
  'TwinkAcademy', 'BoyFeast', 'FunSizeBoys', 'TouchThatBoy', 'Jawked',
  'TwinkMix', 'SexyTwinks', 'BrotherCrush', 'MissionaryBoys', 'LustForBoys',
  'YouLoveJack', 'TeensAndTwinks', 'AYORStudios', 'HomeMadeTwinks', 'HoloTwink',
  'GayLifeNetwork', 'CorbinFisher', 'SeanCody', 'NextDoorStudios', 'RandyBlue',
  'ActiveDuty', 'Fratmen', 'MenAtPlay', 'TimTales', 'LucasEntertainment'
];

// Generate AI-suggested long-tail keywords
function generateLongTailKeywords() {
  const keywords = new Set();

  // 0. Add all studio/website names and their variations
  STUDIO_NAMES.forEach(studio => {
    const lower = studio.toLowerCase().replace(/\s+/g, '');
    const spaced = studio.replace(/([A-Z])/g, ' $1').trim().toLowerCase();

    keywords.add(lower);
    if (spaced !== lower) keywords.add(spaced);
    keywords.add(`${lower} videos`);
    keywords.add(`${lower} photos`);
    keywords.add(`${lower} gallery`);
    keywords.add(`${lower} free`);
    keywords.add(`${lower} boys`);
    keywords.add(`${lower} twinks`);
    keywords.add(`watch ${lower}`);
    keywords.add(`${lower} models`);
    keywords.add(`${lower} scenes`);
  });

  // 1. Body type + content type combinations
  KEYWORD_PATTERNS.bodyTypes.forEach(body => {
    KEYWORD_PATTERNS.contentTypes.slice(0, 4).forEach(content => {
      keywords.add(`${body} ${content}`);
    });
  });

  // 2. Geographic + body type combinations
  KEYWORD_PATTERNS.geographic.forEach(geo => {
    keywords.add(`${geo} twinks`);
    keywords.add(`${geo} boys`);
    keywords.add(`${geo} gay`);
  });

  // 3. Quality + content combinations
  KEYWORD_PATTERNS.quality.forEach(qual => {
    keywords.add(`${qual} gay videos`);
    keywords.add(`${qual} twink photos`);
  });

  // 4. Scene type combinations
  KEYWORD_PATTERNS.sceneTypes.forEach(scene => {
    keywords.add(`${scene} gay videos`);
    keywords.add(`${scene} twink`);
  });

  // 5. Action combinations
  KEYWORD_PATTERNS.actions.forEach(action => {
    keywords.add(`boys ${action}`);
    keywords.add(`twink ${action}`);
  });

  // 6. Specific high-value long-tail keywords based on search intent
  const highValueKeywords = [
    // Free content seekers
    'free gay twink videos',
    'free twink gallery',
    'free gay photo gallery',
    'watch gay videos free',
    'free HD gay videos',

    // Quality seekers
    'HD twink videos',
    '4K gay videos',
    'high quality gay photos',
    'premium twink content',
    'best gay galleries',

    // Specific content types
    'gay photo sets',
    'twink video collection',
    'gay model photos',
    'cute boy galleries',
    'sexy twink pics',

    // Studio seekers
    'gay studio videos',
    'professional gay photos',
    'exclusive gay content',
    'member gay videos',

    // Regional preferences
    'european gay videos',
    'american twinks',
    'asian gay photos',
    'latino gay videos',
    'british gay content',

    // Age-appropriate terms (18+)
    '18+ gay content',
    'adult gay gallery',
    'mature audience gay',
    'legal age boys',

    // Body preferences
    'smooth twink videos',
    'muscular gay photos',
    'athletic boys gallery',
    'slim twink pics',
    'fit boys videos',

    // Scene preferences
    'solo boy videos',
    'duo gay scenes',
    'outdoor gay photos',
    'shower scene videos',

    // Discovery keywords
    'new gay videos',
    'latest twink photos',
    'trending gay content',
    'popular boy galleries',
    'top rated gay videos',

    // Comparison/review keywords
    'best gay sites',
    'top twink galleries',
    'gay site reviews',
    'twink site comparison',

    // Additional high-value keywords
    'gay porn gallery',
    'twink porn pics',
    'hot gay boys',
    'sexy gay guys',
    'naked gay men',
    'gay male models',
    'underwear models',
    'speedos boys',
    'beach boys photos',
    'pool party boys',
    'locker room boys',
    'gay gym videos',
    'flexing muscles gay',
    'six pack abs boys',
    'bubble butt twinks',
    'hung twinks',
    'big dick boys',
    'uncut boys',
    'circumcised boys',
    'blond twinks',
    'dark haired boys',
    'redhead twinks',
    'tattoo boys',
    'pierced boys',
    'college boys',
    'frat boys',
    'military boys',
    'army boys',
    'uniform boys',
    'surfer boys',
    'skater boys',
    'emo boys',
    'goth boys',
    'preppy boys',
    'nerdy twinks',
    'innocent looking boys',
    'boy next door',
    'first time boys',
    'casting couch',
    'audition videos',
    'interview videos',
    'behind the scenes',
    'bloopers gay',
    'gay couple',
    'boyfriends videos',
    'romantic gay',
    'passionate gay',
    'sensual boys',
    'erotic twinks',
    'artistic nude boys',
    'black and white photos',
    'professional photography',
    'studio lighting',
    'natural light photos',
    'candid shots',
    'posed photos',
    'action shots',
    'cumshot compilation',
    'facial videos',
    'oral videos',
    'bareback videos',
    'safe sex videos',
    'condom videos',
    'kissing boys',
    'making out',
    'foreplay videos',
    'massage videos gay',
    'oil massage',
    'rimming videos',
    'fingering videos',
    'toy videos gay',
    'dildo videos',
    'vibrator videos',
    'bondage light',
    'blindfold videos',
    'roleplay gay',
    'fantasy videos',
    'costume boys',
    'leather boys',
    'jockstrap boys',
    'briefs boys',
    'boxers boys',
    'commando boys',
    'freeballing',
    'sagging pants',
    'bulge photos',
    'vpl visible',
    'wet boys',
    'sweaty boys',
    'oiled up',
    'tan lines',
    'pale skin',
    'freckles boys',
    'dimples cute',
    'smile boys',
    'eye contact',
    'seductive look',
    'teasing videos',
    'strip tease',
    'slow strip',
    'quick strip',
    'fully nude',
    'partially nude',
    'implied nude',
    'softcore gay',
    'hardcore gay',
    'explicit content',
    'uncensored gay',
    'raw videos',
    'reality gay',
    'scripted gay',
    'unscripted gay',
    'documentary style',
    'pov gay',
    'point of view',
    'selfie style',
    'gopro videos',
    'phone videos',
    'webcam boys',
    'cam boys',
    'live cam',
    'recorded cam',
    'chaturbate style',
    'onlyfans style',
    'justforfans style',
    'fan site content',
    'subscriber content',
    'patreon style',
    'exclusive members',
    'vip content',
    'premium access',
    'trial membership',
    'free samples',
    'preview clips',
    'full length',
    'extended cut',
    'directors cut',
    'bonus scenes',
    'deleted scenes',
    'outtakes gay'
  ];

  highValueKeywords.forEach(kw => keywords.add(kw));

  return Array.from(keywords);
}

// Match keywords to relevant categories using AI-style semantic matching
function matchKeywordToCategories(keyword, categories) {
  const matches = [];
  const kwLower = keyword.toLowerCase();

  for (const [catName, catKeywords] of Object.entries(CATEGORY_KEYWORD_MAP)) {
    // Check if keyword matches any category keywords
    for (const catKw of catKeywords) {
      if (kwLower.includes(catKw) || catKw.includes(kwLower.split(' ')[0])) {
        const cat = categories.find(c => c.catname === catName);
        if (cat) matches.push(cat.id);
        break;
      }
    }
  }

  // Semantic matching based on keyword content
  if (matches.length === 0) {
    if (kwLower.includes('japanese') || kwLower.includes('asian')) {
      const cat = categories.find(c => c.catname === 'JapanBoyz' || c.catname === 'PeterFever');
      if (cat) matches.push(cat.id);
    }
    if (kwLower.includes('european') || kwLower.includes('czech')) {
      const cat = categories.find(c => c.catname === 'EastBoys' || c.catname === 'Czech Hunter');
      if (cat) matches.push(cat.id);
    }
    if (kwLower.includes('british') || kwLower.includes('uk')) {
      const cat = categories.find(c => c.catname === 'EnglishLads');
      if (cat) matches.push(cat.id);
    }
    if (kwLower.includes('latino') || kwLower.includes('latin')) {
      const cat = categories.find(c => c.catname === 'LatinosFun');
      if (cat) matches.push(cat.id);
    }
    if (kwLower.includes('french')) {
      const cat = categories.find(c => c.catname === 'French-Twinks');
      if (cat) matches.push(cat.id);
    }
    if (kwLower.includes('russian')) {
      const cat = categories.find(c => c.catname === 'RuTwinks');
      if (cat) matches.push(cat.id);
    }
    if (kwLower.includes('new') || kwLower.includes('latest') || kwLower.includes('daily')) {
      const cat = categories.find(c => c.catname === 'Todays Post');
      if (cat) matches.push(cat.id);
    }
    if (kwLower.includes('classic') || kwLower.includes('vintage') || kwLower.includes('archive')) {
      const cat = categories.find(c => c.catname === 'Lost Treasures');
      if (cat) matches.push(cat.id);
    }
  }

  return matches.length > 0 ? matches[0] : null;
}

// SERP templates for different languages
const SERP_TEMPLATES = {
  en: {
    titles: [
      '{keyword} - Free HD Gallery | BoyVue',
      '{keyword} Videos & Photos | BoyVue.com',
      'Best {keyword} Content - BoyVue Gallery'
    ],
    descriptions: [
      'Discover our extensive collection of {keyword}. High-quality photos and videos updated daily. Adults only 18+.',
      'Browse {keyword} galleries with thousands of HD photos and videos. Premium adult content at BoyVue. 18+ required.',
      'Explore the best {keyword} content online. Free preview gallery with daily updates. Adults only - 18+ required.'
    ]
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
    ]
  }
  // Other languages will use translation API
};

// Generate SERP content for a keyword
async function generateSerpContent(keyword, lang, categoryId) {
  let translatedKeyword = keyword;

  if (lang !== 'en') {
    translatedKeyword = await translateTerm(keyword, lang);
  }

  const templates = SERP_TEMPLATES[lang] || SERP_TEMPLATES.en;

  return {
    keyword_term: keyword,
    language: lang,
    translated_keyword: translatedKeyword,
    serp1_title: templates.titles[0].replace('{keyword}', translatedKeyword).substring(0, 70),
    serp1_description: templates.descriptions[0].replace(/{keyword}/g, translatedKeyword).substring(0, 160),
    serp2_title: templates.titles[1].replace('{keyword}', translatedKeyword).substring(0, 70),
    serp2_description: templates.descriptions[1].replace(/{keyword}/g, translatedKeyword).substring(0, 160),
    serp3_title: templates.titles[2].replace('{keyword}', translatedKeyword).substring(0, 70),
    serp3_description: templates.descriptions[2].replace(/{keyword}/g, translatedKeyword).substring(0, 160),
    target_url: `/${lang === 'en' ? '' : lang + '/'}search?q=${encodeURIComponent(translatedKeyword)}`,
    category_id: categoryId
  };
}

async function main() {
  console.log('=== AI-Powered Keyword Expansion ===\n');

  // Get existing keywords
  const existingResult = await pool.query('SELECT DISTINCT english_term FROM seo_i18n_terms');
  const existingKeywords = new Set(existingResult.rows.map(r => r.english_term.toLowerCase()));
  console.log(`Existing keywords: ${existingKeywords.size}`);

  // Get all categories
  const catResult = await pool.query('SELECT id, catname FROM category');
  const categories = catResult.rows;
  console.log(`Categories: ${categories.length}\n`);

  // Generate new keywords
  const newKeywords = generateLongTailKeywords().filter(kw => !existingKeywords.has(kw.toLowerCase()));
  console.log(`AI-generated new keywords: ${newKeywords.length}\n`);

  // Process keywords
  let addedKeywords = 0;
  let addedSerps = 0;
  let linkedToCategories = 0;

  for (const keyword of newKeywords) {
    // Match to category
    const categoryId = matchKeywordToCategories(keyword, categories);
    if (categoryId) linkedToCategories++;

    console.log(`Processing: "${keyword}"${categoryId ? ` -> Category ${categoryId}` : ''}`);

    // Add to i18n terms (English first)
    try {
      await pool.query(`
        INSERT INTO seo_i18n_terms (english_term, language, translated_term, category, auto_translated)
        VALUES ($1, 'en', $1, 'keyword', false)
        ON CONFLICT (english_term, language) DO NOTHING
      `, [keyword]);
      addedKeywords++;
    } catch (e) {}

    // Translate to all languages
    for (const lang of SUPPORTED_LANGUAGES) {
      if (lang === 'en') continue;

      const translated = await translateTerm(keyword, lang);
      await sleep(100); // Rate limit

      try {
        await pool.query(`
          INSERT INTO seo_i18n_terms (english_term, language, translated_term, category, auto_translated)
          VALUES ($1, $2, $3, 'keyword', true)
          ON CONFLICT (english_term, language) DO NOTHING
        `, [keyword, lang, translated]);
      } catch (e) {}
    }

    // Generate SERP content for all languages
    for (const lang of SUPPORTED_LANGUAGES) {
      try {
        const serp = await generateSerpContent(keyword, lang, categoryId);

        await pool.query(`
          INSERT INTO seo_serp_content (keyword_term, language, translated_keyword, serp1_title, serp1_description,
            serp2_title, serp2_description, serp3_title, serp3_description, target_url, category_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (keyword_term, language) DO UPDATE SET
            translated_keyword = EXCLUDED.translated_keyword,
            serp1_title = EXCLUDED.serp1_title,
            serp1_description = EXCLUDED.serp1_description,
            serp2_title = EXCLUDED.serp2_title,
            serp2_description = EXCLUDED.serp2_description,
            serp3_title = EXCLUDED.serp3_title,
            serp3_description = EXCLUDED.serp3_description,
            target_url = EXCLUDED.target_url,
            category_id = EXCLUDED.category_id,
            updated_at = NOW()
        `, [serp.keyword_term, serp.language, serp.translated_keyword, serp.serp1_title,
            serp.serp1_description, serp.serp2_title, serp.serp2_description,
            serp.serp3_title, serp.serp3_description, serp.target_url, serp.category_id]);

        addedSerps++;
      } catch (e) {}

      if (lang !== 'en') await sleep(100);
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`New keywords added: ${addedKeywords}`);
  console.log(`Keywords linked to categories: ${linkedToCategories}`);
  console.log(`SERP entries created: ${addedSerps}`);

  // Final counts
  const finalKeywords = await pool.query('SELECT COUNT(DISTINCT english_term) FROM seo_i18n_terms');
  const finalSerps = await pool.query('SELECT COUNT(*) FROM seo_serp_content');
  const linkedSerps = await pool.query('SELECT COUNT(*) FROM seo_serp_content WHERE category_id IS NOT NULL');

  console.log(`\nTotal unique keywords: ${finalKeywords.rows[0].count}`);
  console.log(`Total SERP entries: ${finalSerps.rows[0].count}`);
  console.log(`SERPs linked to categories: ${linkedSerps.rows[0].count}`);

  pool.end();
}

main().catch(console.error);
