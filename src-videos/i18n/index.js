import { initI18n, languages } from '../../shared/i18n';

// Site-specific translations
const siteTranslations = {
  en: {
    nav: {
      home: 'Home',
      studios: 'All Studios',
      categories: 'Categories',
      admin: 'Admin'
    },
    home: {
      title: 'BoyVue Videos',
      subtitle: 'Your guide to the best gay streaming sites',
      featured: 'Featured Studios',
      popular: 'Popular Categories'
    },
    studios: {
      title: 'All Studios',
      search: 'Search studios...',
      filters: 'Filters',
      viewSite: 'Visit Site'
    },
    categories: {
      title: 'Categories',
      viewAll: 'View All'
    },
    seo: {
      homeTitle: 'BoyVue Videos - Gay Streaming Site Reviews',
      homeDesc: 'Compare the best gay streaming sites. Reviews, pricing, and content guides.'
    }
  },
  es: {
    nav: {
      home: 'Inicio',
      studios: 'Todos los Estudios',
      categories: 'Categorías',
      admin: 'Admin'
    },
    home: {
      title: 'BoyVue Videos',
      subtitle: 'Tu guía de los mejores sitios de streaming gay',
      featured: 'Estudios Destacados',
      popular: 'Categorías Populares'
    }
  },
  de: {
    nav: {
      home: 'Startseite',
      studios: 'Alle Studios',
      categories: 'Kategorien',
      admin: 'Admin'
    },
    home: {
      title: 'BoyVue Videos',
      subtitle: 'Dein Guide für die besten Gay-Streaming-Seiten',
      featured: 'Empfohlene Studios',
      popular: 'Beliebte Kategorien'
    }
  },
  fr: {
    nav: {
      home: 'Accueil',
      studios: 'Tous les Studios',
      categories: 'Catégories',
      admin: 'Admin'
    },
    home: {
      title: 'BoyVue Vidéos',
      subtitle: 'Votre guide des meilleurs sites de streaming gay',
      featured: 'Studios en Vedette',
      popular: 'Catégories Populaires'
    }
  }
};

const i18n = initI18n(siteTranslations);

export { languages };
export default i18n;
