cat > .env << 'EOF'
# Application
NODE_ENV=development
PORT=3000
SITE_URL=http://localhost:3000
SITE_NAME=GalleryX

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gallery
DB_USER=galleryuser
DB_PASSWORD=apple1apple
DB_SSL=false

# Redis Cache (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Storage
STORAGE_TYPE=local
CDN_URL=

# Authentication
JWT_SECRET=change-this-to-a-random-secret-key-12345

# Logging
LOG_LEVEL=info
DEBUG_MODE=true

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
sudo -u postgres psql << 'EOF'
CREATE DATABASE gallery;
CREATE USER galleryuser WITH ENCRYPTED PASSWORD 'apple1apple'
GRANT ALL PRIVILEGES ON DATABASE gallery TO galleryuser;
\c gallery
GRANT ALL ON SCHEMA public TO galleryuser;
GRANT CREATE ON SCHEMA public TO galleryuser;
EOFEO
