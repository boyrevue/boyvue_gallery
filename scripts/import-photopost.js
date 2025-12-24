#!/usr/bin/env node
/**
 * PhotoPost Import Script
 * Imports data from PHP PhotoPost using TTL mapping configuration
 * 
 * Usage: 
 *   node scripts/import-photopost.js --validate
 *   node scripts/import-photopost.js --import
 *   node scripts/import-photopost.js --media-only --source /path/to/photopost/data
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createImportService } from '../src/services/import-service.js';
import { getDatabaseService } from '../src/services/database-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  const validate = args.includes('--validate');
  const importData = args.includes('--import');
  const mediaOnly = args.includes('--media-only');
  
  const sourceIndex = args.indexOf('--source');
  const sourcePath = sourceIndex >= 0 ? args[sourceIndex + 1] : null;

  console.log('📸 PhotoPost Import Tool');
  console.log('========================');
  console.log('');

  // Load import mappings from TTL
  const mappingPath = path.join(__dirname, '../config/photopost-import.ttl');
  console.log(`📚 Loading import mappings from: ${mappingPath}`);

  const importService = await createImportService(mappingPath);

  console.log(`✅ Loaded ${importService.tableMappings.size} table mappings`);
  console.log('');

  // Display table mappings
  console.log('📋 Table Mappings:');
  for (const [sourceTable, mapping] of importService.tableMappings) {
    console.log(`   ${sourceTable} → ${mapping.targetClass}`);
    console.log(`      Fields: ${mapping.fields.length}, Priority: ${mapping.priority}`);
  }
  console.log('');

  // Connect to source database
  console.log('🔌 Connecting to source PhotoPost database...');
  await importService.connectSource({
    host: process.env.PP_DB_HOST || 'localhost',
    port: parseInt(process.env.PP_DB_PORT || '3306', 10),
    database: process.env.PP_DB_NAME || 'photopost',
    user: process.env.PP_DB_USER || 'root',
    password: process.env.PP_DB_PASSWORD || ''
  });
  console.log('✅ Connected to source database');

  // Initialize target database
  const ontologyPath = path.join(__dirname, '../ontology/gallery-core.ttl');
  const dbService = await getDatabaseService(ontologyPath);
  await dbService.connect({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'gallery',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
  });
  console.log('✅ Connected to target database');
  console.log('');

  // Validate
  if (validate) {
    console.log('🔍 Validating import configuration...');
    const validation = await importService.validateImport();
    
    if (validation.valid) {
      console.log('\n✅ Validation passed! Ready to import.');
    } else {
      console.log('\n❌ Validation failed:');
      for (const issue of validation.issues) {
        console.log(`   - ${issue}`);
      }
      process.exit(1);
    }
  }

  // Import data
  if (importData) {
    console.log('🚀 Starting data import...');
    const startTime = Date.now();
    
    const stats = await importService.runImport({
      batchSize: parseInt(process.env.IMPORT_BATCH_SIZE || '1000', 10)
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n📊 Import Statistics:');
    console.log(`   Duration: ${duration}s`);
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Succeeded: ${stats.succeeded}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Skipped: ${stats.skipped}`);
  }

  // Import media files
  if (mediaOnly && sourcePath) {
    console.log(`📁 Importing media files from: ${sourcePath}`);
    
    const targetPath = path.join(__dirname, '../media');
    const mediaStats = await importService.importMedia(sourcePath, targetPath, {
      convertToWebp: importService.migrationConfig.convertToWebp,
      generateThumbnails: importService.migrationConfig.generateThumbnails
    });

    console.log('\n📊 Media Import Statistics:');
    console.log(`   Copied: ${mediaStats.copied}`);
    console.log(`   Failed: ${mediaStats.failed}`);
  }

  // Cleanup
  await importService.close();
  await dbService.close();

  console.log('\n✅ Import process completed!');
}

// Print help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
PhotoPost Import Tool
=====================

Imports data from PHP PhotoPost galleries into GalleryX.
All mappings are defined in config/photopost-import.ttl

Usage:
  node scripts/import-photopost.js [options]

Options:
  --validate       Validate source database and mappings without importing
  --import         Run full data import
  --media-only     Import only media files (requires --source)
  --source PATH    Path to PhotoPost media directory

Environment Variables:
  PP_DB_HOST       Source PhotoPost MySQL host (default: localhost)
  PP_DB_PORT       Source PhotoPost MySQL port (default: 3306)
  PP_DB_NAME       Source PhotoPost database name (default: photopost)
  PP_DB_USER       Source PhotoPost database user (default: root)
  PP_DB_PASSWORD   Source PhotoPost database password

  DB_HOST          Target PostgreSQL host (default: localhost)
  DB_PORT          Target PostgreSQL port (default: 5432)
  DB_NAME          Target database name (default: gallery)
  DB_USER          Target database user (default: postgres)
  DB_PASSWORD      Target database password

  IMPORT_BATCH_SIZE  Records per batch (default: 1000)

Examples:
  # Validate configuration
  node scripts/import-photopost.js --validate

  # Run full import
  node scripts/import-photopost.js --import

  # Import media files with WebP conversion
  node scripts/import-photopost.js --media-only --source /var/www/photopost/data
`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Import failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
