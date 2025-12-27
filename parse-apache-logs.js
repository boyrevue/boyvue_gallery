import fs from 'fs';
import readline from 'readline';
import pg from 'pg';
import { URL } from 'url';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

const LOG_FILE = '/var/log/apache2/boyvue_access.log';

// Search engine patterns
const searchEngines = {
  'google': /google\.[a-z]+\/search\?.*q=([^&]+)/i,
  'bing': /bing\.com\/search\?.*q=([^&]+)/i,
  'yahoo': /search\.yahoo\.com\/search.*p=([^&]+)/i,
  'duckduckgo': /duckduckgo\.com\/\?.*q=([^&]+)/i,
  'yandex': /yandex\.[a-z]+\/search.*text=([^&]+)/i,
  'baidu': /baidu\.com\/s\?.*wd=([^&]+)/i
};

// Competitor/related site patterns
const competitorPatterns = [
  /pornhub\.com/i, /xvideos\.com/i, /xhamster\.com/i, /redtube\.com/i,
  /youporn\.com/i, /tube8\.com/i, /spankbang\.com/i, /xnxx\.com/i,
  /gaymaletube\.com/i, /gaytube\.com/i, /boyfriendtv\.com/i,
  /xtube\.com/i, /gayforit\.eu/i, /thisvid\.com/i, /ashemaletube\.com/i,
  /reddit\.com/i, /twitter\.com/i, /tumblr\.com/i
];

function extractSearchQuery(referer) {
  for (const [engine, pattern] of Object.entries(searchEngines)) {
    const match = referer.match(pattern);
    if (match) {
      try {
        return { engine, query: decodeURIComponent(match[1].replace(/\+/g, ' ')) };
      } catch (e) {
        return { engine, query: match[1].replace(/\+/g, ' ') };
      }
    }
  }
  return null;
}

function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return null;
  }
}

function isCompetitor(domain) {
  return competitorPatterns.some(pattern => pattern.test(domain));
}

// Parse Apache combined log format
function parseLogLine(line) {
  // Combined log format: IP - - [date] "METHOD URL HTTP/x.x" status size "referer" "user-agent"
  const match = line.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d+) \S+ "([^"]*)" "([^"]*)"/);
  if (!match) return null;
  
  return {
    ip: match[1],
    date: match[2],
    method: match[3],
    path: match[4],
    status: match[5],
    referer: match[6] !== '-' ? match[6] : null,
    userAgent: match[7]
  };
}

async function processLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log('Log file not found:', LOG_FILE);
    return;
  }

  const fileStream = fs.createReadStream(LOG_FILE);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let searchEngineCount = 0;
  let competitorCount = 0;
  let processed = 0;

  const searchQueries = new Map();
  const competitors = new Map();

  for await (const line of rl) {
    const parsed = parseLogLine(line);
    if (!parsed || !parsed.referer) continue;
    
    processed++;
    
    // Check for search engine referral
    const searchInfo = extractSearchQuery(parsed.referer);
    if (searchInfo) {
      const key = `${searchInfo.engine}:${searchInfo.query.toLowerCase()}`;
      searchQueries.set(key, {
        engine: searchInfo.engine,
        query: searchInfo.query,
        landingPage: parsed.path,
        ip: parsed.ip,
        count: (searchQueries.get(key)?.count || 0) + 1
      });
      searchEngineCount++;
      continue;
    }
    
    // Check for competitor/external referrer
    const domain = getDomain(parsed.referer);
    if (domain && !domain.includes('boyvue.com')) {
      const key = domain;
      competitors.set(key, {
        domain: domain,
        url: parsed.referer,
        landingPage: parsed.path,
        ip: parsed.ip,
        isCompetitor: isCompetitor(domain),
        count: (competitors.get(key)?.count || 0) + 1
      });
      competitorCount++;
    }
  }

  console.log(`Processed ${processed} log entries`);
  console.log(`Found ${searchEngineCount} search engine referrals`);
  console.log(`Found ${competitorCount} external referrals`);

  // Insert search engine referrals
  for (const [key, data] of searchQueries) {
    try {
      await pool.query(
        `INSERT INTO search_engine_referrals (engine, search_query, landing_page, ip, country)
         VALUES ($1, $2, $3, $4, 'XX')
         ON CONFLICT DO NOTHING`,
        [data.engine, data.query.substring(0, 500), data.landingPage, data.ip]
      );
      
      // Track content demand
      await pool.query(
        `INSERT INTO content_demand (term, source, search_count, last_searched)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (term) DO UPDATE SET 
           search_count = content_demand.search_count + $3,
           last_searched = NOW()`,
        [data.query.toLowerCase().substring(0, 255), data.engine, data.count]
      );
    } catch (e) {}
  }

  // Insert competitor referrals
  for (const [domain, data] of competitors) {
    try {
      await pool.query(
        `INSERT INTO external_referrers (referrer_domain, referrer_url, landing_page, ip, country)
         VALUES ($1, $2, $3, $4, 'XX')`,
        [data.domain, data.url.substring(0, 1000), data.landingPage, data.ip]
      );
    } catch (e) {}
  }

  console.log('Data saved to database');
  
  // Print summary
  console.log('\n=== TOP SEARCH QUERIES ===');
  const topSearches = [...searchQueries.values()].sort((a, b) => b.count - a.count).slice(0, 20);
  topSearches.forEach(s => console.log(`  ${s.count}x [${s.engine}] "${s.query}"`));

  console.log('\n=== TOP REFERRER DOMAINS ===');
  const topReferrers = [...competitors.values()].sort((a, b) => b.count - a.count).slice(0, 20);
  topReferrers.forEach(r => console.log(`  ${r.count}x ${r.isCompetitor ? '⚠️' : '  '} ${r.domain}`));

  pool.end();
}

processLogs();
