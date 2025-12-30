const pg = require('pg');
const fs = require('fs');

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

async function saveRooms() {
  const data = JSON.parse(fs.readFileSync('/tmp/chaturbate_rooms.json', 'utf8'));
  const rooms = data.results || [];
  console.log(`Fetched ${rooms.length} rooms from Chaturbate API`);

  // Get Chaturbate platform ID
  const platformResult = await pool.query("SELECT id FROM affiliate_platforms WHERE slug = 'chaturbate'");
  if (platformResult.rows.length === 0) {
    console.log("Error: Chaturbate platform not found");
    process.exit(1);
  }
  const platformId = platformResult.rows[0].id;
  console.log(`Chaturbate platform ID: ${platformId}`);

  let inserted = 0;
  let updated = 0;

  for (const room of rooms) {
    const username = room.username;
    if (!username) continue;

    const displayName = room.display_name || username;
    const profileUrl = `https://chaturbate.com/${username}`;
    const avatarUrl = room.image_url || null;
    const bio = room.room_subject || null;
    const age = room.age || null;
    const location = room.location || null;
    const isHd = room.is_hd || false;
    const numUsers = room.num_users || 0;
    const numFollowers = room.num_followers || 0;
    const tags = room.tags || [];
    const currentShow = room.current_show || 'public';
    const spokenLanguages = room.spoken_languages ? room.spoken_languages.split(',').map(l => l.trim()) : [];

    const rawData = JSON.stringify({
      seconds_online: room.seconds_online,
      num_users: numUsers,
      is_hd: isHd,
      is_new: room.is_new,
      current_show: currentShow,
      country: room.country,
      spoken_languages: room.spoken_languages,
      iframe_embed: room.iframe_embed,
      chat_room_url: room.chat_room_url,
      chat_room_url_revshare: room.chat_room_url_revshare
    });

    // Categories is an array type in the table
    const categoriesArray = tags;

    try {
      const result = await pool.query(`
        INSERT INTO performers (
          platform_id, external_id, username, display_name, profile_url,
          avatar_url, bio, age, location, is_online, is_verified,
          last_online, follower_count, categories, languages, raw_data, gender,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10,
          NOW(), $11, $12, $13, $14, 'male', NOW(), NOW()
        )
        ON CONFLICT (platform_id, external_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          avatar_url = EXCLUDED.avatar_url,
          bio = EXCLUDED.bio,
          age = EXCLUDED.age,
          location = EXCLUDED.location,
          is_online = true,
          last_online = NOW(),
          follower_count = EXCLUDED.follower_count,
          categories = EXCLUDED.categories,
          languages = EXCLUDED.languages,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
        RETURNING (xmax = 0) as was_insert
      `, [
        platformId, username, username, displayName, profileUrl,
        avatarUrl, bio, age, location, isHd,
        numFollowers, categoriesArray, spokenLanguages, rawData
      ]);

      if (result.rows[0].was_insert) {
        inserted++;
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`Error saving ${username}:`, err.message);
    }
  }

  console.log(`\nDatabase update complete:`);
  console.log(`  - Inserted: ${inserted} new performers`);
  console.log(`  - Updated: ${updated} existing performers`);
  console.log(`  - Total: ${inserted + updated} performers`);

  await pool.end();
}

saveRooms().catch(console.error);
