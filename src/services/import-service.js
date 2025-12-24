/**
 * PhotoPost Import Service
 * Imports data from PHP PhotoPost using TTL mapping configuration
 * All field mappings and transforms defined in TTL golden source
 */

import { loadTTL, NAMESPACES } from '../utils/ttl-parser.js';
import { getDatabaseService } from './database-service.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Transform functions registry
 */
const TRANSFORMS = {
  toString: (value) => String(value || ''),
  
  toInteger: (value) => parseInt(value, 10) || 0,
  
  toFloat: (value) => parseFloat(value) || 0,
  
  intToBoolean: (value) => value === 1 || value === '1' || value === true,
  
  unixTimestampToDateTime: (value) => {
    if (!value) return null;
    return new Date(parseInt(value, 10) * 1000).toISOString();
  },
  
  normalizeRating: (value, config) => {
    // Convert from old scale (e.g., 10-point) to new scale (5-point)
    const oldMax = config?.oldMax || 10;
    const newMax = config?.newMax || 5;
    return Math.round((parseFloat(value) / oldMax) * newMax * 10) / 10;
  },
  
  buildImagePath: (value, context) => {
    const { basePath, category } = context;
    return path.join(basePath || '/media/images', category || '', value);
  },
  
  buildThumbnailPath: (value, context) => {
    const { basePath, size } = context;
    const ext = path.extname(value);
    const name = path.basename(value, ext);
    return path.join(basePath || '/media/thumbs', size || 'medium', `${name}${ext}`);
  },
  
  sanitizeHtml: (value) => {
    if (!value) return '';
    return String(value)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  },
  
  splitKeywordsToTags: (value, config) => {
    if (!value) return [];
    const separator = config?.separator || ',';
    return value.split(separator)
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
  },
  
  generateSlug: (value) => {
    if (!value) return '';
    return String(value)
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  },
  
  extractDimensions: (value) => {
    if (!value) return { width: 0, height: 0 };
    const match = value.match(/(\d+)x(\d+)/);
    if (match) {
      return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
    }
    return { width: 0, height: 0 };
  }
};

/**
 * PhotoPost Import Service Class
 */
