import pg from 'pg';
import https from 'https';
import nodemailer from 'nodemailer';
import { getLanguages } from './translation-service.js';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// Email configuration
const emailConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
};

const REPORT_EMAIL = 'v.power@diggi.io';

// Supported languages for SEO
const supportedLangs = ['en', 'de', 'ru', 'es', 'zh', 'ja', 'th', 'ko', 'pt', 'fr', 'it', 'nl', 'pl', 'cs', 'ar', 'el', 'vi', 'id', 'tr', 'hu'];

// Translate text for SEO (cached)
async function translateForSEO(text, targetLang) {
  if (!text || targetLang === 'en') return text;

  try {
    const cached = await pool.query(
      'SELECT translated_text FROM translations_cache WHERE original_text = $1 AND target_lang = $2',
      [text.substring(0, 500), targetLang]
    );
    if (cached.rows.length) return cached.rows[0].translated_text;
  } catch(e) {}

  return new Promise((resolve) => {
    const encoded = encodeURIComponent(text.substring(0, 400));
    https.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encoded}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', async () => {
        try {
          const r = JSON.parse(data);
          const translated = r[0].map(x => x[0]).join('');
          await pool.query(
            'INSERT INTO translations_cache (original_text, translated_text, target_lang) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [text.substring(0, 500), translated.substring(0, 1000), targetLang]
          );
          resolve(translated);
        } catch(e) { resolve(text); }
      });
    }).on('error', () => resolve(text));
    setTimeout(() => resolve(text), 3000);
  });
}

// Analyze search logs for keyword opportunities
async function analyzeSearchLogs() {
  const results = {
    topSearchTerms: [],
    zeroResultQueries: [],
    searchTrends: [],
    languageDistribution: {}
  };

  try {
    // Top search terms with results
    const topSearches = await pool.query(`
      SELECT LOWER(query) as term, COUNT(*) as count,
             AVG(results_count) as avg_results,
             array_agg(DISTINCT country) as countries
      FROM search_logs
      WHERE created_at > NOW() - INTERVAL '7 days' AND results_count > 0
      GROUP BY LOWER(query)
      ORDER BY count DESC LIMIT 100
    `);
    results.topSearchTerms = topSearches.rows;

    // Zero result queries - content opportunities
    const zeroResults = await pool.query(`
      SELECT LOWER(query) as term, COUNT(*) as count,
             array_agg(DISTINCT country) as countries
      FROM search_logs
      WHERE created_at > NOW() - INTERVAL '7 days' AND results_count = 0
      GROUP BY LOWER(query)
      ORDER BY count DESC LIMIT 50
    `);
    results.zeroResultQueries = zeroResults.rows;

    // Search trends (comparing this week to last week)
    const trends = await pool.query(`
      WITH this_week AS (
        SELECT LOWER(query) as term, COUNT(*) as count
        FROM search_logs
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY LOWER(query)
      ),
      last_week AS (
        SELECT LOWER(query) as term, COUNT(*) as count
        FROM search_logs
        WHERE created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
        GROUP BY LOWER(query)
      )
      SELECT
        COALESCE(t.term, l.term) as term,
        COALESCE(t.count, 0) as this_week,
        COALESCE(l.count, 0) as last_week,
        COALESCE(t.count, 0) - COALESCE(l.count, 0) as change
      FROM this_week t FULL OUTER JOIN last_week l ON t.term = l.term
      WHERE COALESCE(t.count, 0) + COALESCE(l.count, 0) > 5
      ORDER BY change DESC LIMIT 30
    `);
    results.searchTrends = trends.rows;

    // Language distribution
    const langDist = await pool.query(`
      SELECT country, COUNT(*) as count
      FROM search_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY country ORDER BY count DESC
    `);
    results.languageDistribution = langDist.rows.reduce((acc, r) => {
      acc[r.country] = parseInt(r.count);
      return acc;
    }, {});

  } catch(e) {
    console.error('Error analyzing search logs:', e);
  }

  return results;
}

