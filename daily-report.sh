#!/bin/bash

REPORT_DATE=$(date '+%Y-%m-%d')
REPORT_FILE="/tmp/boyvue-report-${REPORT_DATE}.txt"
EMAIL="v.power@diggi.io"

# Parse Apache logs first
cd /var/www/html/boyvue
node parse-apache-logs.js >> /tmp/apache-parse.log 2>&1

# Generate report
cat > "$REPORT_FILE" << HEADER
╔══════════════════════════════════════════════════════════════════════╗
║                    BoyVue Daily Analytics Report                      ║
║                         ${REPORT_DATE}                                ║
╚══════════════════════════════════════════════════════════════════════╝

HEADER

# Get analytics data
ANALYTICS=$(curl -s http://localhost:3000/api/analytics)
INSIGHTS=$(curl -s http://localhost:3000/api/insights)
SEARCH_STATS=$(curl -s http://localhost:3000/api/search-stats)

cat >> "$REPORT_FILE" << SECTION1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 TRAFFIC OVERVIEW (Last 24 Hours)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION1

echo "$ANALYTICS" | jq -r '
"🟢 Currently Online: \(.live) visitors",
"👥 Total Visitors: \(.today.visitors)",
"📄 Page Views: \(.today.pageviews)",
"",
"🌍 TOP COUNTRIES:",
(.countries[:10] | .[] | "   \(.country): \(.visitors) visitors")
' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SEARCH ENGINE TRAFFIC (Google, Bing, etc.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Search Engine Breakdown:
SECTION2

echo "$INSIGHTS" | jq -r '.searchEngineTraffic.byEngine[] | "   \(.engine): \(.count) searches"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION3

Top Google Searches Bringing Traffic:
SECTION3

echo "$INSIGHTS" | jq -r '.searchEngineTraffic.google[:20] | .[] | "   \(.count)x  \(.search_query)"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  CONTENT GAPS - What People Want But We Don't Have
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION4

echo "$INSIGHTS" | jq -r '.contentInsights.gaps[:15] | .[] | "   \(.search_count)x  \(.term)"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION5

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ POPULAR CONTENT - What's Working Well
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION5

echo "$INSIGHTS" | jq -r '.contentInsights.popular[:15] | .[] | "   \(.search_count)x  \(.term)"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 POTENTIAL ACTOR/MODEL SEARCHES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION6

echo "$INSIGHTS" | jq -r '.contentInsights.actorSearches[:15] | .[] | "   \(.count)x  \(.search_query)"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION7

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 COMPETITOR SITES SENDING TRAFFIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION7

echo "$INSIGHTS" | jq -r '.referrers.competitors[] | "   \(.visits) visits from \(.referrer_domain) (\(.unique_visitors) unique)"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION8

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 TOP EXTERNAL REFERRERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION8

echo "$INSIGHTS" | jq -r '.referrers.allSites[:20] | .[] | "   \(.visits)x  \(.referrer_domain)"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION9

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 SOCIAL MEDIA TRAFFIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION9

echo "$INSIGHTS" | jq -r '.referrers.socialMedia[] | "   \(.visits)x  \(.referrer_domain)"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION10

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔎 INTERNAL SITE SEARCHES (Today)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION10

echo "$SEARCH_STATS" | jq -r '
"Total Searches Today: \(.today.searches)",
"Unique Searchers: \(.today.uniqueSearchers)",
"",
"Popular Searches Today:",
(.popularToday[:15] | .[] | "   \(.count)x  \(.search_term)"),
"",
"Zero Result Searches (Content Needed):",
(.zeroResults[:10] | .[] | "   \(.count)x  \(.search_term)")
' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION11

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 ACTIONABLE RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 CONTENT TO CREATE (High demand, no content):
SECTION11

echo "$INSIGHTS" | jq -r '.recommendations.contentToCreate[:10] | .[] | "   • \(.)"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION12

📌 TRENDS TO CAPITALIZE (Already working, do more):
SECTION12

echo "$INSIGHTS" | jq -r '.recommendations.trendsToCapitalize[:10] | .[] | "   • \(.)"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << SECTION13

📌 COMPETITORS TO MONITOR:
SECTION13

echo "$INSIGHTS" | jq -r '.recommendations.competitorsToBeat[] | "   • \(.)"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << FOOTER

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Report generated: $(date)
Website: https://boyvue.com
API Endpoints:
  - https://boyvue.com/api/analytics
  - https://boyvue.com/api/insights
  - https://boyvue.com/api/search-stats

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOOTER

# Send email
cat "$REPORT_FILE" | mail -s "📊 BoyVue Daily Report - ${REPORT_DATE}" "$EMAIL"

echo "Report sent to $EMAIL"
echo "Report saved to $REPORT_FILE"