class PhotoPostImportService {
  constructor() {
    this.mappingGraph = null;
    this.tableMappings = new Map();
    this.fieldMappings = new Map();
    this.migrationConfig = null;
    this.stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Initialize from TTL mapping configuration
   */
  async initialize(mappingPath) {
    this.mappingGraph = await loadTTL(mappingPath);
    this.extractMappings();
    return this;
  }

  /**
   * Extract mappings from TTL graph
   */
  extractMappings() {
    const graph = this.mappingGraph;
    const mapNs = 'http://gallery.example.org/mapping#';
    const ppNs = 'http://gallery.example.org/photopost#';

    // Extract table mappings
    const tableMappingSubjects = graph.getSubjectsOfType(`${mapNs}TableMapping`);
    
    for (const subject of tableMappingSubjects) {
      const sourceTable = graph.getValue(subject, `${mapNs}sourceTable`);
      const targetClass = graph.getValue(subject, `${mapNs}targetClass`);
      const priority = graph.getValue(subject, `${mapNs}priority`) || 0;
      
      if (sourceTable && targetClass) {
        this.tableMappings.set(sourceTable, {
          uri: subject,
          sourceTable,
          targetClass,
          priority: parseInt(priority, 10),
          fields: []
        });
      }
    }

    // Extract field mappings
    const fieldMappingSubjects = graph.getSubjectsOfType(`${mapNs}FieldMapping`);
    
    for (const subject of fieldMappingSubjects) {
      const sourceField = graph.getValue(subject, `${mapNs}sourceField`);
      const targetProperty = graph.getValue(subject, `${mapNs}targetProperty`);
      const transform = graph.getValue(subject, `${mapNs}transform`);
      const required = graph.getValue(subject, `${mapNs}required`) === 'true';
      const defaultValue = graph.getValue(subject, `${mapNs}defaultValue`);

      // Find parent table mapping
      const parentTable = graph.getValue(subject, `${mapNs}belongsToTable`);
      
      const mapping = {
        uri: subject,
        sourceField,
        targetProperty,
        transform: transform ? this.extractLocalName(transform) : null,
        required,
        defaultValue
      };

      if (parentTable && this.tableMappings.has(parentTable)) {
        this.tableMappings.get(parentTable).fields.push(mapping);
      }
    }

    // Extract migration configuration
    const configSubject = `${mapNs}MigrationConfig`;
    this.migrationConfig = {
      batchSize: parseInt(graph.getValue(configSubject, `${mapNs}batchSize`) || '1000', 10),
      parallelWorkers: parseInt(graph.getValue(configSubject, `${mapNs}parallelWorkers`) || '4', 10),
      copyMedia: graph.getValue(configSubject, `${mapNs}copyMedia`) === 'true',
      generateThumbnails: graph.getValue(configSubject, `${mapNs}generateThumbnails`) === 'true',
      convertToWebp: graph.getValue(configSubject, `${mapNs}convertToWebp`) === 'true'
    };
  }

  /**
   * Connect to source PhotoPost database
   */
  async connectSource(config) {
    // Using mysql2 for PhotoPost MySQL database
    const mysql = await import('mysql2/promise');
    this.sourcePool = await mysql.createPool({
      host: config.host,
      port: config.port || 3306,
      database: config.database,
      user: config.user,
      password: config.password,
      waitForConnections: true,
      connectionLimit: 10
    });
    return this;
  }

  /**
   * Run full import
   */
  async runImport(options = {}) {
    const dbService = await getDatabaseService();
    
    console.log('Starting PhotoPost import...');
    this.resetStats();

    // Sort table mappings by priority
    const sortedMappings = [...this.tableMappings.values()]
      .sort((a, b) => a.priority - b.priority);

    for (const tableMapping of sortedMappings) {
      console.log(`\nImporting ${tableMapping.sourceTable}...`);
      await this.importTable(tableMapping, dbService, options);
    }

    console.log('\n=== Import Complete ===');
    console.log(`Processed: ${this.stats.processed}`);
    console.log(`Succeeded: ${this.stats.succeeded}`);
    console.log(`Failed: ${this.stats.failed}`);
    console.log(`Skipped: ${this.stats.skipped}`);

    return this.stats;
  }

  /**
   * Import single table
   */
  async importTable(tableMapping, dbService, options) {
    const batchSize = options.batchSize || this.migrationConfig.batchSize;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch from source
      const [rows] = await this.sourcePool.query(
        `SELECT * FROM ${tableMapping.sourceTable} LIMIT ? OFFSET ?`,
        [batchSize, offset]
      );

      if (rows.length === 0) {
        hasMore = false;
        continue;
      }

      // Process batch
      for (const row of rows) {
        try {
          const transformed = await this.transformRow(row, tableMapping);
          
          if (transformed) {
            const targetTable = this.toSnakeCase(this.extractLocalName(tableMapping.targetClass));
            await dbService.insert(targetTable, transformed);
            this.stats.succeeded++;
          } else {
            this.stats.skipped++;
          }
        } catch (error) {
          console.error(`Failed to import row:`, error.message);
          this.stats.failed++;
        }
        
        this.stats.processed++;
      }

      offset += batchSize;
      console.log(`  Processed ${offset} records...`);
    }
  }

  /**
   * Transform row according to field mappings
   */
  async transformRow(sourceRow, tableMapping) {
    const result = {};
    const context = { sourceRow };

    for (const fieldMapping of tableMapping.fields) {
      const sourceValue = sourceRow[fieldMapping.sourceField];
      
      // Check required fields
      if (fieldMapping.required && (sourceValue === null || sourceValue === undefined)) {
        if (fieldMapping.defaultValue !== undefined) {
          result[this.extractPropertyName(fieldMapping.targetProperty)] = fieldMapping.defaultValue;
        } else {
          console.warn(`Required field missing: ${fieldMapping.sourceField}`);
          return null;
        }
        continue;
      }

      // Apply transform
      let transformedValue = sourceValue;
      
      if (fieldMapping.transform && TRANSFORMS[fieldMapping.transform]) {
        try {
          transformedValue = TRANSFORMS[fieldMapping.transform](sourceValue, context);
        } catch (error) {
          console.warn(`Transform failed for ${fieldMapping.sourceField}:`, error.message);
          transformedValue = fieldMapping.defaultValue;
        }
      }

      // Set target property
      const targetName = this.extractPropertyName(fieldMapping.targetProperty);
      result[targetName] = transformedValue;
    }

    // Add import metadata
    result.imported_from = tableMapping.sourceTable;
    result.original_id = sourceRow.id || sourceRow.photo_id || sourceRow.cat_id;
    result.migration_date = new Date().toISOString();

    return result;
  }

