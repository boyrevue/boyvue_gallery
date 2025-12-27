#!/bin/bash

REPORT_DATE=$(date '+%Y-%m-%d')
WEEK_START=$(date -d 'last monday' '+%Y-%m-%d')
REPORT_FILE="/tmp/boyvue-weekly-${REPORT_DATE}.txt"
EMAIL="v.power@diggi.io"

cd /var/www/html/boyvue

cat > "$REPORT_FILE" << HEADER
╔══════════════════════════════════════════════════════════════════════╗
║                   BoyVue WEEKLY Analytics Report                      ║
║                  Week of ${WEEK_START} to ${REPORT_DATE}              ║
╚══════════════════════════════════════════════════════════════════════╝

HEADER

# Get weekly stats from database
PGPASSWORD=apple1apple psql -h localhost -U galleryuser -d gallery -t >> "$REPORT_FILE" << 'SQL'

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '📊 WEEKLY TRAFFIC SUMMARY';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

SELECT 'Total Visitors: ' || COUNT(DISTINCT ip) FROM analytics WHERE created_at > NOW() - INTERVAL '7 days';
SELECT 'Total Page Views: ' || COUNT(*) FROM analytics WHERE created_at > NOW() - INTERVAL '7 days';
SELECT 'Total Searches: ' || COUNT(*) FROM search_logs WHERE created_at > NOW() - INTERVAL '7 days';

SELECT '';
SELECT '🌍 TOP COUNTRIES THIS WEEK:';
SELECT '   ' || country || ': ' || COUNT(DISTINCT ip) || ' visitors'
FROM analytics WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY country ORDER BY COUNT(DISTINCT ip) DESC LIMIT 15;

SELECT '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '🔍 TOP GOOGLE SEARCHES THIS WEEK:';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '   ' || COUNT(*) || 'x  ' || search_query
FROM search_engine_referrals 
WHERE engine = 'google' AND created_at > NOW() - INTERVAL '7 days'
GROUP BY search_query ORDER BY COUNT(*) DESC LIMIT 25;

SELECT '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '⚠️  CONTENT GAPS (High demand, no content):';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '   ' || search_count || 'x  ' || term
FROM content_demand WHERE has_content = FALSE
ORDER BY search_count DESC LIMIT 20;

SELECT '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '🏆 COMPETITOR TRAFFIC THIS WEEK:';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '   ' || COUNT(*) || ' visits from ' || referrer_domain
FROM external_referrers 
WHERE created_at > NOW() - INTERVAL '7 days'
  AND referrer_domain IN ('pornhub.com', 'xvideos.com', 'xhamster.com', 'gaymaletube.com', 'boyfriendtv.com', 'reddit.com', 'twitter.com', 'x.com')
GROUP BY referrer_domain ORDER BY COUNT(*) DESC;

SELECT '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '🌐 ALL EXTERNAL REFERRERS:';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '   ' || COUNT(*) || 'x  ' || referrer_domain
FROM external_referrers WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY referrer_domain ORDER BY COUNT(*) DESC LIMIT 30;

SELECT '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '🔎 TOP INTERNAL SEARCHES:';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '   ' || COUNT(*) || 'x  ' || LOWER(query)
FROM search_logs WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY LOWER(query) ORDER BY COUNT(*) DESC LIMIT 25;

SELECT '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '❌ ZERO RESULT SEARCHES (Need content!):';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
SELECT '   ' || COUNT(*) || 'x  ' || LOWER(query)
FROM search_logs WHERE results_count = 0 AND created_at > NOW() - INTERVAL '7 days'
GROUP BY LOWER(query) ORDER BY COUNT(*) DESC LIMIT 20;

SQL

cat >> "$REPORT_FILE" << FOOTER

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Weekly Report generated: $(date)
Website: https://boyvue.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOOTER

# Send email
cat "$REPORT_FILE" | mail -s "📊 BoyVue WEEKLY Report - Week of ${WEEK_START}" "$EMAIL"

echo "Weekly report sent to $EMAIL"
