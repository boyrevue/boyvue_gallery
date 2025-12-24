/**
 * Database Service
 * Generates database schema from ontology TTL and handles database operations
 * Schema is derived from RDF ontology - no hardcoded table definitions
 */

import { loadTTL, NAMESPACES } from '../utils/ttl-parser.js';

/**
 * OWL/RDF to SQL type mapping
 */
const XSD_TO_SQL = {
  [`${NAMESPACES.xsd}string`]: 'TEXT',
  [`${NAMESPACES.xsd}integer`]: 'INTEGER',
  [`${NAMESPACES.xsd}long`]: 'BIGINT',
  [`${NAMESPACES.xsd}decimal`]: 'DECIMAL',
  [`${NAMESPACES.xsd}float`]: 'REAL',
  [`${NAMESPACES.xsd}double`]: 'DOUBLE PRECISION',
  [`${NAMESPACES.xsd}boolean`]: 'BOOLEAN',
  [`${NAMESPACES.xsd}date`]: 'DATE',
  [`${NAMESPACES.xsd}dateTime`]: 'TIMESTAMP WITH TIME ZONE',
  [`${NAMESPACES.xsd}time`]: 'TIME',
  [`${NAMESPACES.xsd}anyURI`]: 'TEXT',
  [`${NAMESPACES.xsd}nonNegativeInteger`]: 'INTEGER CHECK (value >= 0)',
  [`${NAMESPACES.rdf}langString`]: 'JSONB', // Multilingual strings stored as JSON
  'default': 'TEXT'
};

/**
 * Database Service Class
 */
class DatabaseService {
  constructor() {
    this.ontologyGraph = null;
    this.schema = null;
    this.pool = null;
  }

  /**
   * Initialize from ontology TTL
   */
  async initialize(ontologyPath) {
    this.ontologyGraph = await loadTTL(ontologyPath);
    this.schema = this.generateSchema();
    return this;
  }

