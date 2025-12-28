import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// In-memory cache for translations
const translationsCache = new Map();
const languagesCache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Get all languages
export async function getLanguages() {
  const now = Date.now();
  if (languagesCache.data && (now - languagesCache.timestamp) < CACHE_TTL) {
    return languagesCache.data;
  }

  try {
    const result = await pool.query(
      'SELECT code, name, native_name, flag, direction FROM languages WHERE enabled = true ORDER BY sort_order'
    );
    const languages = {};
    result.rows.forEach(row => {
      languages[row.code] = {
        code: row.code,
        name: row.native_name || row.name,
        flag: row.flag,
        dir: row.direction
      };
    });
    languagesCache.data = languages;
    languagesCache.timestamp = now;
    return languages;
  } catch (e) {
    console.error('Error fetching languages:', e.message);
    return {};
  }
}

// Get all translations for a language
export async function getTranslations(lang = 'en') {
  const cacheKey = `all:${lang}`;
  const cached = translationsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    const result = await pool.query(
      'SELECT key, value, category FROM translations WHERE language = $1',
      [lang]
    );

    const translations = {};
    result.rows.forEach(row => {
      translations[row.key] = row.value;
    });

    translationsCache.set(cacheKey, { data: translations, timestamp: Date.now() });
    return translations;
  } catch (e) {
    console.error('Error fetching translations:', e.message);
    return {};
  }
}

// Get translations by category
export async function getTranslationsByCategory(lang = 'en', category = 'ui') {
  const cacheKey = `${category}:${lang}`;
  const cached = translationsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    const result = await pool.query(
      'SELECT key, value FROM translations WHERE language = $1 AND category = $2',
      [lang, category]
    );

    const translations = {};
    result.rows.forEach(row => {
      // Remove category prefix from key for easier usage
      const shortKey = row.key.replace(`${category}.`, '');
      translations[shortKey] = row.value;
    });

    translationsCache.set(cacheKey, { data: translations, timestamp: Date.now() });
    return translations;
  } catch (e) {
    console.error('Error fetching translations by category:', e.message);
    return {};
  }
}

// Get a single translation
export async function t(key, lang = 'en', fallback = '') {
  const cacheKey = `single:${key}:${lang}`;
  const cached = translationsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    const result = await pool.query(
      'SELECT value FROM translations WHERE key = $1 AND language = $2',
      [key, lang]
    );

    if (result.rows.length > 0) {
      translationsCache.set(cacheKey, { data: result.rows[0].value, timestamp: Date.now() });
      return result.rows[0].value;
    }

    // Fallback to English if not found
    if (lang !== 'en') {
      const enResult = await pool.query(
        'SELECT value FROM translations WHERE key = $1 AND language = $2',
        [key, 'en']
      );
      if (enResult.rows.length > 0) {
        return enResult.rows[0].value;
      }
    }

    return fallback || key;
  } catch (e) {
    console.error('Error fetching translation:', e.message);
    return fallback || key;
  }
}

// Get UI translations (structured format for frontend)
export async function getUITranslations(lang = 'en') {
  try {
    const [languages, ui, meta, ageGate, seo, stats] = await Promise.all([
      getLanguages(),
      getTranslationsByCategory(lang, 'ui'),
      getTranslationsByCategory(lang, 'meta'),
      getTranslationsByCategory(lang, 'agegate'),
      getTranslationsByCategory(lang, 'seo'),
      getTranslationsByCategory(lang, 'stats')
    ]);

    const langInfo = languages[lang] || languages['en'] || { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' };

    return {
      code: lang,
      name: langInfo.name,
      flag: langInfo.flag,
      dir: langInfo.dir,
      meta,
      ui,
      ageGate,
      seo,
      stats
    };
  } catch (e) {
    console.error('Error fetching UI translations:', e.message);
    return null;
  }
}

// Clear cache (useful when updating translations)
export function clearCache() {
  translationsCache.clear();
  languagesCache.data = null;
  languagesCache.timestamp = 0;
}

export { pool };
