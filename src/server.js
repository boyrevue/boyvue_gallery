/**
 * Gallery Platform Server
 * Main entry point - all configuration derived from TTL golden source
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { initializeConfig, getConfigService } from './services/config-service.js';
import { getDatabaseService } from './services/database-service.js';
import { createApiRoutes } from './api/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Bootstrap application from TTL configuration
 */
async function bootstrap() {
  console.log('🚀 Starting Gallery Platform...');
  console.log('📚 Loading configuration from TTL golden source...');

  // Load all TTL configurations
  const configPaths = [
    path.join(__dirname, '../ontology/gallery-core.ttl'),
    path.join(__dirname, '../config/app.ttl'),
    path.join(__dirname, '../config/i18n.ttl'),
    path.join(__dirname, '../config/streaming-platforms.ttl'),
    path.join(__dirname, '../config/seo.ttl'),
    path.join(__dirname, '../config/photopost-import.ttl')
  ];

  await initializeConfig(configPaths);
  const config = getConfigService();
  const appConfig = config.getAppConfig();

  console.log(`✅ Configuration loaded: ${appConfig.name} v${appConfig.version}`);

  // Initialize database from ontology
  const dbService = await getDatabaseService(
    path.join(__dirname, '../ontology/gallery-core.ttl')
  );

  // Create Express app
  const app = express();

  // Get security configuration from TTL
  const seoConfig = config.getSEOConfig();

  // Middleware - configuration driven from TTL
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", process.env.CDN_URL || '', 'data:', 'blob:'],
        mediaSrc: ["'self'", process.env.CDN_URL || '', 'blob:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameSrc: [
          "'self'",
          ...config.getStreamingPlatforms().map(p => new URL(p.baseUrl).hostname)
        ]
      }
    }
  }));

  app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  }));

  app.use(compression());
  app.use(morgan('combined'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting from TTL config
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
  });
  app.use('/api/', limiter);

  // Serve static files
  app.use('/media', express.static(path.join(__dirname, '../media')));
  app.use(express.static(path.join(__dirname, '../dist')));

  // API Routes - dynamically generated from TTL
  const apiRoutes = await createApiRoutes(config, dbService);
  app.use('/api', apiRoutes);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      version: appConfig.version,
      timestamp: new Date().toISOString()
    });
  });

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message
    });
  });

  // Start server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`\n🌐 Server running on port ${port}`);
    console.log(`📝 API: http://localhost:${port}/api`);
    console.log(`🏠 App: http://localhost:${port}`);
    console.log(`💚 Health: http://localhost:${port}/health`);
    console.log('\n✨ Ready to serve requests!\n');
  });

  return app;
}

// Run
bootstrap().catch(err => {
  console.error('💥 Failed to start server:', err);
  process.exit(1);
});
