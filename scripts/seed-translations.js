/**
 * Seed i18n SEO Keywords and Translate to All Languages
 * Seeds core English keywords and translates to 19 target languages
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

// Core SEO keywords from user's keyword research (sorted by search volume)
const CORE_KEYWORDS = [
  // High volume keywords
  'nude boys pics',
  'nude teen boys',
  'boys nude',
  'naked boys',
  'teen boys nude',
  'boy nudes',
  'nude boy photos',
  'naked teen boys',
  'young nude boys',
  'nude boy pics',
  'twink boys',
  'gay teen boys',
  'nude male teens',
  'boys naked',
  'nude twinks',
  'gay boy photos',
  'teen nude boys',
  'hot nude boys',
  'cute nude boys',
  'naked twinks',
  // Medium volume keywords
  'young boys nude',
  'gay nude teens',
  'nude boy gallery',
  'teen twinks',
  'gay teen nude',
  'nude boys gallery',
  'boy nude photos',
  'naked boy pics',
  'twink nude',
  'gay boys nude',
  // Category keywords
  'gay photos',
  'gay videos',
  'gay gallery',
  'free gay photos',
  'free gay videos',
  'gay porn pics',
  'twink gallery',
  'twink videos',
  'twink photos'
];

const SUPPORTED_LANGUAGES = ['de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'ja', 'ko', 'zh', 'tr', 'th', 'vi', 'id', 'el', 'cs', 'hu', 'ar'];

// Rate limiter - MyMemory allows 1000 requests/day, 10 per second
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function translateTerm(term, targetLang) {
  try {
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|${targetLang}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    return null;
  } catch (error) {
    console.error(`Translation failed for ${term} -> ${targetLang}:`, error.message);
    return null;
  }
}

async function seedKeyword(term) {
  // Check if already exists
  const existing = await pool.query(
    'SELECT COUNT(*) FROM seo_i18n_terms WHERE english_term = $1',
    [term]
  );

  if (parseInt(existing.rows[0].count) > 0) {
    console.log(`  Skipping "${term}" - already exists`);
    return 0;
  }

  let translated = 0;

  for (const lang of SUPPORTED_LANGUAGES) {
    const translation = await translateTerm(term, lang);

    if (translation) {
      await pool.query(`
        INSERT INTO seo_i18n_terms (english_term, language, translated_term, category)
        VALUES ($1, $2, $3, 'keyword')
        ON CONFLICT (english_term, language) DO UPDATE SET translated_term = $3
      `, [term, lang, translation]);

      translated++;
      process.stdout.write('.');
    }

    // Rate limit: wait 150ms between requests
    await sleep(150);
  }

  console.log(` ${translated}/${SUPPORTED_LANGUAGES.length} languages`);
  return translated;
}

async function main() {
  console.log('=== Seeding i18n SEO Keywords ===\n');
  console.log(`Keywords to seed: ${CORE_KEYWORDS.length}`);
  console.log(`Target languages: ${SUPPORTED_LANGUAGES.length}\n`);

  let totalTranslated = 0;
  let keywordsProcessed = 0;

  for (const keyword of CORE_KEYWORDS) {
    process.stdout.write(`[${++keywordsProcessed}/${CORE_KEYWORDS.length}] "${keyword}"`);
    const count = await seedKeyword(keyword);
    totalTranslated += count;
  }

  console.log('\n=== Summary ===');
  console.log(`Keywords processed: ${keywordsProcessed}`);
  console.log(`Total translations: ${totalTranslated}`);

  // Show current stats
  const stats = await pool.query(`
    SELECT
      COUNT(DISTINCT english_term) as terms,
      COUNT(*) as translations
    FROM seo_i18n_terms
  `);

  console.log(`\nDatabase now contains:`);
  console.log(`  English keywords: ${stats.rows[0].terms}`);
  console.log(`  Total translations: ${stats.rows[0].translations}`);

  await pool.end();
}

main().catch(console.error);
