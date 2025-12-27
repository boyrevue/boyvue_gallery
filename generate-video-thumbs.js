import { execSync } from 'child_process';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

const MEDIA_PATH = '/var/www/html/media';
const THUMBS_PATH = '/var/www/html/media/video-thumbs';

// Create thumbs directory
if (!fs.existsSync(THUMBS_PATH)) {
  fs.mkdirSync(THUMBS_PATH, { recursive: true });
}

async function generateThumbnails() {
  const result = await pool.query(`
    SELECT id, local_path FROM image 
    WHERE local_path LIKE '%.mp4' OR local_path LIKE '%.webm' OR local_path LIKE '%.avi' 
    OR local_path LIKE '%.mov' OR local_path LIKE '%.wmv' OR local_path LIKE '%.flv' OR local_path LIKE '%.mkv'
  `);

  console.log(`Found ${result.rows.length} videos to process`);

  let processed = 0;
  for (const video of result.rows) {
    const videoPath = path.join(MEDIA_PATH, video.local_path);
    const thumbDir = path.join(THUMBS_PATH, String(video.id));
    
    // Skip if already processed
    if (fs.existsSync(thumbDir) && fs.readdirSync(thumbDir).length >= 5) {
      processed++;
      continue;
    }

    if (!fs.existsSync(videoPath)) {
      console.log(`Video not found: ${videoPath}`);
      continue;
    }

    // Create thumb directory for this video
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }

    try {
      // Get video duration
      const durationCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}" 2>/dev/null`;
      let duration = 60;
      try {
        duration = parseFloat(execSync(durationCmd).toString().trim()) || 60;
      } catch (e) {
        duration = 60;
      }
      
      // Generate 5 thumbnails at 10%, 30%, 50%, 70%, 90% of video
      const positions = [0.1, 0.3, 0.5, 0.7, 0.9];
      
      for (let i = 0; i < 5; i++) {
        const timestamp = Math.floor(duration * positions[i]);
        const outputPath = path.join(thumbDir, `thumb_${i}.jpg`);
        
        if (!fs.existsSync(outputPath)) {
          const cmd = `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 -vf "scale=320:-1" "${outputPath}" -y 2>/dev/null`;
          try {
            execSync(cmd, { timeout: 30000 });
          } catch (e) {
            // Silent fail for individual thumbnails
          }
        }
      }
      processed++;
      if (processed % 100 === 0) {
        console.log(`Processed ${processed}/${result.rows.length} videos`);
      }
    } catch (e) {
      console.log(`Error processing video ${video.id}: ${e.message}`);
    }
  }

  console.log(`Done! Processed ${processed} videos.`);
  pool.end();
}

generateThumbnails();