  /**
   * Connect to database
   */
  async connect(config) {
    // Using pg Pool (PostgreSQL)
    // In real implementation, import pg
    const { Pool } = await import('pg');
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.name,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      min: config.poolMin || 5,
      max: config.poolMax || 20,
      idleTimeoutMillis: config.idleTimeout || 30000
    });
    return this;
  }

  /**
   * Generate database schema from ontology
   */
  generateSchema() {
    const schema = {
      tables: [],
      indexes: [],
      constraints: [],
      enums: []
    };

    // Get all OWL classes
    const classes = this.ontologyGraph.getSubjectsOfType(`${NAMESPACES.owl}Class`);
    
    for (const classUri of classes) {
      const table = this.generateTableFromClass(classUri);
      if (table) {
        schema.tables.push(table);
        schema.indexes.push(...table.indexes);
        schema.constraints.push(...table.constraints);
      }
    }

    return schema;
  }

  /**
   * Generate table definition from OWL class
   */
  generateTableFromClass(classUri) {
    const graph = this.ontologyGraph;
    
    // Get class label for table name
    const label = graph.getValue(classUri, `${NAMESPACES.rdfs}label`) ||
                  this.extractLocalName(classUri);
    
    const tableName = this.toSnakeCase(label);
    
    // Get all properties for this class
    const properties = this.getPropertiesForClass(classUri);
    
    const columns = [
      // Standard ID column
      { name: 'id', type: 'UUID', primaryKey: true, default: 'gen_random_uuid()' },
      // Standard timestamps
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', default: 'NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE', default: 'NOW()' }
    ];

    const indexes = [];
    const constraints = [];
    const foreignKeys = [];

    for (const prop of properties) {
      const column = this.generateColumnFromProperty(prop, classUri);
      if (column) {
        columns.push(column);
        
        // Generate indexes based on property annotations
        if (prop.indexed) {
          indexes.push({
            table: tableName,
            column: column.name,
            type: prop.indexType || 'btree'
          });
        }
        
        // Handle foreign keys
        if (column.foreignKey) {
          foreignKeys.push(column.foreignKey);
        }
      }
    }

    // Add multilingual support columns if class has langString properties
    const hasMultilingual = columns.some(c => c.type === 'JSONB' && c.multilingual);
    
    return {
      name: tableName,
      classUri,
      columns,
      indexes,
      constraints,
      foreignKeys,
      hasMultilingual
    };
  }

  /**
   * Get all properties applicable to a class
   */
  getPropertiesForClass(classUri) {
    const graph = this.ontologyGraph;
    const properties = [];

    // Find all properties with this class as domain
    const allProperties = [
      ...graph.getSubjectsOfType(`${NAMESPACES.owl}DatatypeProperty`),
      ...graph.getSubjectsOfType(`${NAMESPACES.owl}ObjectProperty`)
    ];

    for (const propUri of allProperties) {
      const domain = graph.getValue(propUri, `${NAMESPACES.rdfs}domain`);
      
      // Check if property applies to this class or its superclasses
      if (domain === classUri || this.isSubClassOf(classUri, domain)) {
        const range = graph.getValue(propUri, `${NAMESPACES.rdfs}range`);
        const label = graph.getValue(propUri, `${NAMESPACES.rdfs}label`) ||
                      this.extractLocalName(propUri);
        const comment = graph.getValue(propUri, `${NAMESPACES.rdfs}comment`);
        
        // Check for indexing annotation
        const indexed = graph.getValue(propUri, `${NAMESPACES.gal}indexed`) === 'true';
        const required = graph.getValue(propUri, `${NAMESPACES.gal}required`) === 'true';
        
        properties.push({
          uri: propUri,
          name: label,
          range,
          comment,
          indexed,
          required,
          isObjectProperty: graph.match(propUri, `${NAMESPACES.rdf}type`, `${NAMESPACES.owl}ObjectProperty`).length > 0
        });
      }
    }

    return properties;
  }

  /**
   * Check if classUri is a subclass of superClassUri
   */
  isSubClassOf(classUri, superClassUri) {
    const graph = this.ontologyGraph;
    
    // Direct check
    const superClasses = graph.getObjects(classUri, `${NAMESPACES.rdfs}subClassOf`);
    
    for (const superClass of superClasses) {
      if (superClass.value === superClassUri) {
        return true;
      }
      // Recursive check
      if (this.isSubClassOf(superClass.value, superClassUri)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate column definition from property
   */
  generateColumnFromProperty(prop, classUri) {
    const columnName = this.toSnakeCase(prop.name);
    
    // Determine SQL type from range
    let sqlType = XSD_TO_SQL[prop.range] || XSD_TO_SQL['default'];
    let foreignKey = null;
    let multilingual = false;

    // Handle object properties (foreign keys)
    if (prop.isObjectProperty) {
      const targetTable = this.toSnakeCase(this.extractLocalName(prop.range));
      sqlType = 'UUID';
      foreignKey = {
        column: columnName,
        references: {
          table: targetTable,
          column: 'id'
        }
      };
    }

    // Handle multilingual strings
    if (prop.range === `${NAMESPACES.rdf}langString`) {
      multilingual = true;
    }

    return {
      name: columnName,
      type: sqlType,
      nullable: !prop.required,
      comment: prop.comment,
      foreignKey,
      multilingual
    };
  }

  /**
   * Generate CREATE TABLE SQL
   */
  generateCreateTableSQL(table) {
    const columnDefs = table.columns.map(col => {
      let def = `  "${col.name}" ${col.type}`;
      if (col.primaryKey) def += ' PRIMARY KEY';
      if (!col.nullable && !col.primaryKey) def += ' NOT NULL';
      if (col.default) def += ` DEFAULT ${col.default}`;
      return def;
    }).join(',\n');

    const foreignKeyDefs = table.foreignKeys.map(fk => 
      `  FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references.table}"("${fk.references.column}")`
    ).join(',\n');

    let sql = `CREATE TABLE IF NOT EXISTS "${table.name}" (\n${columnDefs}`;
    
    if (foreignKeyDefs) {
      sql += `,\n${foreignKeyDefs}`;
    }
    
    sql += '\n);';

    // Add indexes
    for (const index of table.indexes) {
      sql += `\n\nCREATE INDEX IF NOT EXISTS "idx_${table.name}_${index.column}" ON "${table.name}" USING ${index.type} ("${index.column}");`;
    }

    // Add updated_at trigger
    sql += `\n\n-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_${table.name}_updated_at ON "${table.name}";
CREATE TRIGGER update_${table.name}_updated_at
    BEFORE UPDATE ON "${table.name}"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();`;

    return sql;
  }

  /**
   * Generate full migration SQL
   */
  generateMigrationSQL() {
    let sql = `-- Auto-generated from gallery-core.ttl ontology
-- Generated at: ${new Date().toISOString()}
-- DO NOT EDIT MANUALLY - Regenerate from ontology

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`;

    for (const table of this.schema.tables) {
      sql += `\n-- Table: ${table.name} (from ${table.classUri})\n`;
      sql += this.generateCreateTableSQL(table);
      sql += '\n\n';
    }

    sql += 'COMMIT;\n';

    return sql;
  }

  /**
   * Execute migration
   */
  async migrate() {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const sql = this.generateMigrationSQL();
    
    try {
      await this.pool.query(sql);
      console.log('Migration completed successfully');
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Generic query method
   */
  async query(sql, params = []) {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool.query(sql, params);
  }

  /**
   * Get record by ID
   */
  async findById(tableName, id) {
    const result = await this.query(
      `SELECT * FROM "${tableName}" WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find records with conditions
   */
  async find(tableName, conditions = {}, options = {}) {
    let sql = `SELECT * FROM "${tableName}"`;
    const params = [];
    let paramIndex = 1;

    // Build WHERE clause
    const whereClauses = [];
    for (const [key, value] of Object.entries(conditions)) {
      whereClauses.push(`"${key}" = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Add ORDER BY
    if (options.orderBy) {
      const direction = options.orderDirection || 'ASC';
      sql += ` ORDER BY "${options.orderBy}" ${direction}`;
    }

    // Add LIMIT and OFFSET
    if (options.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }

    if (options.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
      paramIndex++;
    }

    const result = await this.query(sql, params);
    return result.rows;
  }

  /**
   * Insert record
   */
  async insert(tableName, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const sql = `
      INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await this.query(sql, values);
    return result.rows[0];
  }

  /**
   * Update record
   */
  async update(tableName, id, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClauses = columns.map((col, i) => `"${col}" = $${i + 1}`);

    const sql = `
      UPDATE "${tableName}"
      SET ${setClauses.join(', ')}
      WHERE id = $${columns.length + 1}
      RETURNING *
    `;

    const result = await this.query(sql, [...values, id]);
    return result.rows[0];
  }

  /**
   * Delete record
   */
  async delete(tableName, id) {
    const result = await this.query(
      `DELETE FROM "${tableName}" WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Convert camelCase/PascalCase to snake_case
   */
  toSnakeCase(str) {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/-/g, '_');
  }

  /**
   * Extract local name from URI
   */
  extractLocalName(uri) {
    const hashIndex = uri.lastIndexOf('#');
    const slashIndex = uri.lastIndexOf('/');
    const index = Math.max(hashIndex, slashIndex);
    return index >= 0 ? uri.substring(index + 1) : uri;
  }

  /**
   * Close connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

// Singleton instance
let dbInstance = null;

/**
 * Get database service instance
 */
export async function getDatabaseService(ontologyPath) {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
    if (ontologyPath) {
      await dbInstance.initialize(ontologyPath);
    }
  }
  return dbInstance;
}

export { DatabaseService };
export default { getDatabaseService, DatabaseService };