// Analyze search engine referrals
async function analyzeSearchEngineTraffic() {
  const results = {
    googleQueries: [],
    bingQueries: [],
    landingPages: [],
    contentGaps: []
  };

  try {
    // Google search queries
    const google = await pool.query(`
      SELECT search_query as term, COUNT(*) as count,
             array_agg(DISTINCT landing_page) as pages,
             array_agg(DISTINCT country) as countries
      FROM search_engine_referrals
      WHERE engine = 'google' AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY search_query
      ORDER BY count DESC LIMIT 50
    `);
    results.googleQueries = google.rows;

    // Top landing pages from search engines
    const landing = await pool.query(`
      SELECT landing_page as page, COUNT(*) as count,
             array_agg(DISTINCT search_query) as queries
      FROM search_engine_referrals
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY landing_page
      ORDER BY count DESC LIMIT 30
    `);
    results.landingPages = landing.rows;

    // Content demand gaps
    const gaps = await pool.query(`
      SELECT term, source, search_count, has_content, last_searched
      FROM content_demand
      WHERE has_content = false AND search_count > 2
      ORDER BY search_count DESC LIMIT 30
    `);
    results.contentGaps = gaps.rows;

  } catch(e) {
    console.error('Error analyzing search engine traffic:', e);
  }

  return results;
}

// Analyze category and content for SEO opportunities
async function analyzeCategoryKeywords() {
  const results = {
    categoryKeywords: [],
    underperformingCategories: [],
    keywordClusters: []
  };

  try {
    // Category performance
    const catPerf = await pool.query(`
      SELECT c.id, c.catname, c.photo_count,
             COUNT(DISTINCT s.id) as search_matches,
             COALESCE(SUM(i.view_count), 0) as total_views
      FROM category c
      LEFT JOIN search_logs s ON LOWER(s.query) LIKE '%' || LOWER(c.catname) || '%'
      LEFT JOIN image i ON i.belongs_to_gallery = c.id
      WHERE c.photo_count > 0
      GROUP BY c.id, c.catname, c.photo_count
      ORDER BY total_views DESC LIMIT 50
    `);
    results.categoryKeywords = catPerf.rows;

    // Underperforming categories (high content, low views)
    const underperf = await pool.query(`
      SELECT c.id, c.catname, c.photo_count,
             COALESCE(SUM(i.view_count), 0) as total_views,
             COALESCE(SUM(i.view_count), 0)::float / NULLIF(c.photo_count, 0) as views_per_item
      FROM category c
      LEFT JOIN image i ON i.belongs_to_gallery = c.id
      WHERE c.photo_count > 10
      GROUP BY c.id, c.catname, c.photo_count
      HAVING COALESCE(SUM(i.view_count), 0)::float / NULLIF(c.photo_count, 0) < 100
      ORDER BY c.photo_count DESC LIMIT 20
    `);
    results.underperformingCategories = underperf.rows;

    // Learned keyword clusters
    const clusters = await pool.query(`
      SELECT keyword, COUNT(DISTINCT image_id) as image_count, SUM(weight) as total_weight
      FROM image_keywords
      GROUP BY keyword
      HAVING COUNT(DISTINCT image_id) > 5
      ORDER BY total_weight DESC LIMIT 50
    `);
    results.keywordClusters = clusters.rows;

  } catch(e) {
    console.error('Error analyzing category keywords:', e);
  }

  return results;
}

// Check for SEO issues
async function checkSEOIssues() {
  const issues = {
    missingTitles: [],
    duplicateTitles: [],
    thinContent: [],
    missingDescriptions: [],
    lowViewPages: []
  };

  try {
    // Missing titles
    const missing = await pool.query(`
      SELECT id, local_path, view_count
      FROM image
      WHERE title IS NULL OR title = '' OR title = 'Untitled'
      ORDER BY view_count DESC LIMIT 50
    `);
    issues.missingTitles = missing.rows;

    // Duplicate titles
    const duplicates = await pool.query(`
      SELECT title, COUNT(*) as count, array_agg(id) as ids
      FROM image
      WHERE title IS NOT NULL AND title != ''
      GROUP BY title
      HAVING COUNT(*) > 1
      ORDER BY count DESC LIMIT 30
    `);
    issues.duplicateTitles = duplicates.rows;

    // Thin content (no description, low engagement)
    const thin = await pool.query(`
      SELECT id, title, view_count
      FROM image
      WHERE (description IS NULL OR description = '') AND view_count < 50
      ORDER BY view_count ASC LIMIT 50
    `);
    issues.thinContent = thin.rows;

    // Categories with missing SEO
    const catSeo = await pool.query(`
      SELECT c.id, c.catname, c.photo_count
      FROM category c
      LEFT JOIN category_seo s ON c.id = s.category_id AND s.language = 'en'
      WHERE c.photo_count > 0 AND s.id IS NULL
      ORDER BY c.photo_count DESC LIMIT 30
    `);
    issues.missingDescriptions = catSeo.rows;

  } catch(e) {
    console.error('Error checking SEO issues:', e);
  }

  return issues;
}

