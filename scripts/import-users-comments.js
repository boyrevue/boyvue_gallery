import mysql from 'mysql2/promise';
import pg from 'pg';
const { Pool } = pg;

const ppConfig = { host: '127.0.0.1', user: 'pp', password: 'apple1apple', database: 'br_photopost' };
const pgConfig = { host: 'localhost', port: 5432, database: 'gallery', user: 'galleryuser', password: 'apple1apple' };

async function importUsersComments() {
  console.log('Importing users and comments...\n');

  const mysqlConn = await mysql.createConnection(ppConfig);
  const pgPool = new Pool(pgConfig);

  // Create tables if not exist
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username VARCHAR(255),
      email VARCHAR(255),
      join_date TIMESTAMP,
      post_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY,
      photo_id INTEGER,
      user_id INTEGER,
      username VARCHAR(255),
      comment_text TEXT,
      created_at TIMESTAMP,
      ip_address VARCHAR(50)
    );
  `);

  // Import users
  console.log('Importing users...');
  const [users] = await mysqlConn.execute('SELECT userid, username, email, joindate, posts FROM pp_users');
  console.log(`Found ${users.length} users`);

  for (const u of users) {
    await pgPool.query(
      'INSERT INTO users (id, username, email, join_date, post_count) VALUES ($1, $2, $3, to_timestamp($4), $5) ON CONFLICT (id) DO NOTHING',
      [u.userid, u.username, u.email, u.joindate, u.posts]
    );
  }
  console.log('Users imported\n');

  // Import comments
  console.log('Importing comments...');
  const [countRes] = await mysqlConn.execute('SELECT COUNT(*) as total FROM pp_comments');
  const total = countRes[0].total;
  console.log(`Found ${total} comments`);

  const batchSize = 5000;
  let imported = 0;

  for (let offset = 0; offset < total; offset += batchSize) {
    const [comments] = await mysqlConn.execute(
      'SELECT id, photo, userid, username, comment, date, ipaddress FROM pp_comments ORDER BY id LIMIT ? OFFSET ?',
      [batchSize, offset]
    );

    for (const c of comments) {
      await pgPool.query(
        'INSERT INTO comments (id, photo_id, user_id, username, comment_text, created_at, ip_address) VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7) ON CONFLICT (id) DO NOTHING',
        [c.id, c.photo, c.userid, c.username, c.comment, c.date, c.ipaddress]
      );
    }
    imported += comments.length;
    process.stdout.write(`\rImported ${imported}/${total} comments...`);
  }

  console.log('\n\nDone!');
  const userCount = await pgPool.query('SELECT COUNT(*) FROM users');
  const commentCount = await pgPool.query('SELECT COUNT(*) FROM comments');
  console.log(`Users: ${userCount.rows[0].count}`);
  console.log(`Comments: ${commentCount.rows[0].count}`);

  await mysqlConn.end();
  await pgPool.end();
}

importUsersComments().catch(err => { console.error('Failed:', err); process.exit(1); });
