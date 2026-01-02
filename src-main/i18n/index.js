import { initI18n, languages } from '../../shared/i18n';

// Site-specific translations (merged with shared)
const siteTranslations = {
  en: {
    nav: {
      home: 'Home',
      pics: 'Pics',
      videos: 'Videos',
      adult: 'Adult',
      fans: 'Fans',
      admin: 'Admin'
    },
    home: {
      title: 'BoyVue Network',
      subtitle: 'Your gateway to premium gay content',
      explore: 'Explore',
    },
    seo: {
      homeTitle: 'BoyVue - Premium Gay Content Network',
      homeDesc: 'Discover the best in gay entertainment across pics, videos, and live streams.',
    }
  },
  es: {
    nav: {
      home: 'Inicio',
      pics: 'Fotos',
      videos: 'Videos',
      adult: 'Adulto',
      fans: 'Fans',
      admin: 'Admin'
    },
    home: {
      title: 'Red BoyVue',
      subtitle: 'Tu portal de contenido gay premium',
      explore: 'Explorar',
    }
  },
  de: {
    nav: {
      home: 'Startseite',
      pics: 'Bilder',
      videos: 'Videos',
      adult: 'Erwachsene',
      fans: 'Fans',
      admin: 'Admin'
    },
    home: {
      title: 'BoyVue Netzwerk',
      subtitle: 'Dein Portal für Premium Gay-Inhalte',
      explore: 'Entdecken',
    }
  },
  fr: {
    nav: {
      home: 'Accueil',
      pics: 'Photos',
      videos: 'Vidéos',
      adult: 'Adulte',
      fans: 'Fans',
      admin: 'Admin'
    },
    home: {
      title: 'Réseau BoyVue',
      subtitle: 'Votre portail de contenu gay premium',
      explore: 'Explorer',
    }
  }
};

const i18n = initI18n(siteTranslations);

export { languages };
export default i18n;
