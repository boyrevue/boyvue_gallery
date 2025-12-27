#!/bin/bash
echo "=== BoyVue Search Statistics ==="
echo ""

curl -s http://localhost:3000/api/search-stats | jq '
"📊 TOTALS",
"   All-time searches: \(.totals.allTime)",
"   Unique searchers: \(.totals.uniqueSearchers)",
"   Unique terms: \(.totals.uniqueTerms)",
"",
"📅 TODAY",
"   Searches: \(.today.searches)",
"   Unique searchers: \(.today.uniqueSearchers)",
"",
"🔥 TOP SEARCHES (All Time):",
(.popularAllTime[:15] | .[] | "   \(.count)x  \(.search_term)"),
"",
"⏰ RECENT SEARCHES:",
(.recent[:10] | .[] | "   [\(.country)] \(.query) → \(.results_count) results")
'
