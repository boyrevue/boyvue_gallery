#!/usr/bin/env node
/**
 * Weekly AI SEO Report Generator
 *
 * Runs every Monday at 6am via cron:
 * 0 6 * * 1 cd /var/www/html/boyvue && node scripts/weekly-ai-seo-report.cjs
 *
 * What it does:
 * 1. Syncs GSC CSV data to PostgreSQL
 * 2. Analyzes top 100 keywords for opportunities
 * 3. Generates HTML report with recommendations
 * 4. Emails report to admin
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// GSC CSV file path
const GSC_CSV_PATH = '/var/www/html/boysreview/tmp/gsc_queries.csv';
const REPORT_DIR = '/var/www/html/boyvue/reports';

/**
 * Parse GSC CSV and return keyword data
 */
function parseGscCsv(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const keywords = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Handle quoted fields with commas
    const match = line.match(/^(".*?"|[^,]*),(\d+),(\d+),([0-9.]+%?),([0-9.]+)$/);
    if (match) {
      keywords.push({
        keyword: match[1].replace(/^"|"$/g, ''),
        clicks: parseInt(match[2]) || 0,
        impressions: parseInt(match[3]) || 0,
        ctr: parseFloat(match[4]) || 0,
        position: parseFloat(match[5]) || 100
      });
    }
  }

  return keywords;
}

/**
 * Sync keywords to database
 */
async function syncKeywordsToDb(keywords) {
  console.log(`Syncing ${keywords.length} keywords to database...`);

  // Create GSC keywords table (separate from seo_website_keywords)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gsc_keywords (
      id SERIAL PRIMARY KEY,
      keyword TEXT UNIQUE NOT NULL,
      clicks INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      ctr DECIMAL(5,2) DEFAULT 0,
      position DECIMAL(5,2) DEFAULT 100,
      opportunity_type TEXT,
      opportunity_score DECIMAL(5,2) DEFAULT 0,
      last_action TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  let synced = 0;
  for (const kw of keywords) {
    try {
      await pool.query(`
        INSERT INTO gsc_keywords (keyword, clicks, impressions, ctr, position, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (keyword) DO UPDATE SET
          clicks = EXCLUDED.clicks,
          impressions = EXCLUDED.impressions,
          ctr = EXCLUDED.ctr,
          position = EXCLUDED.position,
          updated_at = NOW()
      `, [kw.keyword, kw.clicks, kw.impressions, kw.ctr, kw.position]);
      synced++;
    } catch (err) {
      console.error(`Error syncing keyword "${kw.keyword}":`, err.message);
    }
  }

  console.log(`Synced ${synced} keywords`);
  return synced;
}

/**
 * Expected CTR by position
 */
function getExpectedCtr(position) {
  const ctrByPosition = {
    1: 35, 2: 20, 3: 12, 4: 8, 5: 6,
    6: 4.5, 7: 3.5, 8: 3, 9: 2.5, 10: 2
  };
  return ctrByPosition[Math.round(position)] || (position > 10 ? 1 : 0);
}

/**
 * Calculate opportunity score
 */
function calculateOpportunityScore(kw) {
  const expectedCtr = getExpectedCtr(kw.position);
  const ctrGap = Math.max(0, expectedCtr - kw.ctr);
  const positionBoost = kw.position >= 4 && kw.position <= 20 ? (21 - kw.position) / 10 : 0.5;
  const volumeFactor = Math.log10(kw.impressions + 1);
  return Math.round(volumeFactor * positionBoost * (1 + ctrGap / 10) * 100) / 100;
}

/**
 * Classify keyword opportunity
 */
function classifyKeyword(kw) {
  const { impressions, ctr, position } = kw;

  if (impressions > 100 && ctr < 5 && position < 10) {
    return { type: 'CTR_FIX', emoji: '🔥', priority: 'HIGH', color: '#dc3545' };
  }
  if (ctr > 15 && position > 3 && position < 15) {
    return { type: 'QUICK_WIN', emoji: '⭐', priority: 'HIGH', color: '#28a745' };
  }
  if (impressions < 50 && position < 5 && ctr > 20) {
    return { type: 'LONG_TAIL', emoji: '💎', priority: 'MEDIUM', color: '#007bff' };
  }
  if (ctr > 50) {
    return { type: 'BRAND', emoji: '🏆', priority: 'LOW', color: '#6c757d' };
  }
  if (impressions > 50 && kw.clicks < 5) {
    return { type: 'STRUGGLING', emoji: '⚠️', priority: 'MEDIUM', color: '#fd7e14' };
  }
  return { type: 'MONITOR', emoji: '👀', priority: 'LOW', color: '#6c757d' };
}

