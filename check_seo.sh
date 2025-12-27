# Full SEO verification tests

echo "============================================="
echo "        BOYVUE SEO VERIFICATION REPORT"
echo "============================================="
echo ""

echo "1. HOMEPAGE SEO (All Languages)"
echo "---------------------------------------------"
for lang in en de fr es ja ru; do
  echo "[$lang]:"
  curl -s -A "Googlebot" "https://boyvue.com/?lang=$lang" | grep "<title>" | sed 's/.*<title>\(.*\)<\/title>.*/  Title: \1/'
done

echo ""
echo "2. VIDEO PAGE SEO (Multi-language)"
echo "---------------------------------------------"
for lang in en de es ja; do
  echo "[$lang] Video 386768:"
  curl -s -A "Googlebot" "https://boyvue.com/v/386768?lang=$lang" | grep "<title>" | sed 's/.*<title>\(.*\)<\/title>.*/  Title: \1/'
done

echo ""
echo "3. CATEGORY PAGE SEO"
echo "---------------------------------------------"
echo "[en] Category 501:"
curl -s -A "Googlebot" "https://boyvue.com/c/501?lang=en" | grep "<title>" | sed 's/.*<title>\(.*\)<\/title>.*/  Title: \1/'
echo "[de] Category 646:"
curl -s -A "Googlebot" "https://boyvue.com/c/646?lang=de" | grep "<title>" | sed 's/.*<title>\(.*\)<\/title>.*/  Title: \1/'

echo ""
echo "4. HREFLANG TAGS (for Google multi-language)"
echo "---------------------------------------------"
curl -s -A "Googlebot" "https://boyvue.com/?lang=en" | grep "hreflang" | wc -l
echo "hreflang tags found (should be 15+)"

echo ""
echo "5. STRUCTURED DATA (JSON-LD)"
echo "---------------------------------------------"
curl -s -A "Googlebot" "https://boyvue.com/v/386768?lang=en" | grep -o '"@type":"[^"]*"' | head -3

echo ""
echo "6. OG META TAGS (Social Sharing)"
echo "---------------------------------------------"
curl -s -A "Googlebot" "https://boyvue.com/v/386768?lang=en" | grep -E "og:title|og:description|og:image" | head -3

echo ""
echo "7. CANONICAL URL"
echo "---------------------------------------------"
curl -s -A "Googlebot" "https://boyvue.com/v/386768?lang=en" | grep "canonical"

echo ""
echo "8. ROBOTS META"
echo "---------------------------------------------"
curl -s -A "Googlebot" "https://boyvue.com/?lang=en" | grep "robots"

echo ""
echo "9. SITEMAPS CHECK"
echo "---------------------------------------------"
echo "Sitemap files:"
ls -la /var/www/html/boyvue/dist/*.xml 2>/dev/null | awk '{print $NF}' || echo "No sitemaps yet"

echo ""
echo "10. SEO DATABASE STATUS"
echo "---------------------------------------------"
PGPASSWORD=apple1apple psql -h localhost -U galleryuser -d gallery -t -c "SELECT 'seo_content: ' || COUNT(*) FROM seo_content;"
PGPASSWORD=apple1apple psql -h localhost -U galleryuser -d gallery -t -c "SELECT 'category_seo: ' || COUNT(*) FROM category_seo;"
PGPASSWORD=apple1apple psql -h localhost -U galleryuser -d gallery -t -c "SELECT 'translations_cache: ' || COUNT(*) FROM translations_cache;"

echo ""
echo "11. SEO GENERATION PROGRESS"
echo "---------------------------------------------"
tail -3 /tmp/seo-gen.log 2>/dev/null || echo "No generation log"

echo ""
echo "============================================="
echo "        GOOGLE SEARCH CONSOLE TESTS"
echo "============================================="
echo ""
echo "Test these URLs in Google Search Console URL Inspection:"
echo "  - https://boyvue.com/"
echo "  - https://boyvue.com/?lang=de"
echo "  - https://boyvue.com/v/386768"
echo "  - https://boyvue.com/c/501"
echo ""
echo "Or use: https://search.google.com/test/rich-results"
echo "        https://developers.facebook.com/tools/debug/"
echo ""
