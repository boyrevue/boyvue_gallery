#!/bin/bash
echo "=== BoyVue Live Stats ==="
curl -s http://localhost:3000/api/analytics | jq '
"🟢 Live now: \(.live) visitors",
"📊 Today: \(.today.visitors) visitors, \(.today.pageviews) pageviews",
"",
"🌍 Top Countries:",
(.countries[:10] | .[] | "   \(.country): \(.visitors) visitors")
'
