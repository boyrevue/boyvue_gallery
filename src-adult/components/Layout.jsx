import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ComplianceFooter from './ComplianceFooter';
import { languages } from '../i18n';

export default function Layout() {
  const { t, i18n } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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

  return (
    <div className="layout">
      <header className="header">
        <nav>
          <Link to="/" className="logo">BoyVue Adult</Link>
          <div className="nav-links">
            <Link to="/">{t('common.home', 'Home')}</Link>
            <a href="https://pics.boyvue.com">{t('network.pics', 'Pics')}</a>
            <a href="https://videos.boyvue.com">{t('network.videos', 'Videos')}</a>
            <a href="https://fans.boyvue.com">{t('network.fans', 'Fans')}</a>
            {isAdmin && <Link to="/admin" className="nav-admin">Admin</Link>}
          </div>
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
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <ComplianceFooter siteName="BoyVue Adult" />
    </div>
  );
}
