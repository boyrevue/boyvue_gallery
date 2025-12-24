/**
 * TTL (Turtle/RDF) Parser Utility
 * Parses Turtle format files and provides typed access to triples
 * Golden Source: All configuration is derived from TTL files
 */

// Namespace definitions from our ontology
const NAMESPACES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  dcterms: 'http://purl.org/dc/terms/',
  schema: 'http://schema.org/',
  foaf: 'http://xmlns.com/foaf/0.1/',
  gal: 'http://gallery.example.org/ontology#',
  galm: 'http://gallery.example.org/media#',
  galu: 'http://gallery.example.org/user#',
  galc: 'http://gallery.example.org/content#',
  gals: 'http://gallery.example.org/streaming#',
  gali: 'http://gallery.example.org/import#',
  gali18n: 'http://gallery.example.org/i18n#',
  galcfg: 'http://gallery.example.org/config#',
  galseo: 'http://gallery.example.org/seo#',
  galmap: 'http://gallery.example.org/mapping#',
  galapp: 'http://gallery.example.org/app#',
  pp: 'http://gallery.example.org/photopost#'
};

/**
 * Triple representation
 */
class Triple {
  constructor(subject, predicate, object, lang = null, datatype = null) {
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
    this.lang = lang;
    this.datatype = datatype;
  }
}

/**
 * RDF Graph storage and query
 */
class RDFGraph {
  constructor() {
    this.triples = [];
    this.prefixes = { ...NAMESPACES };
    this.subjects = new Map();
    this.predicates = new Map();
    this.objects = new Map();
  }

  addTriple(triple) {
    this.triples.push(triple);
    
    // Index by subject
    if (!this.subjects.has(triple.subject)) {
      this.subjects.set(triple.subject, []);
    }
    this.subjects.get(triple.subject).push(triple);
    
    // Index by predicate
    if (!this.predicates.has(triple.predicate)) {
      this.predicates.set(triple.predicate, []);
    }
    this.predicates.get(triple.predicate).push(triple);
    
    // Index by object
    if (!this.objects.has(triple.object)) {
      this.objects.set(triple.object, []);
    }
    this.objects.get(triple.object).push(triple);
  }

  /**
   * Query triples matching pattern
   */
  match(subject = null, predicate = null, object = null) {
    let results = this.triples;
    
    if (subject) {
      results = results.filter(t => t.subject === subject);
    }
    if (predicate) {
      results = results.filter(t => t.predicate === predicate);
    }
    if (object) {
      results = results.filter(t => t.object === object);
    }
    
    return results;
  }

  /**
   * Get all objects for a subject and predicate
   */
  getObjects(subject, predicate) {
    return this.match(subject, predicate).map(t => ({
      value: t.object,
      lang: t.lang,
      datatype: t.datatype
    }));
  }

  /**
   * Get single object value
   */
  getValue(subject, predicate, lang = null) {
    const objects = this.getObjects(subject, predicate);
    
    if (lang) {
      const langMatch = objects.find(o => o.lang === lang);
      if (langMatch) return langMatch.value;
    }
    
    return objects[0]?.value || null;
  }

  /**
   * Get all values for a predicate with language tags
   */
  getMultilingualValues(subject, predicate) {
    const objects = this.getObjects(subject, predicate);
    const result = {};
    
    for (const obj of objects) {
      if (obj.lang) {
        result[obj.lang] = obj.value;
      } else {
        result['default'] = obj.value;
      }
    }
    
    return result;
  }

  /**
   * Get all subjects of a given type
   */
  getSubjectsOfType(type) {
    const typeTriples = this.match(null, `${NAMESPACES.rdf}type`, type);
    return typeTriples.map(t => t.subject);
  }

  /**
   * Get all properties of a subject as an object
   */
  getResource(subject) {
    const triples = this.subjects.get(subject) || [];
    const resource = { '@id': subject };
    
    for (const triple of triples) {
      const predicate = this.shortenIRI(triple.predicate);
      
      if (resource[predicate]) {
        // Convert to array if multiple values
        if (!Array.isArray(resource[predicate])) {
          resource[predicate] = [resource[predicate]];
        }
        resource[predicate].push(this.formatValue(triple));
      } else {
        resource[predicate] = this.formatValue(triple);
      }
    }
    
    return resource;
  }

