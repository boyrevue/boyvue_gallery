#!/bin/bash
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           BoyVue Content & Traffic Insights                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

DATA=$(curl -s http://localhost:3000/api/insights)

echo "🔍 GOOGLE SEARCHES BRINGING TRAFFIC (Last 30 days)"
echo "─────────────────────────────────────────────────"
echo "$DATA" | jq -r '.searchEngineTraffic.google[:15] | .[] | "  \(.count)x  \(.search_query)"'

echo ""
echo "📊 SEARCH ENGINE BREAKDOWN"
echo "─────────────────────────────────────────────────"
echo "$DATA" | jq -r '.searchEngineTraffic.byEngine[] | "  \(.engine): \(.count) searches"'

echo ""
echo "⚠️  CONTENT GAPS - People search for but we DON'T have:"
echo "─────────────────────────────────────────────────"
echo "$DATA" | jq -r '.contentInsights.gaps[:15] | .[] | "  \(.search_count)x  \(.term)"'

echo ""
echo "✅ POPULAR CONTENT - People search for that we HAVE:"
echo "─────────────────────────────────────────────────"
echo "$DATA" | jq -r '.contentInsights.popular[:15] | .[] | "  \(.search_count)x  \(.term)"'

echo ""
echo "👤 POTENTIAL ACTOR/MODEL SEARCHES:"
echo "─────────────────────────────────────────────────"
echo "$DATA" | jq -r '.contentInsights.actorSearches[:10] | .[] | "  \(.count)x  \(.search_query)"'

echo ""
echo "🏆 COMPETITOR SITES SENDING TRAFFIC:"
echo "─────────────────────────────────────────────────"
echo "$DATA" | jq -r '.referrers.competitors[] | "  \(.visits) visits from \(.referrer_domain) (\(.unique_visitors) unique)"'

echo ""
echo "🌐 TOP EXTERNAL REFERRERS:"
echo "─────────────────────────────────────────────────"
echo "$DATA" | jq -r '.referrers.allSites[:15] | .[] | "  \(.visits)x  \(.referrer_domain)"'

echo ""
echo "📱 SOCIAL MEDIA TRAFFIC:"
echo "─────────────────────────────────────────────────"
echo "$DATA" | jq -r '.referrers.socialMedia[] | "  \(.visits)x  \(.referrer_domain)"'

echo ""
echo "🔎 INTERNAL SITE SEARCHES (with zero results marked):"
echo "─────────────────────────────────────────────────"
echo "$DATA" | jq -r '.internalSearches[:20] | .[] | "  \(.count)x  \(.term)\(if .zero_results > 0 then " ❌(\(.zero_results) failed)" else "" end)"'

echo ""
echo "💡 RECOMMENDATIONS:"
echo "─────────────────────────────────────────────────"
echo "📌 Content to Create:"
echo "$DATA" | jq -r '.recommendations.contentToCreate[:5] | .[] | "   • \(.)"'
echo ""
echo "📌 Trends to Capitalize:"
echo "$DATA" | jq -r '.recommendations.trendsToCapitalize[:5] | .[] | "   • \(.)"'
echo ""
echo "📌 Competitors to Monitor:"
echo "$DATA" | jq -r '.recommendations.competitorsToBeat[:5] | .[] | "   • \(.)"'
