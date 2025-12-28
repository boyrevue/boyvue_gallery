#!/usr/bin/env node
/**
 * Weekly SEO Analysis Script
 * Run via cron: 0 6 * * 0 /usr/bin/node /var/www/html/boyvue/scripts/run-seo-analysis.js
 * (Runs every Sunday at 6 AM)
 */

import { runWeeklySEOAnalysis } from '../src/services/seo-analyzer.js';

console.log('Starting weekly SEO analysis...');
console.log(`Date: ${new Date().toISOString()}`);

runWeeklySEOAnalysis()
  .then(report => {
    console.log('SEO Analysis completed successfully');
    console.log('Summary:');
    console.log(`- Total searches analyzed: ${report.summary.totalSearches}`);
    console.log(`- Zero result queries: ${report.summary.zeroResultQueries}`);
    console.log(`- Content gaps identified: ${report.summary.contentGaps}`);
    console.log(`- SEO issues found: ${Object.values(report.summary.seoIssuesCount).reduce((a,b) => a+b, 0)}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('SEO Analysis failed:', err);
    process.exit(1);
  });
