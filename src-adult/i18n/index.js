import { initI18n, languages } from '../../shared/i18n';

// Site-specific translations
const siteTranslations = {
  en: {
    nav: {
      home: 'Home',
      pics: 'Pics',
      videos: 'Videos',
      fans: 'Fans',
      admin: 'Admin'
    },
    home: {
      title: 'BoyVue Adult',
      subtitle: 'Premium adult gay content',
      featured: 'Featured',
      trending: 'Trending'
    },
    seo: {
      homeTitle: 'BoyVue Adult - Premium Gay Adult Content',
      homeDesc: 'Discover premium adult gay content. 18+ only.'
    }
  },
  es: {
    nav: {
      home: 'Inicio',
      pics: 'Fotos',
      videos: 'Videos',
      fans: 'Fans',
      admin: 'Admin'
    },
    home: {
      title: 'BoyVue Adulto',
      subtitle: 'Contenido gay premium para adultos',
      featured: 'Destacado',
      trending: 'Tendencias'
    }
  },
  de: {
    nav: {
      home: 'Startseite',
      pics: 'Bilder',
      videos: 'Videos',
      fans: 'Fans',
      admin: 'Admin'
    },
    home: {
      title: 'BoyVue Erwachsene',
      subtitle: 'Premium Erwachsenen Gay-Inhalte',
      featured: 'Empfohlen',
      trending: 'Beliebt'
    }
  },
  fr: {
    nav: {
      home: 'Accueil',
      pics: 'Photos',
      videos: 'Vidéos',
      fans: 'Fans',
      admin: 'Admin'
    },
    home: {
      title: 'BoyVue Adulte',
      subtitle: 'Contenu gay premium pour adultes',
      featured: 'En vedette',
      trending: 'Tendances'
    }
  }
};

const i18n = initI18n(siteTranslations);

export { languages };
export default i18n;