// Generate multilingual SEO metadata suggestions
async function generateSEOSuggestions(categoryData) {
  const suggestions = [];

  for (const cat of categoryData.slice(0, 10)) {
    const suggestion = {
      categoryId: cat.id,
      categoryName: cat.catname,
      suggestions: {}
    };

    // Generate SEO-optimized title and description templates
    const baseTitle = `${cat.catname} Gallery - Free HD Videos & Photos`;
    const baseDesc = `Browse ${cat.photo_count.toLocaleString()} free ${cat.catname} videos and photos. High quality content updated daily.`;

    for (const lang of supportedLangs) {
      try {
        const title = lang === 'en' ? baseTitle : await translateForSEO(baseTitle, lang);
        const desc = lang === 'en' ? baseDesc : await translateForSEO(baseDesc, lang);

        suggestion.suggestions[lang] = {
          title: title.substring(0, 60),
          description: desc.substring(0, 155),
          h1: cat.catname
        };
      } catch(e) {
        suggestion.suggestions[lang] = {
          title: baseTitle.substring(0, 60),
          description: baseDesc.substring(0, 155),
          h1: cat.catname
        };
      }
    }

    suggestions.push(suggestion);
  }

  return suggestions;
}

// Generate internal linking recommendations
async function generateLinkingRecommendations() {
  const recommendations = [];

  try {
    // Find related categories that should link to each other
    const related = await pool.query(`
      SELECT c1.id as cat1_id, c1.catname as cat1_name,
             c2.id as cat2_id, c2.catname as cat2_name,
             COUNT(DISTINCT ik1.keyword) as shared_keywords
      FROM category c1
      JOIN image_keywords ik1 ON ik1.image_id IN (SELECT id FROM image WHERE belongs_to_gallery = c1.id)
      JOIN image_keywords ik2 ON ik1.keyword = ik2.keyword AND ik2.image_id IN (SELECT id FROM image WHERE belongs_to_gallery = c2.id)
      JOIN category c2 ON c2.id != c1.id AND c2.photo_count > 0
      WHERE c1.photo_count > 0
      GROUP BY c1.id, c1.catname, c2.id, c2.catname
      HAVING COUNT(DISTINCT ik1.keyword) > 3
      ORDER BY shared_keywords DESC LIMIT 30
    `);

    for (const r of related.rows) {
      recommendations.push({
        from: { id: r.cat1_id, name: r.cat1_name },
        to: { id: r.cat2_id, name: r.cat2_name },
        reason: `${r.shared_keywords} shared keywords`,
        priority: r.shared_keywords > 10 ? 'high' : 'medium'
      });
    }
  } catch(e) {
    console.error('Error generating linking recommendations:', e);
  }

  return recommendations;
}

// Generate comprehensive SEO report
export async function generateSEOReport() {
  console.log('Starting SEO analysis...');

  const report = {
    generatedAt: new Date().toISOString(),
    searchAnalysis: await analyzeSearchLogs(),
    searchEngineTraffic: await analyzeSearchEngineTraffic(),
    categoryAnalysis: await analyzeCategoryKeywords(),
    seoIssues: await checkSEOIssues(),
    linkingRecommendations: await generateLinkingRecommendations()
  };

  // Generate SEO suggestions for top categories
  report.seoSuggestions = await generateSEOSuggestions(report.categoryAnalysis.categoryKeywords);

  // Calculate summary metrics
  report.summary = {
    totalSearches: report.searchAnalysis.topSearchTerms.reduce((sum, t) => sum + parseInt(t.count), 0),
    uniqueSearchTerms: report.searchAnalysis.topSearchTerms.length,
    zeroResultQueries: report.searchAnalysis.zeroResultQueries.length,
    contentGaps: report.searchEngineTraffic.contentGaps.length,
    seoIssuesCount: {
      missingTitles: report.seoIssues.missingTitles.length,
      duplicateTitles: report.seoIssues.duplicateTitles.length,
      thinContent: report.seoIssues.thinContent.length,
      missingDescriptions: report.seoIssues.missingDescriptions.length
    },
    topKeywords: report.categoryAnalysis.keywordClusters.slice(0, 10).map(k => k.keyword),
    trendingSearches: report.searchAnalysis.searchTrends.filter(t => t.change > 0).slice(0, 10).map(t => t.term)
  };

  return report;
}

