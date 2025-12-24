/**
 * GalleryX Application
 * Main application entry point
 * All configuration loaded from TTL golden source
 */

import React, { useEffect, useState } from 'react';
import { I18nProvider } from './hooks/useI18n.js';
import { ConfigProvider } from './hooks/useConfig.js';
import { initializeConfig, getConfigService } from './services/config-service.js';

// Components
import { GalleryGrid } from './components/GalleryGrid.jsx';
import { StreamingEmbed, PlatformBadge } from './hooks/useStreaming.js';

// Pages (lazy loaded)
const HomePage = React.lazy(() => import('./pages/HomePage.jsx'));
const GalleryPage = React.lazy(() => import('./pages/GalleryPage.jsx'));
const MediaPage = React.lazy(() => import('./pages/MediaPage.jsx'));
const CategoryPage = React.lazy(() => import('./pages/CategoryPage.jsx'));
const CreatorPage = React.lazy(() => import('./pages/CreatorPage.jsx'));
const SearchPage = React.lazy(() => import('./pages/SearchPage.jsx'));
const LivePage = React.lazy(() => import('./pages/LivePage.jsx'));

/**
 * Configuration paths - loaded from TTL files
 * These are the ONLY source of truth for all configuration
 */
const CONFIG_PATHS = [
  '/config/app.ttl',
  '/config/i18n.ttl',
  '/config/streaming-platforms.ttl',
  '/config/seo.ttl'
];

/**
 * App Component
 */
export function App() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  // Initialize configuration from TTL files
  useEffect(() => {
    async function init() {
      try {
        await initializeConfig(CONFIG_PATHS);
        setInitialized(true);
      } catch (err) {
        console.error('Failed to initialize configuration:', err);
        setError(err.message);
      }
    }

    init();
  }, []);

  // Show loading state
  if (!initialized && !error) {
    return <AppLoading />;
  }

  // Show error state
  if (error) {
    return <AppError error={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <ConfigProvider>
      <I18nProvider>
        <AppContent />
      </I18nProvider>
    </ConfigProvider>
  );
}

/**
 * App Content - Main routing and layout
 */
function AppContent() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Simple client-side routing
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigate function
  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Route matching
  const route = matchRoute(currentPath);

  return (
    <div className="app" dir="ltr">
      <AppHeader navigate={navigate} />
      
      <main className="app__main">
        <React.Suspense fallback={<PageLoading />}>
          <Router route={route} navigate={navigate} />
        </React.Suspense>
      </main>

      <AppFooter />
    </div>
  );
}

/**
 * Router Component
 */
function Router({ route, navigate }) {
  switch (route.page) {
    case 'home':
      return <HomePage navigate={navigate} />;
    case 'gallery':
      return <GalleryPage params={route.params} navigate={navigate} />;
    case 'media':
      return <MediaPage id={route.params.id} navigate={navigate} />;
    case 'category':
      return <CategoryPage slug={route.params.slug} navigate={navigate} />;
    case 'creator':
      return <CreatorPage username={route.params.username} navigate={navigate} />;
    case 'search':
      return <SearchPage query={route.params.q} navigate={navigate} />;
    case 'live':
      return <LivePage navigate={navigate} />;
    default:
      return <NotFoundPage navigate={navigate} />;
  }
}

/**
 * Match URL to route
 */
