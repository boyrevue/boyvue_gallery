# GalleryX - TTL-Driven Gallery Platform

A multilingual image/video gallery platform with **TTL (Turtle/RDF) as the golden source** for all configuration, data models, and mappings.

## Architecture Principles

1. **TTL as Golden Source**: All configuration, translations, SEO settings, and data models are defined in TTL files
2. **No Hardcoding**: Application code reads everything from TTL - zero hardcoded values
3. **Ontology-Driven Schema**: Database schema is generated from `gallery-core.ttl` OWL ontology
4. **Multilingual First**: All text content supports 12+ languages via `rdf:langString`

## Directory Structure

```
gallery-platform/
├── ontology/
│   └── gallery-core.ttl      # Core RDF/OWL ontology (data model)
├── config/
│   ├── app.ttl               # Application configuration
│   ├── i18n.ttl              # Languages & translations (12 languages)
│   ├── streaming-platforms.ttl # Streaming platform configs
│   ├── seo.ttl               # SEO configuration
│   └── photopost-import.ttl  # PhotoPost migration mappings
├── src/
│   ├── server.js             # Main entry point
│   ├── api/                  # API routes
│   ├── services/
│   │   ├── config-service.js    # TTL configuration loader
│   │   ├── database-service.js  # Ontology-driven DB schema
│   │   ├── import-service.js    # PhotoPost migration
│   │   └── ...
│   ├── hooks/                # React hooks
│   ├── components/           # React components
│   └── pages/                # Page components
├── scripts/
│   ├── migrate.js            # Generate/run DB migration from TTL
│   └── import-photopost.js   # PhotoPost import tool
└── package.json
```

## TTL Files Explained

### `ontology/gallery-core.ttl`
Defines the complete data model using OWL/RDF:
- **Classes**: MediaItem, Image, Video, Gallery, Category, Tag, User, Creator, Comment, Rating, StreamingProfile
- **Properties**: All fields with XSD types, relationships, cardinality constraints
- **Indexes**: Annotations for database index generation

### `config/app.ttl`
Application configuration with environment variable interpolation:
```turtle
galapp:Application
    galapp:name "GalleryX" ;
    galapp:baseUrl "${SITE_URL}" ;
    galapp:environment "${NODE_ENV}" .
```

### `config/i18n.ttl`
Multilingual support with 12 languages:
```turtle
gali18n:NavHome
    a gali18n:TranslationKey ;
    gali18n:key "nav.home" ;
    gali18n:text "Home"@en, "Inicio"@es, "Accueil"@fr, "ホーム"@ja .
```

### `config/streaming-platforms.ttl`
Streaming platform configurations:
```turtle
galcfg:Chaturbate
    a gals:StreamingPlatform ;
    galcfg:platformId "chaturbate" ;
    galcfg:embedPattern "https://chaturbate.com/embed/{username}" ;
    galcfg:supportsEmbed true .
```

### `config/photopost-import.ttl`
PhotoPost MySQL → PostgreSQL migration mappings:
```turtle
galmap:PhotosMapping
    a galmap:TableMapping ;
    galmap:sourceTable "pp_photos" ;
    galmap:targetClass gal:Image ;
    galmap:priority 3 .

galmap:PhotoIdField
    a galmap:FieldMapping ;
    galmap:sourceField "photo_id" ;
    galmap:targetProperty gal:originalId ;
    galmap:transform galmap:toString .
```

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your settings

# Generate database schema from ontology (dry run)
npm run migrate -- --dry-run

# Run actual migration
npm run migrate

# Start development server
npm run dev
```

## PhotoPost Migration

```bash
# Validate source database
npm run import:photopost -- --validate

# Run full import
npm run import:photopost -- --import

# Import media files with WebP conversion
npm run import:photopost -- --media-only --source /path/to/photopost/data
```

## API Endpoints

All endpoints reflect the TTL ontology structure:

| Endpoint | Description |
|----------|-------------|
| `GET /api/config/languages` | Languages from i18n.ttl |
| `GET /api/config/translations/:lang` | Translations for language |
| `GET /api/config/streaming-platforms` | Streaming platforms |
| `GET /api/media` | Media items (gal:MediaItem) |
| `GET /api/galleries` | Galleries (gal:Gallery) |
| `GET /api/categories` | Categories (gal:Category) |
| `GET /api/creators/:username` | Creator profiles |
| `GET /api/streaming/live` | Live streams |
| `GET /api/search` | Full-text search |

## Adding New Configuration

1. Define in appropriate TTL file
2. Configuration is automatically loaded at startup
3. Access via `getConfigService()` methods

Example - adding a new streaming platform:
```turtle
galcfg:NewPlatform
    a gals:StreamingPlatform ;
    rdfs:label "New Platform" ;
    galcfg:platformId "newplatform" ;
    galcfg:baseUrl "https://newplatform.com" ;
    galcfg:embedPattern "https://newplatform.com/embed/{username}" ;
    galcfg:supportsEmbed true ;
    galcfg:adultContent true .
```

No code changes needed - just edit the TTL file and restart.

## Adding New Translations

Add to `config/i18n.ttl`:
```turtle
gali18n:NewKey
    a gali18n:TranslationKey ;
    gali18n:key "new.key" ;
    gali18n:text "English text"@en,
                 "Texto español"@es,
                 "Texte français"@fr .
```

Access in React:
```javascript
const { t } = useI18n();
t('new.key'); // Returns translated text
```

## Extending the Data Model

1. Add to `ontology/gallery-core.ttl`:
```turtle
gal:NewClass
    a owl:Class ;
    rdfs:label "NewClass" ;
    rdfs:subClassOf gal:MediaItem .

gal:newProperty
    a owl:DatatypeProperty ;
    rdfs:domain gal:NewClass ;
    rdfs:range xsd:string .
```

2. Regenerate schema:
```bash
npm run migrate
```

## License

MIT