// Format report as HTML email
function formatReportAsHTML(report) {
  const { summary, searchAnalysis, seoIssues, seoSuggestions, linkingRecommendations, searchEngineTraffic } = report;

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #f60; border-bottom: 2px solid #f60; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    h3 { color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    .metric { display: inline-block; background: #f5f5f5; padding: 10px 15px; margin: 5px; border-radius: 4px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #f60; }
    .metric-label { font-size: 12px; color: #666; }
    .priority-high { color: #d00; font-weight: bold; }
    .priority-medium { color: #f60; }
    .keyword { display: inline-block; background: #eee; padding: 2px 8px; margin: 2px; border-radius: 3px; font-size: 12px; }
    .section { margin: 30px 0; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>Weekly SEO Analysis Report - BoyVue Gallery</h1>
  <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>

  <div class="section">
    <h2>Summary Metrics</h2>
    <div class="metric">
      <div class="metric-value">${summary.totalSearches.toLocaleString()}</div>
      <div class="metric-label">Total Searches</div>
    </div>
    <div class="metric">
      <div class="metric-value">${summary.uniqueSearchTerms}</div>
      <div class="metric-label">Unique Terms</div>
    </div>
    <div class="metric">
      <div class="metric-value">${summary.zeroResultQueries}</div>
      <div class="metric-label">Zero Results</div>
    </div>
    <div class="metric">
      <div class="metric-value">${summary.contentGaps}</div>
      <div class="metric-label">Content Gaps</div>
    </div>
  </div>

  <div class="section">
    <h2>Trending Keywords</h2>
    <p>Top trending search terms this week:</p>
    <div>${summary.trendingSearches.map(k => `<span class="keyword">${k}</span>`).join(' ')}</div>

    <h3>Top Performing Keywords</h3>
    <div>${summary.topKeywords.map(k => `<span class="keyword">${k}</span>`).join(' ')}</div>
  </div>

  <div class="section">
    <h2>Content Opportunities</h2>
    <p>Search queries with no results (potential content gaps):</p>
    <table>
      <tr><th>Search Term</th><th>Count</th><th>Countries</th></tr>
      ${searchAnalysis.zeroResultQueries.slice(0, 15).map(q => `
        <tr><td>${q.term}</td><td>${q.count}</td><td>${(q.countries || []).slice(0, 3).join(', ')}</td></tr>
      `).join('')}
    </table>
  </div>

  <div class="section">
    <h2>SEO Issues to Fix</h2>
    <table>
      <tr><th>Issue Type</th><th>Count</th><th>Priority</th></tr>
      <tr><td>Missing Titles</td><td>${seoIssues.missingTitles.length}</td><td class="priority-high">High</td></tr>
      <tr><td>Duplicate Titles</td><td>${seoIssues.duplicateTitles.length}</td><td class="priority-high">High</td></tr>
      <tr><td>Thin Content</td><td>${seoIssues.thinContent.length}</td><td class="priority-medium">Medium</td></tr>
      <tr><td>Missing Category SEO</td><td>${seoIssues.missingDescriptions.length}</td><td class="priority-medium">Medium</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Google Search Queries</h2>
    <p>Top queries bringing traffic from Google:</p>
    <table>
      <tr><th>Query</th><th>Visits</th><th>Landing Pages</th></tr>
      ${searchEngineTraffic.googleQueries.slice(0, 15).map(q => `
        <tr><td>${q.term}</td><td>${q.count}</td><td>${(q.pages || []).slice(0, 2).join(', ')}</td></tr>
      `).join('')}
    </table>
  </div>

  <div class="section">
    <h2>Metadata Suggestions</h2>
    <p>Recommended SEO updates for top categories:</p>
    ${seoSuggestions.slice(0, 5).map(s => `
      <h3>${s.categoryName}</h3>
      <table>
        <tr><th>Language</th><th>Suggested Title</th><th>Suggested Description</th></tr>
        ${['en', 'de', 'es', 'fr', 'ru'].map(lang => s.suggestions[lang] ? `
          <tr><td>${lang.toUpperCase()}</td><td>${s.suggestions[lang].title}</td><td>${s.suggestions[lang].description}</td></tr>
        ` : '').join('')}
      </table>
    `).join('')}
  </div>

  <div class="section">
    <h2>Internal Linking Recommendations</h2>
    <p>Categories that should link to each other:</p>
    <table>
      <tr><th>From Category</th><th>Link To</th><th>Reason</th><th>Priority</th></tr>
      ${linkingRecommendations.slice(0, 15).map(r => `
        <tr>
          <td>${r.from.name}</td>
          <td>${r.to.name}</td>
          <td>${r.reason}</td>
          <td class="priority-${r.priority}">${r.priority}</td>
        </tr>
      `).join('')}
    </table>
  </div>

  <div class="section" style="background: #f9f9f9;">
    <h2>Action Items</h2>
    <ol>
      ${seoIssues.missingTitles.length > 0 ? `<li>Fix ${seoIssues.missingTitles.length} items with missing titles</li>` : ''}
      ${seoIssues.duplicateTitles.length > 0 ? `<li>Resolve ${seoIssues.duplicateTitles.length} duplicate title issues</li>` : ''}
      ${searchAnalysis.zeroResultQueries.length > 0 ? `<li>Create content for ${Math.min(10, searchAnalysis.zeroResultQueries.length)} high-demand zero-result queries</li>` : ''}
      ${seoIssues.missingDescriptions.length > 0 ? `<li>Add SEO metadata to ${seoIssues.missingDescriptions.length} categories</li>` : ''}
      <li>Implement suggested internal linking between related categories</li>
      <li>Update category metadata with multilingual suggestions</li>
    </ol>
  </div>

  <p style="color: #888; font-size: 12px; margin-top: 30px; text-align: center;">
    This report was automatically generated by BoyVue SEO Analyzer<br>
    No keyword stuffing. White-hat SEO practices only.
  </p>
</body>
</html>
  `;
}

// Send email report
export async function sendSEOReport(report) {
  const html = formatReportAsHTML(report);

  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.log('Email not configured. Saving report to file...');
    const fs = await import('fs');
    const reportPath = `/var/www/html/boyvue/reports/seo-report-${new Date().toISOString().split('T')[0]}.html`;
    try {
      await fs.promises.mkdir('/var/www/html/boyvue/reports', { recursive: true });
      await fs.promises.writeFile(reportPath, html);
      console.log(`Report saved to ${reportPath}`);
    } catch(e) {
      console.error('Error saving report:', e);
    }
    return;
  }

  try {
    const transporter = nodemailer.createTransport(emailConfig);

    await transporter.sendMail({
      from: emailConfig.auth.user,
      to: REPORT_EMAIL,
      subject: `Weekly SEO Report - BoyVue Gallery - ${new Date().toLocaleDateString()}`,
      html
    });

    console.log(`SEO report sent to ${REPORT_EMAIL}`);
  } catch(e) {
    console.error('Error sending email:', e);
  }
}

// Auto-update category SEO from suggestions
export async function applyAutoSEOUpdates(suggestions) {
  let updated = 0;

  for (const suggestion of suggestions) {
    for (const [lang, seo] of Object.entries(suggestion.suggestions)) {
      try {
        await pool.query(`
          INSERT INTO category_seo (category_id, language, seo_title, seo_description, seo_keywords, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (category_id, language) DO UPDATE SET
            seo_title = EXCLUDED.seo_title,
            seo_description = EXCLUDED.seo_description,
            updated_at = NOW()
        `, [suggestion.categoryId, lang, seo.title, seo.description, '']);
        updated++;
      } catch(e) {}
    }
  }

  console.log(`Auto-updated ${updated} SEO entries`);
  return updated;
}

// Main analysis function
export async function runWeeklySEOAnalysis() {
  console.log('=== Weekly SEO Analysis Started ===');
  console.log(new Date().toISOString());

  try {
    const report = await generateSEOReport();

    // Auto-apply SEO suggestions to categories
    if (report.seoSuggestions && report.seoSuggestions.length > 0) {
      await applyAutoSEOUpdates(report.seoSuggestions);
    }

    // Send report
    await sendSEOReport(report);

    console.log('=== Weekly SEO Analysis Complete ===');
    return report;
  } catch(e) {
    console.error('Error in weekly SEO analysis:', e);
    throw e;
  }
}

export { pool };