function matchRoute(path) {
  // Remove language prefix if present
  const langMatch = path.match(/^\/([a-z]{2})(\/.*)?$/);
  const cleanPath = langMatch ? (langMatch[2] || '/') : path;

  // Route patterns
  const routes = [
    { pattern: /^\/$/, page: 'home' },
    { pattern: /^\/gallery\/?$/, page: 'gallery' },
    { pattern: /^\/gallery\/([^/]+)$/, page: 'gallery', paramNames: ['slug'] },
    { pattern: /^\/photo\/([^/]+)$/, page: 'media', paramNames: ['id'] },
    { pattern: /^\/video\/([^/]+)$/, page: 'media', paramNames: ['id'] },
    { pattern: /^\/category\/([^/]+)$/, page: 'category', paramNames: ['slug'] },
    { pattern: /^\/creator\/([^/]+)$/, page: 'creator', paramNames: ['username'] },
    { pattern: /^\/search\/?$/, page: 'search' },
    { pattern: /^\/live\/?$/, page: 'live' }
  ];

  for (const route of routes) {
    const match = cleanPath.match(route.pattern);
    if (match) {
      const params = {};
      if (route.paramNames) {
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
      }
      // Add query params
      const urlParams = new URLSearchParams(window.location.search);
      for (const [key, value] of urlParams) {
        params[key] = value;
      }
      return { page: route.page, params };
    }
  }

  return { page: 'notFound', params: {} };
}

/**
 * App Header
 */
function AppHeader({ navigate }) {
  const config = getConfigService();
  const appConfig = config.getAppConfig();

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <a 
          href="/" 
          className="app-header__logo"
          onClick={(e) => { e.preventDefault(); navigate('/'); }}
        >
          {appConfig.name || 'GalleryX'}
        </a>

        <nav className="app-header__nav">
          <NavLink href="/gallery" navigate={navigate}>Gallery</NavLink>
          <NavLink href="/live" navigate={navigate}>Live</NavLink>
          <NavLink href="/search" navigate={navigate}>Search</NavLink>
        </nav>

        <div className="app-header__actions">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

/**
 * Navigation Link
 */
function NavLink({ href, navigate, children }) {
  const handleClick = (e) => {
    e.preventDefault();
    navigate(href);
  };

  const isActive = window.location.pathname === href || 
                   window.location.pathname.startsWith(href + '/');

  return (
    <a 
      href={href}
      onClick={handleClick}
      className={`app-header__link ${isActive ? 'is-active' : ''}`}
    >
      {children}
    </a>
  );
}

/**
 * Language Switcher
 */
function LanguageSwitcher() {
  const config = getConfigService();
  const languages = config.getLanguages();
  const [currentLang, setCurrentLang] = useState('en');

  const handleChange = (e) => {
    const lang = e.target.value;
    setCurrentLang(lang);
    // Update URL with language
    const path = window.location.pathname;
    const newPath = `/${lang}${path.replace(/^\/[a-z]{2}/, '')}`;
    window.history.pushState({}, '', newPath);
    window.location.reload(); // Reload to apply new language
  };

  return (
    <select 
      value={currentLang}
      onChange={handleChange}
      className="language-switcher"
      aria-label="Select language"
    >
      {languages.map(lang => (
        <option key={lang.code} value={lang.code}>
          {lang.flagEmoji} {lang.nativeName}
        </option>
      ))}
    </select>
  );
}

/**
 * App Footer
 */
function AppFooter() {
  const config = getConfigService();
  const appConfig = config.getAppConfig();

  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <p className="app-footer__copyright">
          © {new Date().getFullYear()} {appConfig.name || 'GalleryX'}
        </p>
        <nav className="app-footer__links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/contact">Contact</a>
        </nav>
      </div>
    </footer>
  );
}

/**
 * Loading States
 */
function AppLoading() {
  return (
    <div className="app-loading">
      <div className="app-loading__spinner" />
      <p>Loading application...</p>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="page-loading">
      <div className="page-loading__spinner" />
    </div>
  );
}

/**
 * Error States
 */
function AppError({ error, onRetry }) {
  return (
    <div className="app-error">
      <h1>Application Error</h1>
      <p>Failed to load application configuration.</p>
      <pre>{error}</pre>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
}

function NotFoundPage({ navigate }) {
  return (
    <div className="not-found-page">
      <h1>404</h1>
      <p>Page not found</p>
      <button onClick={() => navigate('/')}>Go Home</button>
    </div>
  );
}

export default App;