  formatValue(triple) {
    if (triple.lang) {
      return { '@value': triple.object, '@language': triple.lang };
    }
    if (triple.datatype) {
      return this.castValue(triple.object, triple.datatype);
    }
    return triple.object;
  }

  castValue(value, datatype) {
    switch (datatype) {
      case `${NAMESPACES.xsd}integer`:
        return parseInt(value, 10);
      case `${NAMESPACES.xsd}decimal`:
      case `${NAMESPACES.xsd}float`:
      case `${NAMESPACES.xsd}double`:
        return parseFloat(value);
      case `${NAMESPACES.xsd}boolean`:
        return value === 'true';
      case `${NAMESPACES.xsd}dateTime`:
        return new Date(value);
      default:
        return value;
    }
  }

  shortenIRI(iri) {
    for (const [prefix, namespace] of Object.entries(this.prefixes)) {
      if (iri.startsWith(namespace)) {
        return `${prefix}:${iri.slice(namespace.length)}`;
      }
    }
    return iri;
  }

  expandIRI(prefixed) {
    if (prefixed.startsWith('<') && prefixed.endsWith('>')) {
      return prefixed.slice(1, -1);
    }
    
    const colonIndex = prefixed.indexOf(':');
    if (colonIndex > 0) {
      const prefix = prefixed.slice(0, colonIndex);
      const local = prefixed.slice(colonIndex + 1);
      if (this.prefixes[prefix]) {
        return `${this.prefixes[prefix]}${local}`;
      }
    }
    
    return prefixed;
  }
}

/**
 * TTL Parser
 */
class TTLParser {
  constructor() {
    this.graph = new RDFGraph();
    this.currentSubject = null;
    this.currentPredicate = null;
  }

  parse(ttlContent) {
    // Remove comments
    const lines = ttlContent.split('\n')
      .map(line => {
        const hashIndex = line.indexOf('#');
        // Don't remove # inside strings or URIs
        if (hashIndex > 0) {
          let inString = false;
          let inUri = false;
          for (let i = 0; i < hashIndex; i++) {
            if (line[i] === '"' && line[i-1] !== '\\') inString = !inString;
            if (line[i] === '<') inUri = true;
            if (line[i] === '>') inUri = false;
          }
          if (!inString && !inUri) {
            return line.slice(0, hashIndex);
          }
        }
        return line;
      })
      .join('\n');

    // Parse prefixes
    this.parsePrefixes(lines);
    
    // Parse statements
    this.parseStatements(lines);
    
    return this.graph;
  }

  parsePrefixes(content) {
    const prefixRegex = /@prefix\s+(\w*):?\s*<([^>]+)>\s*\./g;
    let match;
    
    while ((match = prefixRegex.exec(content)) !== null) {
      const [, prefix, namespace] = match;
      this.graph.prefixes[prefix || '_'] = namespace;
    }
  }

