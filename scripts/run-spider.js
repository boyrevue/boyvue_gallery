#!/usr/bin/env node
/**
 * Spider Runner Script
 * Usage: node scripts/run-spider.js <platform> [options]
 *
 * Examples:
 *   node scripts/run-spider.js chaturbate
 *   node scripts/run-spider.js chaturbate --gender=m --limit=50
 *   node scripts/run-spider.js all
 */

import { ChaturbateSpider } from '../src/spiders/chaturbate-spider.js';
import BongaCamsSpider from '../src/spiders/bongacams-spider.js';
import StripchatSpider from '../src/spiders/stripchat-spider.js';

// Available spiders
const spiders = {
  chaturbate: ChaturbateSpider,
  bongacams: BongaCamsSpider,
  stripchat: StripchatSpider,
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    platform: null,
    gender: 'm',
    limit: 100,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value || true;
    } else if (!options.platform) {
      options.platform = arg.toLowerCase();
    }
  }

  return options;
}

// Show help
function showHelp() {
  console.log(`
Spider Runner - Fetch performers from affiliate platforms

Usage: node scripts/run-spider.js <platform> [options]

Platforms:
  chaturbate    Chaturbate cam site
  bongacams     BongaCams cam site
  stripchat     Stripchat cam site
  all           Run all configured spiders

Options:
  --gender=m    Gender filter: m (male), f (female), s (trans), c (couple)
  --limit=100   Maximum performers to fetch
  --help        Show this help message

Examples:
  node scripts/run-spider.js chaturbate
  node scripts/run-spider.js chaturbate --gender=m --limit=50
  node scripts/run-spider.js all
`);
}

// Run a single spider
async function runSpider(platform, options) {
  const SpiderClass = spiders[platform];
  if (!SpiderClass) {
    console.error(`Unknown platform: ${platform}`);
    console.error(`Available platforms: ${Object.keys(spiders).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running ${platform} spider...`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const spider = new SpiderClass(options);
    const stats = await spider.run(options);

    console.log(`\n${platform} spider completed successfully!`);
    return stats;
  } catch (err) {
    console.error(`\n${platform} spider failed:`, err.message);
    throw err;
  }
}

// Run all spiders
async function runAllSpiders(options) {
  const results = {};
  const platforms = Object.keys(spiders);

  console.log(`Running ${platforms.length} spiders...\n`);

  for (const platform of platforms) {
    try {
      results[platform] = await runSpider(platform, options);
    } catch (err) {
      results[platform] = { error: err.message };
    }

    // Delay between spiders
    if (platforms.indexOf(platform) < platforms.length - 1) {
      console.log('\nWaiting 5 seconds before next spider...\n');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  return results;
}

// Main
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.platform) {
    console.error('Error: Platform required');
    showHelp();
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('BoyVue Creatives - Spider Runner');
  console.log('='.repeat(60));
  console.log(`Platform: ${options.platform}`);
  console.log(`Options:`, JSON.stringify(options, null, 2));

  const startTime = Date.now();

  try {
    let results;

    if (options.platform === 'all') {
      results = await runAllSpiders(options);
    } else {
      results = await runSpider(options.platform, options);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Spider run complete in ${elapsed}s`);
    console.log('='.repeat(60));

    if (options.platform === 'all') {
      console.log('\nResults by platform:');
      for (const [platform, stats] of Object.entries(results)) {
        if (stats.error) {
          console.log(`  ${platform}: ERROR - ${stats.error}`);
        } else {
          console.log(`  ${platform}: ${stats.added} added, ${stats.updated} updated, ${stats.errors} errors`);
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('\nSpider run failed:', err.message);
    process.exit(1);
  }
}

main();
