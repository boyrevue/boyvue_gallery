#!/usr/bin/env node
/**
 * Import Performers from CSV/JSON
 *
 * For platforms without public APIs (OnlyFans, Fansly, etc.)
 * Usage:
 *   node scripts/import-performers.js <platform> <file>
 *   node scripts/import-performers.js onlyfans data/onlyfans-performers.json
 *   node scripts/import-performers.js fansly data/fansly-performers.csv
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'gallery',
  user: process.env.DB_USER || 'galleryuser',
  password: process.env.DB_PASSWORD
});

// Parse CSV into objects
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || null;
    });
    rows.push(row);
  }

  return rows;
}

// Normalize performer data from various formats
function normalizePerformer(raw, platform) {
  // Handle different field naming conventions
  return {
    external_id: raw.id || raw.external_id || raw.username || raw.user_id,
    username: raw.username || raw.screen_name || raw.name,
    display_name: raw.display_name || raw.name || raw.username,
    profile_url: raw.profile_url || raw.url || buildProfileUrl(raw.username, platform),
    avatar_url: raw.avatar_url || raw.avatar || raw.profile_image || raw.photo,
    cover_photo_url: raw.cover_photo_url || raw.cover || raw.header,
    bio: raw.bio || raw.about || raw.description,
    categories: parseArray(raw.categories || raw.tags),
    gender: raw.gender || 'male',
    body_type: raw.body_type,
    ethnicity: raw.ethnicity,
    age: raw.age ? parseInt(raw.age) : null,
    location: raw.location || raw.country,
    is_verified: parseBool(raw.is_verified || raw.verified),
    is_online: false, // Subscription platforms don't have live status
    follower_count: raw.followers ? parseInt(raw.followers) : null,
    subscriber_count: raw.subscribers ? parseInt(raw.subscribers) : null,
    media_count: raw.media_count ? parseInt(raw.media_count) : null,
    video_count: raw.video_count ? parseInt(raw.video_count) : null,
    photo_count: raw.photo_count ? parseInt(raw.photo_count) : null,
    subscription_price: raw.subscription_price ? parseFloat(raw.subscription_price) : null,
    free_trial_days: raw.free_trial_days ? parseInt(raw.free_trial_days) : null,
    languages: parseArray(raw.languages),
    social_links: parseSocialLinks(raw),
    raw_data: raw
  };
}

function buildProfileUrl(username, platform) {
  const urls = {
    onlyfans: `https://onlyfans.com/${username}`,
    fansly: `https://fansly.com/${username}`,
    justforfans: `https://justfor.fans/${username}`,
    '4myfans': `https://4my.fans/${username}`,
    loyalfans: `https://www.loyalfans.com/${username}`
  };
  return urls[platform] || null;
}

function parseArray(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(/[,;|]/).map(v => v.trim()).filter(v => v);
  }
  return null;
}

function parseBool(value) {
  if (value === true || value === 'true' || value === '1' || value === 'yes') return true;
  return false;
}

function parseSocialLinks(raw) {
  const links = {};
  if (raw.twitter) links.twitter = raw.twitter;
  if (raw.instagram) links.instagram = raw.instagram;
  if (raw.tiktok) links.tiktok = raw.tiktok;
  if (raw.snapchat) links.snapchat = raw.snapchat;
  return Object.keys(links).length > 0 ? links : null;
}

// Save performer to database
async function savePerformer(performer, platformId) {
  const result = await pool.query(`
    INSERT INTO performers (
      platform_id, external_id, username, display_name, profile_url,
      avatar_url, cover_photo_url, bio, categories, gender,
      body_type, ethnicity, age, location, is_verified,
      is_online, follower_count, subscriber_count, media_count,
      video_count, photo_count, subscription_price, free_trial_days,
      languages, social_links, raw_data, last_spidered
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19,
      $20, $21, $22, $23, $24, $25, $26, NOW()
    )
    ON CONFLICT (platform_id, external_id) DO UPDATE SET
      username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      avatar_url = COALESCE(EXCLUDED.avatar_url, performers.avatar_url),
      bio = COALESCE(EXCLUDED.bio, performers.bio),
      categories = COALESCE(EXCLUDED.categories, performers.categories),
      follower_count = COALESCE(EXCLUDED.follower_count, performers.follower_count),
      subscriber_count = COALESCE(EXCLUDED.subscriber_count, performers.subscriber_count),
      subscription_price = COALESCE(EXCLUDED.subscription_price, performers.subscription_price),
      last_spidered = NOW(),
      updated_at = NOW()
    RETURNING id, (xmax = 0) as is_new
  `, [
    platformId,
    performer.external_id,
    performer.username,
    performer.display_name,
    performer.profile_url,
    performer.avatar_url,
    performer.cover_photo_url,
    performer.bio,
    performer.categories,
    performer.gender,
    performer.body_type,
    performer.ethnicity,
    performer.age,
    performer.location,
    performer.is_verified,
    performer.is_online,
    performer.follower_count,
    performer.subscriber_count,
    performer.media_count,
    performer.video_count,
    performer.photo_count,
    performer.subscription_price,
    performer.free_trial_days,
    performer.languages,
    JSON.stringify(performer.social_links),
    JSON.stringify(performer.raw_data)
  ]);

  return {
    id: result.rows[0].id,
    action: result.rows[0].is_new ? 'inserted' : 'updated'
  };
}

// Main import function
async function importPerformers(platformSlug, filePath) {
  console.log(`\n=== Importing Performers ===`);
  console.log(`Platform: ${platformSlug}`);
  console.log(`File: ${filePath}`);

  // Get platform ID
  const platformResult = await pool.query(
    'SELECT id FROM affiliate_platforms WHERE slug = $1',
    [platformSlug]
  );

  if (platformResult.rows.length === 0) {
    throw new Error(`Platform not found: ${platformSlug}`);
  }

  const platformId = platformResult.rows[0].id;

  // Read and parse file
  const content = fs.readFileSync(filePath, 'utf8');
  let performers;

  if (filePath.endsWith('.json')) {
    const data = JSON.parse(content);
    performers = Array.isArray(data) ? data : (data.performers || data.models || [data]);
  } else if (filePath.endsWith('.csv')) {
    performers = parseCSV(content);
  } else {
    throw new Error('Unsupported file format. Use .json or .csv');
  }

  console.log(`Found ${performers.length} performers to import`);

  let added = 0, updated = 0, errors = 0;

  for (const raw of performers) {
    try {
      const normalized = normalizePerformer(raw, platformSlug);

      if (!normalized.external_id || !normalized.username) {
        console.log(`Skipping invalid performer: missing ID or username`);
        errors++;
        continue;
      }

      const result = await savePerformer(normalized, platformId);

      if (result.action === 'inserted') {
        added++;
        console.log(`  + Added: ${normalized.username}`);
      } else {
        updated++;
        console.log(`  ~ Updated: ${normalized.username}`);
      }
    } catch (err) {
      console.error(`  ! Error importing performer:`, err.message);
      errors++;
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Added: ${added}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);

  return { added, updated, errors };
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes('--help')) {
    console.log(`
Import Performers from CSV/JSON

Usage: node scripts/import-performers.js <platform> <file>

Platforms: onlyfans, fansly, justforfans, 4myfans, loyalfans

Examples:
  node scripts/import-performers.js onlyfans data/onlyfans.json
  node scripts/import-performers.js fansly data/fansly-performers.csv

CSV Format:
  username,display_name,bio,avatar_url,followers,subscription_price
  performer1,Display Name,Bio text,https://...,1000,9.99

JSON Format:
  [{"username": "...", "display_name": "...", ...}]
  or {"performers": [...]}
`);
    process.exit(0);
  }

  const [platform, file] = args;

  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  try {
    await importPerformers(platform, file);
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
