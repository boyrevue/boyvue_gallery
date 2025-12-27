import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeConfig } from './services/config-service.js';
import router from './api/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function bootstrap() {
  console.log('Starting Gallery Platform...');

  const configPaths = [
    path.join(__dirname, '../ontology/gallery-core.ttl'),
    path.join(__dirname, '../config/app.ttl'),
    path.join(__dirname, '../config/i18n.ttl'),
    path.join(__dirname, '../config/streaming-platforms.ttl'),
    path.join(__dirname, '../config/seo.ttl')
  ];

  try {
    await initializeConfig(configPaths);
    console.log('Configuration loaded');
  } catch(e) {
    console.log('Config warning:', e.message);
  }

  const app = express();
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', router);

  // Health check
  app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  // Serve React frontend from dist
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  
  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const port = process.env.PORT || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}

bootstrap().catch(console.error);
