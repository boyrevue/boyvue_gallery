// Create a simple social share default image
import fs from 'fs';

// Check if logo exists, if not create a placeholder
const logoPath = '/var/www/html/bp/data/logo-social.jpg';
if (!fs.existsSync(logoPath)) {
  console.log('Note: Create a 1200x630 social share image at:', logoPath);
}
