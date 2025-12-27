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

const MEDIA_PATH = '/var/www/html/bp/data';
const THUMBS_PATH = '/var/www/html/bp/data/video-thumbs';

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
  let generated = 0;
  
  for (const video of result.rows) {
    const videoPath = path.join(MEDIA_PATH, video.local_path);
    const thumbDir = path.join(THUMBS_PATH, String(video.id));
    
    if (fs.existsSync(thumbDir) && fs.readdirSync(thumbDir).length >= 5) {
      processed++;
      continue;
    }

    if (!fs.existsSync(videoPath)) {
      continue;
    }

    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }

    try {
      let duration = 60;
      try {
        const durationCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}" 2>/dev/null`;
        duration = parseFloat(execSync(durationCmd).toString().trim()) || 60;
      } catch (e) {}
      
      const positions = [0.1, 0.3, 0.5, 0.7, 0.9];
      let thumbsCreated = 0;
      
      for (let i = 0; i < 5; i++) {
        const timestamp = Math.max(1, Math.floor(duration * positions[i]));
        const outputPath = path.join(thumbDir, `thumb_${i}.jpg`);
        
        if (!fs.existsSync(outputPath)) {
          try {
            execSync(`ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 -vf "scale=320:-1" "${outputPath}" -y 2>/dev/null`, { timeout: 30000 });
            thumbsCreated++;
          } catch (e) {}
        }
      }
      
      if (thumbsCreated > 0) {
        generated++;
        console.log(`Generated ${thumbsCreated} thumbs for video ${video.id} (${generated} total)`);
      }
      processed++;
      
    } catch (e) {}
  }

  console.log(`Done! Generated thumbnails for ${generated} videos.`);
  pool.end();
}

generateThumbnails();
