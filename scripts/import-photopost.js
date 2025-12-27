import 'dotenv/config';
import mysql from 'mysql2/promise';
import pg from 'pg';
const { Pool } = pg;

const ppConfig = {
  host: '127.0.0.1',
  user: 'pp', 
  password: 'apple1apple',
  database: 'br_photopost'
};

const pgConfig = {
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
};

async function importData() {
  console.log('PhotoPost Import Starting...\n');

  const mysqlConn = await mysql.createConnection(ppConfig);
  console.log('MySQL connected');

  const pgPool = new Pool(pgConfig);
  console.log('PostgreSQL connected\n');

  try {
    // Import Categories
    console.log('Importing categories...');
    const [categories] = await mysqlConn.execute(
      'SELECT id, catname, description, parent, photos FROM pp_categories ORDER BY id'
    );
    console.log('Found ' + categories.length + ' categories');

    for (const cat of categories) {
      await pgPool.query(
        'INSERT INTO category (id, catname, description, parent_category, photo_count) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET catname = $2',
        [cat.id, cat.catname, cat.description, cat.parent > 0 ? cat.parent : null, cat.photos || 0]
      );
    }
    
    const catRes = await pgPool.query('SELECT COUNT(*) FROM category');
    console.log('Imported ' + catRes.rows[0].count + ' categories\n');

    // Import Photos
    console.log('Importing photos...');
    const [countResult] = await mysqlConn.execute('SELECT COUNT(*) as total FROM pp_photos WHERE approved = 1');
    const totalPhotos = countResult[0].total;
    console.log('Found ' + totalPhotos + ' photos');

    const batchSize = 1000;
    let imported = 0;

    for (let offset = 0; offset < totalPhotos; offset += batchSize) {
      const [photos] = await mysqlConn.execute(
        'SELECT id, cat, title, description, bigimage, width, height, filesize, views, rating, date FROM pp_photos WHERE approved = 1 ORDER BY id LIMIT ? OFFSET ?',
        [batchSize, offset]
      );

      for (const photo of photos) {
        try {
          await pgPool.query(
            'INSERT INTO image (id, title, description, local_path, thumbnail_path, width, height, file_size, view_count, average_rating, belongs_to_gallery, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, to_timestamp($12)) ON CONFLICT (id) DO NOTHING',
            [photo.id, photo.title, photo.description, photo.cat + '/' + photo.bigimage, photo.cat + '/thumbs/' + photo.bigimage, photo.width, photo.height, photo.filesize, photo.views, photo.rating, photo.cat, photo.date]
          );
          imported++;
        } catch(e) {
          // skip
        }
      }
      process.stdout.write('\rImported ' + imported + ' / ' + totalPhotos + '...');
    }

    console.log('\n\nDone!');
    const imgRes = await pgPool.query('SELECT COUNT(*) FROM image');
    console.log('Total images: ' + imgRes.rows[0].count);

  } finally {
    await mysqlConn.end();
    await pgPool.end();
  }
}

importData().catch(err => { console.error('Failed:', err); process.exit(1); });
