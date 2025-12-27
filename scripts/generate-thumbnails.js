#!/usr/bin/env node
/**
 * Thumbnail Generator
 * Checks all images/videos and creates missing thumbnails
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

const MEDIA_BASE = '/var/www/html/boysreview/data';
const THUMB_WIDTH = 150;
const THUMB_HEIGHT = 150;

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const VIDEO_EXTS = ['.mp4', '.webm', '.avi', '.mov', '.wmv', '.flv', '.mkv'];

function isImage(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

function isVideo(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  return VIDEO_EXTS.includes(ext);
}

async function generateThumbnails() {
  console.log('Thumbnail Generator Starting...\n');

  const countRes = await pool.query('SELECT COUNT(*) FROM image');
  const total = parseInt(countRes.rows[0].count);
  console.log(`Total media: ${total}\n`);

  const batchSize = 1000;
  let checked = 0;
  let created = 0;
  let skipped = 0;
  let missing = 0;
  let errors = 0;

  for (let offset = 0; offset < total; offset += batchSize) {
    const result = await pool.query(
      'SELECT id, local_path, thumbnail_path FROM image ORDER BY id LIMIT $1 OFFSET $2',
      [batchSize, offset]
    );

    for (const row of result.rows) {
      checked++;
      
      const mainPath = path.join(MEDIA_BASE, row.local_path);
      const thumbPath = path.join(MEDIA_BASE, row.thumbnail_path);
      const thumbDir = path.dirname(thumbPath);

      // Check if thumbnail exists
      if (fs.existsSync(thumbPath)) {
        skipped++;
        continue;
      }

      // Check if main file exists
      if (!fs.existsSync(mainPath)) {
        missing++;
        continue;
      }

      // Create thumbs directory if needed
      if (!fs.existsSync(thumbDir)) {
        fs.mkdirSync(thumbDir, { recursive: true });
      }

      try {
        if (isImage(mainPath)) {
          // Generate thumbnail for image using ImageMagick
          execSync(`convert "${mainPath}" -thumbnail ${THUMB_WIDTH}x${THUMB_HEIGHT}^ -gravity center -extent ${THUMB_WIDTH}x${THUMB_HEIGHT} -quality 85 "${thumbPath}"`, {
            timeout: 30000,
            stdio: 'pipe'
          });
          created++;
        } else if (isVideo(mainPath)) {
          // Generate thumbnail for video using ffmpeg (frame at 1 second)
          const thumbJpg = thumbPath.replace(/\.[^.]+$/, '.jpg');
          execSync(`ffmpeg -y -i "${mainPath}" -ss 00:00:01 -vframes 1 -vf "scale=${THUMB_WIDTH}:${THUMB_HEIGHT}:force_original_aspect_ratio=increase,crop=${THUMB_WIDTH}:${THUMB_HEIGHT}" "${thumbJpg}" 2>/dev/null`, {
            timeout: 60000,
            stdio: 'pipe'
          });
          created++;
        } else {
          skipped++;
        }
        
        if (created % 100 === 0 && created > 0) {
          console.log(`\nCreated ${created} thumbnails...`);
        }
      } catch (e) {
        errors++;
      }
    }

    process.stdout.write(`\rChecked ${checked}/${total} | Created ${created} | Existed ${skipped} | Missing ${missing} | Errors ${errors}`);
  }

  console.log('\n\n=== Summary ===');
  console.log(`Checked: ${checked}`);
  console.log(`Created: ${created}`);
  console.log(`Already existed: ${skipped}`);
  console.log(`Missing source: ${missing}`);
  console.log(`Errors: ${errors}`);

  await pool.end();
}

generateThumbnails().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