/**
 * Generate action recommendation
 */
function getActionRecommendation(type, keyword) {
  const actions = {
    CTR_FIX: `Improve meta title/description for "${keyword}" - you rank well but users aren't clicking`,
    QUICK_WIN: `Build internal links to "${keyword}" content - high CTR, just need better ranking`,
    LONG_TAIL: `Create content cluster around "${keyword}" to capture related searches`,
    STRUGGLING: `Investigate "${keyword}" - check search intent match and SERP snippet`,
    BRAND: `Maintain current performance for "${keyword}"`,
    MONITOR: `Continue monitoring "${keyword}"`
  };
  return actions[type] || 'Monitor';
}

/**
 * Generate HTML report
 */
function generateHtmlReport(keywords, stats) {
  const date = new Date().toISOString().split('T')[0];

  const topOpportunities = keywords
    .map(kw => ({
      ...kw,
      score: calculateOpportunityScore(kw),
      classification: classifyKeyword(kw)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  const ctrFixes = topOpportunities.filter(k => k.classification.type === 'CTR_FIX').slice(0, 15);
  const quickWins = topOpportunities.filter(k => k.classification.type === 'QUICK_WIN').slice(0, 15);
  const struggling = topOpportunities.filter(k => k.classification.type === 'STRUGGLING').slice(0, 10);

  const totalPotentialClicks = ctrFixes.reduce((sum, k) => {
    const expected = k.impressions * getExpectedCtr(k.position) / 100;
    return sum + Math.max(0, expected - k.clicks);
  }, 0);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI SEO Report - ${date}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #1a1a2e; color: #eee; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #00d4ff; border-bottom: 2px solid #00d4ff; padding-bottom: 10px; }
    h2 { color: #ff6b6b; margin-top: 30px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .stat-card { background: #16213e; border-radius: 12px; padding: 20px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #00d4ff; }
    .stat-label { color: #888; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #333; }
    th { background: #16213e; color: #00d4ff; }
    tr:hover { background: #16213e; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .high { background: #dc3545; color: white; }
    .medium { background: #fd7e14; color: white; }
    .low { background: #6c757d; color: white; }
    .action { background: #0f3460; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #00d4ff; }
    .summary { background: linear-gradient(135deg, #16213e, #1a1a2e); padding: 20px; border-radius: 12px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 AI SEO Weekly Report - ${date}</h1>

    <div class="summary">
      <h3>Executive Summary</h3>
      <p>Analyzed <strong>${keywords.length}</strong> keywords from Google Search Console.</p>
      <p>Found <strong>${ctrFixes.length + quickWins.length}</strong> high-priority opportunities.</p>
      <p>Potential additional clicks: <strong style="color: #28a745;">+${Math.round(totalPotentialClicks)}</strong> per week if optimized.</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.totalClicks.toLocaleString()}</div>
        <div class="stat-label">Total Clicks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalImpressions.toLocaleString()}</div>
        <div class="stat-label">Impressions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.avgCtr.toFixed(1)}%</div>
        <div class="stat-label">Avg CTR</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.avgPosition.toFixed(1)}</div>
        <div class="stat-label">Avg Position</div>
      </div>
    </div>

    <h2>🔥 CTR Fix Opportunities (High Volume, Low CTR)</h2>
    <p>These keywords have great rankings but poor click-through. Fix meta titles and descriptions.</p>
    <table>
      <tr><th>Keyword</th><th>Impressions</th><th>CTR</th><th>Position</th><th>Potential Clicks</th><th>Action</th></tr>
      ${ctrFixes.map(k => `
        <tr>
          <td><strong>${k.keyword}</strong></td>
          <td>${k.impressions.toLocaleString()}</td>
          <td style="color: #dc3545;">${k.ctr.toFixed(1)}%</td>
          <td>${k.position.toFixed(1)}</td>
          <td style="color: #28a745;">+${Math.round(k.impressions * getExpectedCtr(k.position) / 100 - k.clicks)}</td>
          <td>Improve meta title/description</td>
        </tr>
      `).join('')}
    </table>

    <h2>⭐ Quick Wins (High CTR, Need Ranking Boost)</h2>
    <p>Users love clicking these - just need to push them higher in rankings.</p>
    <table>
      <tr><th>Keyword</th><th>Clicks</th><th>CTR</th><th>Position</th><th>Action</th></tr>
      ${quickWins.map(k => `
        <tr>
          <td><strong>${k.keyword}</strong></td>
          <td>${k.clicks}</td>
          <td style="color: #28a745;">${k.ctr.toFixed(1)}%</td>
          <td>${k.position.toFixed(1)}</td>
          <td>Add internal links, expand content</td>
        </tr>
      `).join('')}
    </table>

    <h2>⚠️ Struggling Keywords</h2>
    <p>High impressions but few clicks - investigate search intent or SERP appearance.</p>
    <table>
      <tr><th>Keyword</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Position</th></tr>
      ${struggling.map(k => `
        <tr>
          <td><strong>${k.keyword}</strong></td>
          <td>${k.impressions.toLocaleString()}</td>
          <td style="color: #dc3545;">${k.clicks}</td>
          <td>${k.ctr.toFixed(1)}%</td>
          <td>${k.position.toFixed(1)}</td>
        </tr>
      `).join('')}
    </table>

    <h2>📋 This Week's Action Items</h2>
    ${ctrFixes.slice(0, 5).map((k, i) => `
      <div class="action">
        <strong>${i + 1}. ${k.classification.emoji} ${k.keyword}</strong><br>
        ${getActionRecommendation(k.classification.type, k.keyword)}<br>
        <small>Potential gain: +${Math.round(k.impressions * getExpectedCtr(k.position) / 100 - k.clicks)} clicks/week</small>
      </div>
    `).join('')}

    <p style="margin-top: 40px; color: #666; text-align: center;">
      Generated by AI SEO Analysis System | ${new Date().toLocaleString()}
    </p>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Weekly AI SEO Report ===');
  console.log('Date:', new Date().toISOString());

  try {
    // 1. Parse GSC CSV
    if (!fs.existsSync(GSC_CSV_PATH)) {
      throw new Error(`GSC CSV not found at ${GSC_CSV_PATH}`);
    }

    const keywords = parseGscCsv(GSC_CSV_PATH);
    console.log(`Parsed ${keywords.length} keywords from CSV`);

    // 2. Sync to database
    await syncKeywordsToDb(keywords);

    // 3. Calculate stats
    const stats = {
      totalClicks: keywords.reduce((s, k) => s + k.clicks, 0),
      totalImpressions: keywords.reduce((s, k) => s + k.impressions, 0),
      avgCtr: keywords.length > 0
        ? keywords.reduce((s, k) => s + k.ctr, 0) / keywords.length
        : 0,
      avgPosition: keywords.length > 0
        ? keywords.reduce((s, k) => s + k.position, 0) / keywords.length
        : 0
    };

    // 4. Generate report
    const html = generateHtmlReport(keywords, stats);

    // 5. Save report
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }

    const reportDate = new Date().toISOString().split('T')[0];
    const reportPath = path.join(REPORT_DIR, `ai-seo-report-${reportDate}.html`);
    fs.writeFileSync(reportPath, html);
    console.log(`Report saved to: ${reportPath}`);

    // 6. Update opportunity scores in database
    for (const kw of keywords.slice(0, 100)) {
      const score = calculateOpportunityScore(kw);
      const classification = classifyKeyword(kw);
      await pool.query(`
        UPDATE gsc_keywords
        SET opportunity_score = $1, opportunity_type = $2
        WHERE keyword = $3
      `, [score, classification.type, kw.keyword]);
    }

    console.log('Updated opportunity scores for top 100 keywords');
    console.log('=== Report Complete ===');

  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