  /**
   * Import media files
   */
  async importMedia(sourcePath, targetPath, options = {}) {
    console.log(`Importing media from ${sourcePath} to ${targetPath}...`);
    
    const files = await this.scanDirectory(sourcePath);
    let copied = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const relativePath = path.relative(sourcePath, file);
        const targetFile = path.join(targetPath, relativePath);
        
        // Ensure target directory exists
        await fs.mkdir(path.dirname(targetFile), { recursive: true });
        
        // Copy file
        await fs.copyFile(file, targetFile);
        
        // Convert to WebP if enabled
        if (options.convertToWebp && this.isImage(file)) {
          await this.convertToWebp(targetFile);
        }
        
        copied++;
      } catch (error) {
        console.error(`Failed to copy ${file}:`, error.message);
        failed++;
      }
    }

    console.log(`Media import complete: ${copied} copied, ${failed} failed`);
    return { copied, failed };
  }

  /**
   * Scan directory recursively
   */
  async scanDirectory(dirPath) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...await this.scanDirectory(fullPath));
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning ${dirPath}:`, error.message);
    }
    
    return files;
  }

  /**
   * Check if file is an image
   */
  isImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  }

  /**
   * Convert image to WebP format
   */
  async convertToWebp(imagePath) {
    // Would use sharp or similar library
    // Placeholder for implementation
    const sharp = await import('sharp');
    const webpPath = imagePath.replace(/\.[^.]+$/, '.webp');
    
    await sharp(imagePath)
      .webp({ quality: 85 })
      .toFile(webpPath);
    
    return webpPath;
  }

  /**
   * Generate thumbnails for an image
   */
  async generateThumbnails(imagePath, sizes) {
    const sharp = await import('sharp');
    const results = {};
    
    for (const size of sizes) {
      const thumbPath = this.getThumbnailPath(imagePath, size.name);
      
      await fs.mkdir(path.dirname(thumbPath), { recursive: true });
      
      await sharp(imagePath)
        .resize(size.width, size.height, { fit: size.fit || 'inside' })
        .webp({ quality: 85 })
        .toFile(thumbPath);
      
      results[size.name] = thumbPath;
    }
    
    return results;
  }

  /**
   * Get thumbnail path for a size
   */
  getThumbnailPath(imagePath, sizeName) {
    const dir = path.dirname(imagePath);
    const ext = path.extname(imagePath);
    const name = path.basename(imagePath, ext);
    return path.join(dir, 'thumbs', sizeName, `${name}.webp`);
  }

  /**
   * Validate import before running
   */
  async validateImport() {
    const issues = [];

    // Check source connection
    try {
      await this.sourcePool.query('SELECT 1');
    } catch (error) {
      issues.push(`Source database connection failed: ${error.message}`);
    }

    // Check table mappings
    for (const [sourceTable, mapping] of this.tableMappings) {
      try {
        const [rows] = await this.sourcePool.query(
          `SELECT COUNT(*) as count FROM ${sourceTable}`
        );
        console.log(`${sourceTable}: ${rows[0].count} records`);
      } catch (error) {
        issues.push(`Cannot access source table ${sourceTable}: ${error.message}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Reset import statistics
   */
  resetStats() {
    this.stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Extract local name from URI
   */
  extractLocalName(uri) {
    if (!uri) return '';
    const hashIndex = uri.lastIndexOf('#');
    const slashIndex = uri.lastIndexOf('/');
    const index = Math.max(hashIndex, slashIndex);
    return index >= 0 ? uri.substring(index + 1) : uri;
  }

  /**
   * Extract property name from URI and convert to snake_case
   */
  extractPropertyName(uri) {
    return this.toSnakeCase(this.extractLocalName(uri));
  }

  /**
   * Convert to snake_case
   */
  toSnakeCase(str) {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/-/g, '_');
  }

  /**
   * Close connections
   */
  async close() {
    if (this.sourcePool) {
      await this.sourcePool.end();
    }
  }
}

// Factory function
export async function createImportService(mappingPath) {
  const service = new PhotoPostImportService();
  await service.initialize(mappingPath);
  return service;
}

export { PhotoPostImportService, TRANSFORMS };
export default { createImportService, PhotoPostImportService, TRANSFORMS };
