#!/usr/bin/env node

/**
 * Generate sitemaps for fans.boyvue.com
 *
 * Generates:
 * - sitemap.xml (index)
 * - sitemap-performers.xml
 * - sitemap-themes.xml
 * - sitemap-platforms.xml
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || process.env.PG_HOST || 'localhost',
  port: process.env.DB_PORT || process.env.PG_PORT || 5432,
  database: process.env.DB_NAME || process.env.PG_DATABASE || 'gallery',
  user: process.env.DB_USER || process.env.PG_USER || 'galleryuser',
  password: process.env.DB_PASSWORD || process.env.PG_PASSWORD
});

const BASE_URL = 'https://fans.boyvue.com';
const OUTPUT_DIR = path.join(__dirname, '..', 'public-creatives');

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(date) {
  return date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
}

async function generatePerformersSitemap() {
  console.log('Generating performers sitemap...');

  const result = await pool.query(`
    SELECT
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.updated_at,
      ap.slug as platform_slug,
      ps.is_promoted,
      ps.is_featured
    FROM performers p
    JOIN affiliate_platforms ap ON p.platform_id = ap.id
    LEFT JOIN performer_selections ps ON p.id = ps.performer_id
    WHERE ap.is_active = true
    ORDER BY ps.is_promoted DESC NULLS LAST, ps.is_featured DESC NULLS LAST, p.updated_at DESC
    LIMIT 10000
  `);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

  for (const performer of result.rows) {
    xml += `  <url>
    <loc>${BASE_URL}/performers/${performer.id}</loc>
    <lastmod>${formatDate(performer.updated_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>`;

    if (performer.avatar_url) {
      xml += `
    <image:image>
      <image:loc>${escapeXml(performer.avatar_url)}</image:loc>
      <image:title>${escapeXml(performer.display_name || performer.username)}</image:title>
    </image:image>`;
    }

    xml += `
  </url>
`;
  }

  xml += '</urlset>';

  const filepath = path.join(OUTPUT_DIR, 'sitemap-performers.xml');
  fs.writeFileSync(filepath, xml);
  console.log(`  Written ${result.rows.length} performers to ${filepath}`);

  return result.rows.length;
}

async function generateThemesSitemap() {
  console.log('Generating themes sitemap...');

  const result = await pool.query(`
    SELECT
      t.id,
      t.slug,
      t.name,
      t.updated_at,
      COUNT(tp.performer_id) as performer_count
    FROM themes t
    LEFT JOIN theme_performers tp ON t.id = tp.theme_id
    WHERE t.is_active = true
    GROUP BY t.id
    ORDER BY performer_count DESC
  `);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const theme of result.rows) {
    xml += `  <url>
    <loc>${BASE_URL}/themes/${theme.slug}</loc>
    <lastmod>${formatDate(theme.updated_at)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  xml += '</urlset>';

  const filepath = path.join(OUTPUT_DIR, 'sitemap-themes.xml');
  fs.writeFileSync(filepath, xml);
  console.log(`  Written ${result.rows.length} themes to ${filepath}`);

  return result.rows.length;
}

async function generatePlatformsSitemap() {
  console.log('Generating platforms sitemap...');

  const result = await pool.query(`
    SELECT
      ap.slug,
      ap.name,
      ap.updated_at,
      COUNT(p.id) as performer_count
    FROM affiliate_platforms ap
    LEFT JOIN performers p ON ap.id = p.platform_id
    WHERE ap.is_active = true
    GROUP BY ap.id
    ORDER BY performer_count DESC
  `);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const platform of result.rows) {
    xml += `  <url>
    <loc>${BASE_URL}/platforms/${platform.slug}</loc>
    <lastmod>${formatDate(platform.updated_at)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  xml += '</urlset>';

  const filepath = path.join(OUTPUT_DIR, 'sitemap-platforms.xml');
  fs.writeFileSync(filepath, xml);
  console.log(`  Written ${result.rows.length} platforms to ${filepath}`);

  return result.rows.length;
}

async function generateSitemapIndex(counts) {
  console.log('Generating sitemap index...');

  const today = new Date().toISOString().split('T')[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/sitemap-performers.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-themes.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-platforms.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

  const filepath = path.join(OUTPUT_DIR, 'sitemap.xml');
  fs.writeFileSync(filepath, xml);
  console.log(`  Written sitemap index to ${filepath}`);
}

async function generateStaticPages() {
  console.log('Generating static pages sitemap...');

  const staticPages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/performers', priority: '0.9', changefreq: 'daily' },
    { path: '/themes', priority: '0.9', changefreq: 'weekly' },
    { path: '/live', priority: '0.9', changefreq: 'hourly' },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  const today = new Date().toISOString().split('T')[0];

  for (const page of staticPages) {
    xml += `  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  xml += '</urlset>';

  const filepath = path.join(OUTPUT_DIR, 'sitemap-static.xml');
  fs.writeFileSync(filepath, xml);
  console.log(`  Written ${staticPages.length} static pages to ${filepath}`);
}

async function main() {
  console.log('=== Generating Creatives Sitemaps ===\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    const performerCount = await generatePerformersSitemap();
    const themeCount = await generateThemesSitemap();
    const platformCount = await generatePlatformsSitemap();
    await generateStaticPages();
    await generateSitemapIndex({ performerCount, themeCount, platformCount });

    console.log('\n=== Sitemap Generation Complete ===');
    console.log(`Total performers: ${performerCount}`);
    console.log(`Total themes: ${themeCount}`);
    console.log(`Total platforms: ${platformCount}`);

  } catch (err) {
    console.error('Error generating sitemaps:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
