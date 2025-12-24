#!/usr/bin/env node
/**
 * Database Migration Script
 * Generates and executes schema from gallery-core.ttl ontology
 * 
 * Usage: node scripts/migrate.js [--dry-run] [--output FILE]
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { getDatabaseService } from '../src/services/database-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const outputIndex = args.indexOf('--output');
  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : null;

  console.log('🗄️  Gallery Platform - Database Migration');
  console.log('=========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'EXECUTE'}`);
  console.log('');

  // Initialize database service from ontology
  const ontologyPath = path.join(__dirname, '../ontology/gallery-core.ttl');
  console.log(`📚 Loading ontology from: ${ontologyPath}`);

  const dbService = await getDatabaseService(ontologyPath);

  // Generate SQL
  console.log('⚙️  Generating schema from RDF ontology...');
  const sql = dbService.generateMigrationSQL();

  console.log(`\n📋 Generated ${dbService.schema.tables.length} tables:`);
  for (const table of dbService.schema.tables) {
    const colCount = table.columns.length;
    const fkCount = table.foreignKeys.length;
    console.log(`   - ${table.name}: ${colCount} columns, ${fkCount} foreign keys`);
  }

  // Output SQL if requested
  if (outputFile) {
    const outputPath = path.resolve(outputFile);
    await fs.writeFile(outputPath, sql);
    console.log(`\n💾 SQL written to: ${outputPath}`);
  }

  // Execute if not dry run
  if (!dryRun) {
    console.log('\n🔌 Connecting to database...');
    
    await dbService.connect({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      name: process.env.DB_NAME || 'gallery',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true'
    });

    console.log('🚀 Executing migration...');
    await dbService.migrate();

    console.log('\n✅ Migration completed successfully!');
    
    await dbService.close();
  } else {
    console.log('\n📄 Generated SQL:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    console.log('\n⚠️  DRY RUN - No changes were made to the database');
  }

  console.log('');
}

main().catch(err => {
  console.error('❌ Migration failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
