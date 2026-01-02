import React, { useState, useEffect } from 'react';
import { Link, Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ComplianceFooter from './ComplianceFooter';
import { languages } from '../i18n';

function Layout() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  useEffect(() => {
    fetch('/api/admin/check-admin', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setIsAdmin(data.isAdmin))
      .catch(() => {});
  }, []);

  const changeLang = (code) => {
    i18n.changeLanguage(code);
    setShowLangMenu(false);
  };

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      navigate(`/studios?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <div className="layout">
      <header className="header">
        <div className="container">
          <div className="header-content">
            <Link to="/" className="logo">
              <span className="logo-text">BoyVue <span className="logo-accent">Videos</span></span>
            </Link>

            <nav className="nav">
              <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                {t('common.home', 'Home')}
              </NavLink>
              <NavLink to="/studios" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                {t('nav.studios', 'All Studios')}
              </NavLink>
              <NavLink to="/categories" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                {t('nav.categories', 'Categories')}
              </NavLink>
              {isAdmin && (
                <Link to="/admin" className="nav-link nav-admin">Admin</Link>
              )}
            </nav>

            <form className="search-form" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder={t('common.search', 'Search...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-btn">{t('common.search', 'Search').replace('...', '')}</button>
            </form>

            {/* Language Selector */}
            <div className="lang-selector">
              <button className="lang-btn" onClick={() => setShowLangMenu(!showLangMenu)}>
                {currentLang.flag} {currentLang.code.toUpperCase()}
              </button>
              {showLangMenu && (
                <div className="lang-menu">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      className={`lang-option ${i18n.language === lang.code ? 'active' : ''}`}
                      onClick={() => changeLang(lang.code)}
                    >
                      {lang.flag} {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <ComplianceFooter siteName="BoyVue Videos" />
    </div>
  );
}

export default Layout;