  parseStatements(content) {
    // Tokenize
    const tokens = this.tokenize(content);
    
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      
      // Skip prefix declarations
      if (token === '@prefix' || token === '@base') {
        while (i < tokens.length && tokens[i] !== '.') i++;
        i++;
        continue;
      }
      
      // Subject
      if (this.isSubject(token)) {
        this.currentSubject = this.graph.expandIRI(token);
        i++;
        
        // Predicate-object pairs
        while (i < tokens.length) {
          const pred = tokens[i];
          
          if (pred === '.') {
            i++;
            break;
          }
          
          if (pred === ';') {
            i++;
            continue;
          }
          
          // Predicate
          this.currentPredicate = pred === 'a' 
            ? `${NAMESPACES.rdf}type`
            : this.graph.expandIRI(pred);
          i++;
          
          // Object(s)
          while (i < tokens.length) {
            const obj = tokens[i];
            
            if (obj === '.' || obj === ';') break;
            if (obj === ',') {
              i++;
              continue;
            }
            
            // Parse object
            const { value, lang, datatype, consumed } = this.parseObject(tokens, i);
            
            this.graph.addTriple(new Triple(
              this.currentSubject,
              this.currentPredicate,
              value,
              lang,
              datatype
            ));
            
            i += consumed;
          }
        }
      } else {
        i++;
      }
    }
  }

  tokenize(content) {
    const tokens = [];
    let i = 0;
    
    while (i < content.length) {
      // Skip whitespace
      while (i < content.length && /\s/.test(content[i])) i++;
      
      if (i >= content.length) break;
      
      const char = content[i];
      
      // String literals
      if (char === '"') {
        let str = '';
        i++;
        
        // Check for long string
        if (content.slice(i, i + 2) === '""') {
          i += 2;
          // Long string
          while (i < content.length) {
            if (content.slice(i, i + 3) === '"""') {
              i += 3;
              break;
            }
            str += content[i];
            i++;
          }
        } else {
          // Short string
          while (i < content.length && content[i] !== '"') {
            if (content[i] === '\\') {
              str += content[i + 1];
              i += 2;
            } else {
              str += content[i];
              i++;
            }
          }
          i++; // Skip closing quote
        }
        
        tokens.push(`"${str}"`);
        continue;
      }
      
      // URIs
      if (char === '<') {
        let uri = '';
        i++;
        while (i < content.length && content[i] !== '>') {
          uri += content[i];
          i++;
        }
        i++; // Skip >
        tokens.push(`<${uri}>`);
        continue;
      }
      
      // Punctuation
      if (['.', ';', ',', '(', ')', '[', ']'].includes(char)) {
        tokens.push(char);
        i++;
        continue;
      }
      
      // Words/prefixed names
      let word = '';
      while (i < content.length && !/[\s\.\;\,\(\)\[\]<>"]/.test(content[i])) {
        word += content[i];
        i++;
      }
      
      if (word) {
        tokens.push(word);
      }
    }
    
    return tokens;
  }

  isSubject(token) {
    return token.startsWith('<') || 
           token.includes(':') || 
           token === '[';
  }

  parseObject(tokens, startIndex) {
    let i = startIndex;
    let value = tokens[i];
    let lang = null;
    let datatype = null;
    let consumed = 1;
    
    // String literal
    if (value.startsWith('"')) {
      value = value.slice(1, -1); // Remove quotes
      
      // Check for language tag or datatype
      if (i + 1 < tokens.length) {
        const next = tokens[i + 1];
        
        if (next.startsWith('@')) {
          lang = next.slice(1);
          consumed = 2;
        } else if (next === '^^') {
          datatype = this.graph.expandIRI(tokens[i + 2]);
          consumed = 3;
        }
      }
    } 
    // URI or prefixed name
    else if (value.startsWith('<') || value.includes(':')) {
      value = this.graph.expandIRI(value);
    }
    // Boolean
    else if (value === 'true' || value === 'false') {
      datatype = `${NAMESPACES.xsd}boolean`;
    }
    // Number
    else if (/^-?\d+(\.\d+)?$/.test(value)) {
      datatype = value.includes('.') 
        ? `${NAMESPACES.xsd}decimal`
        : `${NAMESPACES.xsd}integer`;
    }
    
    return { value, lang, datatype, consumed };
  }
}

/**
 * Parse TTL file content
 */
export function parseTTL(content) {
  const parser = new TTLParser();
  return parser.parse(content);
}

/**
 * Load and parse TTL from URL or file path
 */
export async function loadTTL(path) {
  const response = await fetch(path);
  const content = await response.text();
  return parseTTL(content);
}

/**
 * Merge multiple graphs
 */
export function mergeGraphs(...graphs) {
  const merged = new RDFGraph();
  
  for (const graph of graphs) {
    // Merge prefixes
    Object.assign(merged.prefixes, graph.prefixes);
    
    // Merge triples
    for (const triple of graph.triples) {
      merged.addTriple(triple);
    }
  }
  
  return merged;
}

export { RDFGraph, Triple, NAMESPACES };
export default { parseTTL, loadTTL, mergeGraphs, RDFGraph, Triple, NAMESPACES };
