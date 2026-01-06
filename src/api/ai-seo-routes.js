/**
 * AI-Powered SEO Management Routes
 *
 * Strategy: Analyze GSC data to find:
 * 1. High-opportunity keywords (high impressions, low CTR = fix meta descriptions)
 * 2. Quick wins (good CTR, position 4-10 = push to top 3)
 * 3. Long-tail gems (low competition, decent volume)
 * 4. Declining keywords (need content refresh)
 */

import { Router } from 'express';
import pg from 'pg';

const router = Router();

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

/**
 * Keyword scoring algorithm
 * Score = (Impressions * CTR_potential * Position_boost) / Competition
 */
function calculateKeywordScore(keyword) {
  const {
    clicks = 0,
    impressions = 0,
    ctr = 0,
    position = 100
  } = keyword;

  // CTR potential: if current CTR is low but position is good, there's opportunity
  const expectedCtr = getExpectedCtr(position);
  const ctrGap = Math.max(0, expectedCtr - ctr);
  const ctrPotential = ctrGap > 0 ? ctrGap * impressions / 100 : 0;

  // Position boost: keywords in positions 4-20 have most potential
  const positionBoost = position >= 4 && position <= 20 ? (21 - position) / 10 : 0.5;

  // Volume factor
  const volumeFactor = Math.log10(impressions + 1);

  // Final score
  const score = (volumeFactor * positionBoost * (1 + ctrPotential / 10));

  return Math.round(score * 100) / 100;
}

/**
 * Expected CTR by position (industry average for adult/entertainment)
 */
function getExpectedCtr(position) {
  const ctrByPosition = {
    1: 35, 2: 20, 3: 12, 4: 8, 5: 6,
    6: 4.5, 7: 3.5, 8: 3, 9: 2.5, 10: 2
  };
  return ctrByPosition[Math.round(position)] || (position > 10 ? 1 : 0);
}

/**
 * Classify keyword opportunity type
 */
function classifyKeyword(keyword) {
  const { impressions, ctr, position, clicks = 0 } = keyword;

  // High impressions but low CTR = fix meta title/description
  if (impressions > 100 && ctr < 5 && position < 10) {
    return {
      type: 'CTR_FIX',
      priority: 'HIGH',
      action: 'Improve meta title and description - you rank well but users aren\'t clicking',
      color: 'red'
    };
  }

  // Good CTR but not top 3 = push ranking
  if (ctr > 15 && position > 3 && position < 15) {
    return {
      type: 'QUICK_WIN',
      priority: 'HIGH',
      action: 'Build internal links and add content - users love this, just need better ranking',
      color: 'green'
    };
  }

  // Low competition long-tail (specific queries)
  if (impressions < 50 && position < 5 && ctr > 20) {
    return {
      type: 'LONG_TAIL_GEM',
      priority: 'MEDIUM',
      action: 'Protect and expand - create related content clusters',
      color: 'blue'
    };
  }

  // Brand keywords
  if (ctr > 50) {
    return {
      type: 'BRAND',
      priority: 'LOW',
      action: 'Maintain - already performing well',
      color: 'gray'
    };
  }

  // Struggling keywords
  if (impressions > 50 && clicks < 5) {
    return {
      type: 'STRUGGLING',
      priority: 'MEDIUM',
      action: 'Needs investigation - either wrong intent or poor SERP snippet',
      color: 'orange'
    };
  }

  return {
    type: 'MONITOR',
    priority: 'LOW',
    action: 'Keep monitoring',
    color: 'gray'
  };
}

/**
 * GET /ai-seo/keyword-opportunities
 * Returns prioritized list of keyword opportunities
 */
router.get('/keyword-opportunities', async (req, res) => {
  try {
    // Get GSC keywords from database
    const result = await pool.query(`
      SELECT
        keyword,
        clicks,
        impressions,
        ctr,
        position,
        updated_at
      FROM gsc_keywords
      WHERE impressions > 10
      ORDER BY impressions DESC
      LIMIT 200
    `);

    const opportunities = result.rows.map(kw => {
      const classification = classifyKeyword({
        impressions: kw.impressions,
        clicks: kw.clicks || 0,
        ctr: parseFloat(kw.ctr) || 0,
        position: parseFloat(kw.position) || 100
      });

      return {
        keyword: kw.keyword,
        clicks: kw.clicks,
        impressions: kw.impressions,
        ctr: kw.ctr,
        position: Math.round(parseFloat(kw.position) * 10) / 10,
        score: calculateKeywordScore({
          clicks: kw.clicks,
          impressions: kw.impressions,
          ctr: parseFloat(kw.ctr) || 0,
          position: parseFloat(kw.position) || 100
        }),
        ...classification,
        potentialClicks: Math.round(kw.impressions * getExpectedCtr(parseFloat(kw.position)) / 100)
      };
    });

    // Sort by score (highest opportunity first)
    opportunities.sort((a, b) => b.score - a.score);

    // Group by opportunity type
    const grouped = {
      ctrFix: opportunities.filter(k => k.type === 'CTR_FIX').slice(0, 10),
      quickWins: opportunities.filter(k => k.type === 'QUICK_WIN').slice(0, 10),
      longTailGems: opportunities.filter(k => k.type === 'LONG_TAIL_GEM').slice(0, 10),
      struggling: opportunities.filter(k => k.type === 'STRUGGLING').slice(0, 10)
    };

    // Calculate total potential
    const totalPotentialClicks = opportunities
      .filter(k => k.type === 'CTR_FIX' || k.type === 'QUICK_WIN')
      .reduce((sum, k) => sum + (k.potentialClicks - k.clicks), 0);

    res.json({
      success: true,
      summary: {
        totalKeywords: opportunities.length,
        highPriority: opportunities.filter(k => k.priority === 'HIGH').length,
        potentialAdditionalClicks: totalPotentialClicks,
        topOpportunity: opportunities[0]
      },
      grouped,
      all: opportunities.slice(0, 50)
    });

  } catch (error) {
    console.error('AI SEO error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /ai-seo/content-suggestions/:keyword
 * AI-generated content suggestions for a keyword
 */
router.get('/content-suggestions/:keyword', async (req, res) => {
  const { keyword } = req.params;

  try {
    // Get keyword data
    const kwResult = await pool.query(`
      SELECT * FROM gsc_keywords WHERE keyword = $1
    `, [keyword]);

    if (kwResult.rows.length === 0) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    const kw = kwResult.rows[0];
    const classification = classifyKeyword({
      impressions: kw.impressions,
      ctr: parseFloat(kw.ctr) || 0,
      position: parseFloat(kw.position) || 100
    });

    // Generate AI suggestions based on keyword type
    const suggestions = generateContentSuggestions(keyword, classification);

    res.json({
      success: true,
      keyword,
      data: kw,
      classification,
      suggestions
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate content suggestions based on keyword analysis
 */
function generateContentSuggestions(keyword, classification) {
  const baseSuggestions = {
    metaTitle: [],
    metaDescription: [],
    contentIdeas: [],
    internalLinking: []
  };

  // Clean keyword for use in suggestions
  const cleanKw = keyword.replace(/"/g, '');
  const titleCase = cleanKw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  if (classification.type === 'CTR_FIX') {
    baseSuggestions.metaTitle = [
      `${titleCase} - Free HD Gallery | BoyVue`,
      `Best ${titleCase} Photos & Videos | Updated Daily`,
      `${titleCase} Collection - 1000+ Free Pics`
    ];
    baseSuggestions.metaDescription = [
      `Browse our exclusive ${cleanKw} collection. Updated daily with HD quality content. Free access to thousands of photos and videos.`,
      `Discover the best ${cleanKw} gallery online. High quality, regularly updated, 100% free. Join millions of satisfied visitors.`
    ];
    baseSuggestions.contentIdeas = [
      `Create a dedicated landing page for "${cleanKw}"`,
      `Add schema markup for image galleries`,
      `Include video content to improve SERP appearance`
    ];
  }

  if (classification.type === 'QUICK_WIN') {
    baseSuggestions.internalLinking = [
      `Add links from homepage to ${cleanKw} content`,
      `Create a "Related: ${titleCase}" section on popular pages`,
      `Add ${cleanKw} to main navigation or footer`
    ];
    baseSuggestions.contentIdeas = [
      `Expand existing ${cleanKw} page with more content`,
      `Add FAQ section targeting long-tail variations`,
      `Create category hub page linking to all ${cleanKw} content`
    ];
  }

  if (classification.type === 'LONG_TAIL_GEM') {
    baseSuggestions.contentIdeas = [
      `Create content cluster around "${cleanKw}"`,
      `Target related long-tail: "${cleanKw} free", "${cleanKw} HD"`,
      `Build topical authority with supporting articles`
    ];
  }

  return baseSuggestions;
}

/**
 * GET /ai-seo/competitor-gaps
 * Find keywords competitors rank for but we don't
 */
router.get('/competitor-gaps', async (req, res) => {
  try {
    // Get our keywords
    const ourKeywords = await pool.query(`
      SELECT keyword, position FROM gsc_keywords WHERE position < 50
    `);

    // Get competitor keywords (if we have them)
    const competitorResult = await pool.query(`
      SELECT
        keyword,
        AVG(position) as avg_position,
        COUNT(DISTINCT domain) as competitor_count
      FROM seo_serp_content
      WHERE domain NOT LIKE '%boysreview%' AND domain NOT LIKE '%boyvue%'
      GROUP BY keyword
      HAVING COUNT(DISTINCT domain) >= 2
      ORDER BY competitor_count DESC
      LIMIT 50
    `);

    const ourKwSet = new Set(ourKeywords.rows.map(k => k.keyword.toLowerCase()));

    const gaps = competitorResult.rows
      .filter(k => !ourKwSet.has(k.keyword.toLowerCase()))
      .map(k => ({
        keyword: k.keyword,
        competitorCount: parseInt(k.competitor_count),
        avgPosition: Math.round(parseFloat(k.avg_position) * 10) / 10,
        opportunity: 'Competitors rank but we don\'t - content gap'
      }));

    res.json({
      success: true,
      gaps,
      totalGaps: gaps.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /ai-seo/keyword-clusters
 * Group related keywords into content clusters
 */
router.get('/keyword-clusters', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT keyword, impressions, clicks, position
      FROM gsc_keywords
      WHERE impressions > 5
      ORDER BY impressions DESC
      LIMIT 200
    `);

    // Simple clustering based on word overlap
    const clusters = {};
    const seedWords = ['nude', 'naked', 'boys', 'twink', 'teen', 'gay', 'pics', 'photos', 'video'];

    result.rows.forEach(kw => {
      const words = kw.keyword.toLowerCase().replace(/"/g, '').split(' ');

      // Find which seed word this belongs to
      for (const seed of seedWords) {
        if (words.includes(seed)) {
          if (!clusters[seed]) {
            clusters[seed] = {
              seed,
              keywords: [],
              totalImpressions: 0,
              totalClicks: 0
            };
          }
          clusters[seed].keywords.push({
            keyword: kw.keyword,
            impressions: kw.impressions,
            clicks: kw.clicks,
            position: parseFloat(kw.position)
          });
          clusters[seed].totalImpressions += kw.impressions;
          clusters[seed].totalClicks += kw.clicks;
          break;
        }
      }
    });

    // Sort clusters by total impressions
    const sortedClusters = Object.values(clusters)
      .sort((a, b) => b.totalImpressions - a.totalImpressions)
      .map(c => ({
        ...c,
        avgCtr: c.totalImpressions > 0
          ? Math.round(c.totalClicks / c.totalImpressions * 1000) / 10
          : 0,
        keywords: c.keywords.slice(0, 10) // Top 10 per cluster
      }));

    res.json({
      success: true,
      clusters: sortedClusters,
      totalClusters: sortedClusters.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /ai-seo/sync-gsc
 * Sync latest GSC data (would connect to GSC API)
 */
router.post('/sync-gsc', async (req, res) => {
  // This would integrate with GSC API
  // For now, return instructions
  res.json({
    success: true,
    message: 'To sync GSC data automatically, set up GSC API credentials',
    manual: 'Export CSV from GSC and upload to /tmp/gsc_queries.csv, then run sync script'
  });
});

/**
 * GET /ai-seo/dashboard-stats
 * Overview stats for admin dashboard
 */
router.get('/dashboard-stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_keywords,
        SUM(clicks) as total_clicks,
        SUM(impressions) as total_impressions,
        AVG(position) as avg_position,
        COUNT(CASE WHEN position < 4 THEN 1 END) as top3_keywords,
        COUNT(CASE WHEN position >= 4 AND position < 11 THEN 1 END) as page1_keywords,
        COUNT(CASE WHEN ctr::float > 10 THEN 1 END) as high_ctr_keywords
      FROM gsc_keywords
      WHERE impressions > 0
    `);

    const s = stats.rows[0];

    // Calculate opportunity score
    const opportunityScore = Math.min(100, Math.round(
      (parseInt(s.page1_keywords) / parseInt(s.total_keywords) * 50) +
      (parseInt(s.high_ctr_keywords) / parseInt(s.total_keywords) * 30) +
      (1 / parseFloat(s.avg_position) * 20 * 10)
    ));

    res.json({
      success: true,
      stats: {
        totalKeywords: parseInt(s.total_keywords),
        totalClicks: parseInt(s.total_clicks),
        totalImpressions: parseInt(s.total_impressions),
        avgPosition: Math.round(parseFloat(s.avg_position) * 10) / 10,
        avgCtr: s.total_impressions > 0
          ? Math.round(parseInt(s.total_clicks) / parseInt(s.total_impressions) * 1000) / 10
          : 0,
        top3Keywords: parseInt(s.top3_keywords),
        page1Keywords: parseInt(s.page1_keywords),
        highCtrKeywords: parseInt(s.high_ctr_keywords),
        opportunityScore
      },
      recommendations: [
        opportunityScore < 50 ? 'Focus on CTR optimization - many keywords have low click rates' : null,
        parseInt(s.top3_keywords) < 10 ? 'Build more internal links to push keywords to top 3' : null,
        parseFloat(s.avg_position) > 10 ? 'Create more targeted content to improve rankings' : null
      ].filter(Boolean)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /ai-seo/keyword-density/:url
 * Analyze keyword density on a specific page
 */
router.get('/keyword-density/:url(*)', async (req, res) => {
  const targetUrl = req.params.url;

  try {
    // Fetch the page content
    const https = await import('https');
    const http = await import('http');

    const fetchPage = (url) => new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      protocol.get(url, { headers: { 'User-Agent': 'SEO-Analyzer/1.0' } }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      }).on('error', reject);
    });

    const html = await fetchPage(targetUrl);

    // Extract text content (simple HTML stripping)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();

    // Extract title and meta description
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/gi);

    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : '';
    const metaDescription = metaDescMatch ? metaDescMatch[1] : '';
    const h1Tags = h1Match ? h1Match.map(h => h.replace(/<[^>]+>/g, '')) : [];

    // Word frequency analysis
    const words = textContent.split(/\s+/).filter(w => w.length > 3);
    const wordCount = words.length;
    const wordFreq = {};

    words.forEach(word => {
      // Skip common stop words
      const stopWords = ['that', 'this', 'with', 'from', 'have', 'been', 'were', 'they', 'will', 'would', 'could', 'should', 'about', 'which', 'their', 'there', 'what', 'when', 'where', 'your', 'more', 'some', 'than', 'into', 'just', 'also', 'only', 'other', 'such', 'very'];
      if (!stopWords.includes(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    // Sort by frequency
    const topWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word, count]) => ({
        word,
        count,
        density: Math.round(count / wordCount * 10000) / 100
      }));

    // Get our target keywords from database
    const kwResult = await pool.query(`
      SELECT keyword, impressions, clicks, position
      FROM gsc_keywords
      WHERE impressions > 20
      ORDER BY impressions DESC
      LIMIT 50
    `);

    // Check which target keywords appear on page
    const keywordAnalysis = kwResult.rows.map(kw => {
      const kwLower = kw.keyword.toLowerCase().replace(/"/g, '');
      const count = (textContent.match(new RegExp(kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      const inTitle = title.toLowerCase().includes(kwLower);
      const inMeta = metaDescription.toLowerCase().includes(kwLower);
      const inH1 = h1Tags.some(h => h.toLowerCase().includes(kwLower));

      return {
        keyword: kw.keyword,
        impressions: kw.impressions,
        position: parseFloat(kw.position).toFixed(1),
        occurrences: count,
        density: Math.round(count / wordCount * 10000) / 100,
        inTitle,
        inMeta,
        inH1,
        seoScore: (inTitle ? 30 : 0) + (inMeta ? 20 : 0) + (inH1 ? 25 : 0) + Math.min(25, count * 5)
      };
    });

    // Sort by SEO opportunity (high impressions, low score)
    keywordAnalysis.sort((a, b) => {
      const aOpp = a.impressions * (100 - a.seoScore) / 100;
      const bOpp = b.impressions * (100 - b.seoScore) / 100;
      return bOpp - aOpp;
    });

    res.json({
      success: true,
      url: targetUrl,
      pageStats: {
        wordCount,
        titleLength: title.length,
        metaDescLength: metaDescription.length,
        h1Count: h1Tags.length
      },
      topWords: topWords.slice(0, 15),
      keywordAnalysis: keywordAnalysis.slice(0, 20),
      recommendations: generateDensityRecommendations(keywordAnalysis, title, metaDescription)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate keyword density recommendations
 */
function generateDensityRecommendations(keywords, title, metaDesc) {
  const recommendations = [];

  // Check top opportunity keywords
  const topOpps = keywords.filter(k => k.seoScore < 50 && k.impressions > 50);

  topOpps.slice(0, 5).forEach(k => {
    if (!k.inTitle && k.impressions > 100) {
      recommendations.push({
        priority: 'HIGH',
        keyword: k.keyword,
        action: `Add "${k.keyword}" to page title - ${k.impressions} impressions but missing from title`
      });
    }
    if (!k.inMeta) {
      recommendations.push({
        priority: 'MEDIUM',
        keyword: k.keyword,
        action: `Add "${k.keyword}" to meta description`
      });
    }
    if (k.occurrences < 3) {
      recommendations.push({
        priority: 'MEDIUM',
        keyword: k.keyword,
        action: `Increase usage of "${k.keyword}" in content (currently ${k.occurrences} times)`
      });
    }
  });

  // Title length check
  if (title.length < 30) {
    recommendations.push({
      priority: 'HIGH',
      keyword: null,
      action: 'Title too short - expand to 50-60 characters with target keywords'
    });
  } else if (title.length > 60) {
    recommendations.push({
      priority: 'LOW',
      keyword: null,
      action: 'Title may be truncated in SERPs - consider shortening to under 60 characters'
    });
  }

  // Meta description check
  if (metaDesc.length < 120) {
    recommendations.push({
      priority: 'MEDIUM',
      keyword: null,
      action: 'Meta description too short - expand to 150-160 characters'
    });
  }

  return recommendations;
}

/**
 * GET /ai-seo/landing-pages
 * Analyze keyword density on all key landing pages
 */
router.get('/landing-pages', async (req, res) => {
  try {
    // Define key landing pages to analyze
    const landingPages = [
      { url: 'https://boysreview.com/', name: 'Homepage' },
      { url: 'https://boysreview.com/gallery/gay+videos/', name: 'Gay Videos' },
      { url: 'https://boysreview.com/gallery/todays+boys+pics+18%2B/', name: 'Today\'s Post' },
      { url: 'https://boysreview.com/sites-index.php', name: 'Sites Index' }
    ];

    // Get top keywords for reference
    const topKeywords = await pool.query(`
      SELECT keyword, impressions, position
      FROM gsc_keywords
      WHERE impressions > 50
      ORDER BY impressions DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      landingPages,
      topKeywords: topKeywords.rows,
      note: 'Use GET /ai-seo/keyword-density/{url} to analyze each page'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /ai-seo/apache-keywords
 * Analyze search keywords from Apache logs for backtesting
 */
router.get('/apache-keywords', async (req, res) => {
  try {
    // Get Apache search keywords from database (synced from logs)
    const result = await pool.query(`
      SELECT
        keyword,
        hit_count,
        last_seen,
        first_seen
      FROM apache_search_keywords
      WHERE hit_count > 1
      ORDER BY hit_count DESC
      LIMIT 100
    `);

    // Get daily trends if available
    const dailyTrends = await pool.query(`
      SELECT
        keyword,
        date,
        count
      FROM apache_keyword_daily
      WHERE date >= NOW() - INTERVAL '30 days'
      ORDER BY date DESC, count DESC
      LIMIT 500
    `).catch(() => ({ rows: [] }));

    // Compare Apache keywords with GSC keywords
    const gscKeywords = await pool.query(`
      SELECT keyword, impressions, clicks, position
      FROM gsc_keywords
      WHERE impressions > 10
    `);

    const gscSet = new Map(gscKeywords.rows.map(k => [k.keyword.toLowerCase().replace(/"/g, ''), k]));

    const apacheAnalysis = result.rows.map(ak => {
      const gscMatch = gscSet.get(ak.keyword.toLowerCase());
      return {
        keyword: ak.keyword,
        apacheHits: ak.hit_count,
        lastSeen: ak.last_seen,
        firstSeen: ak.first_seen,
        inGsc: !!gscMatch,
        gscData: gscMatch || null,
        opportunity: !gscMatch && ak.hit_count > 5
          ? 'Not tracked in GSC - potential content gap'
          : gscMatch && gscMatch.position > 10
            ? 'Users searching but ranking low - optimize content'
            : null
      };
    });

    // Find keywords in Apache but not in GSC (content gaps)
    const contentGaps = apacheAnalysis
      .filter(k => !k.inGsc && k.apacheHits > 3)
      .slice(0, 20);

    // Find keywords performing differently
    const performanceGaps = apacheAnalysis
      .filter(k => k.inGsc && k.gscData && k.gscData.position > 10)
      .slice(0, 20);

    res.json({
      success: true,
      summary: {
        totalApacheKeywords: result.rows.length,
        matchedWithGsc: apacheAnalysis.filter(k => k.inGsc).length,
        contentGaps: contentGaps.length,
        performanceGaps: performanceGaps.length
      },
      topKeywords: apacheAnalysis.slice(0, 30),
      contentGaps,
      performanceGaps,
      dailyTrends: groupByDate(dailyTrends.rows)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Group daily trends by date
 */
function groupByDate(rows) {
  const grouped = {};
  rows.forEach(r => {
    const date = r.date?.toISOString?.()?.split('T')[0] || r.date;
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push({ keyword: r.keyword, count: r.count });
  });
  return grouped;
}

/**
 * POST /ai-seo/sync-apache-logs
 * Parse Apache access logs and extract search keywords
 */
router.post('/sync-apache-logs', async (req, res) => {
  try {
    const fs = await import('fs');
    const readline = await import('readline');

    const logPath = '/var/log/apache2/access.log';

    // Ensure tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS apache_search_keywords (
        id SERIAL PRIMARY KEY,
        keyword TEXT UNIQUE NOT NULL,
        hit_count INTEGER DEFAULT 1,
        first_seen TIMESTAMPTZ DEFAULT NOW(),
        last_seen TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS apache_keyword_daily (
        id SERIAL PRIMARY KEY,
        keyword TEXT NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        count INTEGER DEFAULT 1,
        UNIQUE(keyword, date)
      )
    `);

    // Read and parse log file
    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const keywords = new Map();
    const searchEnginePatterns = [
      /[?&]q=([^&]+)/i,           // Google, Bing
      /[?&]query=([^&]+)/i,       // Various
      /[?&]search=([^&]+)/i,      // Internal search
      /[?&]p=([^&]+)/i,           // Yahoo
      /[?&]text=([^&]+)/i         // Yandex
    ];

    for await (const line of rl) {
      // Extract referrer from log line
      const refMatch = line.match(/"[^"]*"\s+"([^"]+)"\s*$/);
      if (refMatch) {
        const referrer = refMatch[1];

        for (const pattern of searchEnginePatterns) {
          const match = referrer.match(pattern);
          if (match) {
            const keyword = decodeURIComponent(match[1].replace(/\+/g, ' ')).toLowerCase().trim();
            if (keyword.length > 2 && keyword.length < 100) {
              keywords.set(keyword, (keywords.get(keyword) || 0) + 1);
            }
            break;
          }
        }
      }

      // Also check for internal search URLs
      const urlMatch = line.match(/GET\s+([^\s]+)/);
      if (urlMatch) {
        const url = urlMatch[1];
        for (const pattern of searchEnginePatterns) {
          const match = url.match(pattern);
          if (match) {
            const keyword = decodeURIComponent(match[1].replace(/\+/g, ' ')).toLowerCase().trim();
            if (keyword.length > 2 && keyword.length < 100) {
              keywords.set(keyword, (keywords.get(keyword) || 0) + 1);
            }
            break;
          }
        }
      }
    }

    // Save to database
    let synced = 0;
    for (const [keyword, count] of keywords) {
      try {
        await pool.query(`
          INSERT INTO apache_search_keywords (keyword, hit_count, last_seen)
          VALUES ($1, $2, NOW())
          ON CONFLICT (keyword) DO UPDATE SET
            hit_count = apache_search_keywords.hit_count + $2,
            last_seen = NOW()
        `, [keyword, count]);

        await pool.query(`
          INSERT INTO apache_keyword_daily (keyword, date, count)
          VALUES ($1, CURRENT_DATE, $2)
          ON CONFLICT (keyword, date) DO UPDATE SET
            count = apache_keyword_daily.count + $2
        `, [keyword, count]);

        synced++;
      } catch (err) {
        // Skip duplicates/errors
      }
    }

    res.json({
      success: true,
      message: `Synced ${synced} keywords from Apache logs`,
      totalFound: keywords.size,
      topKeywords: Array.from(keywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([kw, count]) => ({ keyword: kw, count }))
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /ai-seo/backtest-progress
 * Compare current vs historical keyword performance
 */
router.get('/backtest-progress', async (req, res) => {
  try {
    // Get keyword history if we have it
    const historyResult = await pool.query(`
      SELECT
        keyword,
        position,
        clicks,
        impressions,
        recorded_at
      FROM seo_keyword_history
      WHERE recorded_at >= NOW() - INTERVAL '90 days'
      ORDER BY keyword, recorded_at
    `).catch(() => ({ rows: [] }));

    // Get current performance
    const currentResult = await pool.query(`
      SELECT keyword, position, clicks, impressions, updated_at
      FROM gsc_keywords
      WHERE impressions > 10
      ORDER BY impressions DESC
      LIMIT 100
    `);

    // Calculate progress for each keyword
    const progress = currentResult.rows.map(current => {
      const history = historyResult.rows.filter(h => h.keyword === current.keyword);
      const oldestRecord = history[0];

      let positionChange = null;
      let clicksChange = null;
      let trend = 'stable';

      if (oldestRecord) {
        positionChange = parseFloat(oldestRecord.position) - parseFloat(current.position);
        clicksChange = current.clicks - oldestRecord.clicks;

        if (positionChange > 2) trend = 'improving';
        else if (positionChange < -2) trend = 'declining';
      }

      return {
        keyword: current.keyword,
        currentPosition: parseFloat(current.position).toFixed(1),
        currentClicks: current.clicks,
        currentImpressions: current.impressions,
        positionChange: positionChange?.toFixed(1) || 'N/A',
        clicksChange: clicksChange || 'N/A',
        trend,
        hasHistory: history.length > 0
      };
    });

    // Summary stats
    const improving = progress.filter(p => p.trend === 'improving').length;
    const declining = progress.filter(p => p.trend === 'declining').length;
    const stable = progress.filter(p => p.trend === 'stable').length;

    res.json({
      success: true,
      summary: {
        totalTracked: progress.length,
        improving,
        declining,
        stable,
        overallTrend: improving > declining ? 'POSITIVE' : declining > improving ? 'NEGATIVE' : 'STABLE'
      },
      progress: progress.slice(0, 50),
      recommendations: [
        declining > improving ? 'More keywords declining than improving - review content freshness' : null,
        stable > (improving + declining) ? 'Most keywords stable - consider new content to break through' : null,
        improving > declining ? 'Good progress! Continue current SEO strategy' : null
      ].filter(Boolean)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /ai-seo/save-history
 * Save current keyword positions to history for backtesting
 */
router.post('/save-history', async (req, res) => {
  try {
    // Ensure history table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seo_keyword_history (
        id SERIAL PRIMARY KEY,
        keyword TEXT NOT NULL,
        position DECIMAL(5,2),
        clicks INTEGER,
        impressions INTEGER,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Copy current data to history
    const result = await pool.query(`
      INSERT INTO seo_keyword_history (keyword, position, clicks, impressions, recorded_at)
      SELECT keyword, position, clicks, impressions, NOW()
      FROM gsc_keywords
      WHERE impressions > 5
    `);

    res.json({
      success: true,
      message: `Saved ${result.rowCount} keywords to history`,
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin API Credentials Management
 */

/**
 * GET /ai-seo/admin/credentials
 * Get configured API credentials (masked)
 */
router.get('/admin/credentials', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT key, value, updated_at
      FROM admin_settings
      WHERE key LIKE 'api_key_%' OR key LIKE 'api_secret_%'
    `);

    const credentials = {};
    result.rows.forEach(row => {
      const value = row.value;
      // Mask all but last 4 characters
      credentials[row.key] = {
        configured: value && value.length > 0,
        masked: value ? '****' + value.slice(-4) : null,
        updatedAt: row.updated_at
      };
    });

    // Check which services are configured
    const services = {
      claude: {
        name: 'Claude AI (Anthropic)',
        configured: credentials['api_key_claude']?.configured || false,
        keys: ['api_key_claude']
      },
      gsc: {
        name: 'Google Search Console',
        configured: credentials['api_key_gsc']?.configured || false,
        keys: ['api_key_gsc', 'api_secret_gsc_client_email', 'api_secret_gsc_project_id']
      },
      serp: {
        name: 'SERP API (SerpApi/DataForSEO)',
        configured: credentials['api_key_serp']?.configured || false,
        keys: ['api_key_serp']
      },
      semrush: {
        name: 'SEMrush',
        configured: credentials['api_key_semrush']?.configured || false,
        keys: ['api_key_semrush']
      }
    };

    res.json({
      success: true,
      services,
      credentials
    });

  } catch (error) {
    // Table might not exist, return empty
    res.json({
      success: true,
      services: {
        claude: { name: 'Claude AI', configured: false },
        gsc: { name: 'Google Search Console', configured: false },
        serp: { name: 'SERP API', configured: false },
        semrush: { name: 'SEMrush', configured: false }
      },
      credentials: {}
    });
  }
});

/**
 * POST /ai-seo/admin/credentials
 * Save API credentials
 */
router.post('/admin/credentials', async (req, res) => {
  const { key, value } = req.body;

  if (!key || !value) {
    return res.status(400).json({ error: 'Key and value required' });
  }

  // Only allow specific credential keys
  const allowedKeys = [
    'api_key_claude',
    'api_key_gsc',
    'api_secret_gsc_client_email',
    'api_secret_gsc_project_id',
    'api_secret_gsc_private_key',
    'api_key_serp',
    'api_key_semrush',
    'api_key_dataforseo',
    'api_secret_dataforseo'
  ];

  if (!allowedKeys.includes(key)) {
    return res.status(400).json({ error: 'Invalid credential key' });
  }

  try {
    // Ensure admin_settings table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      INSERT INTO admin_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [key, value]);

    res.json({
      success: true,
      message: `Credential ${key} saved successfully`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /ai-seo/admin/credentials/:key
 * Delete an API credential
 */
router.delete('/admin/credentials/:key', async (req, res) => {
  const { key } = req.params;

  try {
    await pool.query('DELETE FROM admin_settings WHERE key = $1', [key]);
    res.json({ success: true, message: `Credential ${key} deleted` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /ai-seo/admin/test-credentials/:service
 * Test if credentials work
 */
router.post('/admin/test-credentials/:service', async (req, res) => {
  const { service } = req.params;

  try {
    const result = await pool.query(
      'SELECT key, value FROM admin_settings WHERE key LIKE $1',
      [`api_%_${service}%`]
    );

    const creds = {};
    result.rows.forEach(r => creds[r.key] = r.value);

    let testResult = { success: false, message: 'Unknown service' };

    if (service === 'claude') {
      // Test Claude API
      const apiKey = creds['api_key_claude'];
      if (!apiKey) {
        return res.json({ success: false, message: 'Claude API key not configured' });
      }

      // Simple test - just check key format
      if (apiKey.startsWith('sk-ant-')) {
        testResult = { success: true, message: 'Claude API key format valid' };
      } else {
        testResult = { success: false, message: 'Invalid Claude API key format' };
      }
    }

    if (service === 'gsc') {
      // For GSC, we'd need to test OAuth - just check if configured
      const hasKey = creds['api_key_gsc'] || creds['api_secret_gsc_client_email'];
      testResult = hasKey
        ? { success: true, message: 'GSC credentials configured (full test requires OAuth)' }
        : { success: false, message: 'GSC credentials not configured' };
    }

    res.json(testResult);

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
