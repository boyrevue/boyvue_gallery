import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import ComplianceFooter from './ComplianceFooter';
import { languages } from '../i18n';

function Layout() {
  const location = useLocation();
  const auth = useAuth();
  const { t, i18n } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  useEffect(() => {
    // Check if user is admin
    fetch('/api/admin/check-admin', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setIsAdmin(data.isAdmin))
      .catch(() => {});
  }, [auth.isAuthenticated]);

  const changeLang = (code) => {
    i18n.changeLanguage(code);
    setShowLangMenu(false);
  };

  return (
    <div className="app">
      {auth.showLoginModal && (
        <LoginModal
          onClose={auth.closeLogin}
          onLoginGoogle={auth.loginWithGoogle}
          onLoginReddit={auth.loginWithReddit}
          onLoginTwitter={auth.loginWithTwitter}
          onLoginEmail={auth.loginWithEmail}
        />
      )}

      <header className="header">
        <div className="container">
          <Link to="/" className="logo">
            Boy<span>Vue</span>
          </Link>

          <nav className="nav">
            <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
              {t('common.home', 'Home')}
            </Link>
            <a href="https://pics.boyvue.com" className="nav-link">
              {t('network.pics', 'Pics')}
            </a>
            <a href="https://videos.boyvue.com" className="nav-link">
              {t('network.videos', 'Videos')}
            </a>
            <a href="https://adult.boyvue.com" className="nav-link">
              {t('network.adult', 'Adult')}
            </a>
            <a href="https://fans.boyvue.com" className="nav-link">
              {t('network.fans', 'Fans')}
            </a>
            {isAdmin && (
              <Link to="/admin" className="nav-link nav-admin">
                Admin
              </Link>
            )}
          </nav>

          <div className="header-right">
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

            {auth.isAuthenticated ? (
              <div className="user-menu">
                {auth.user.avatarUrl && (
                  <img src={auth.user.avatarUrl} alt="" className="user-avatar" />
                )}
                <span className="user-name">{auth.user.displayName}</span>
                <button onClick={auth.logout} className="btn btn-logout">{t('common.logout', 'Logout')}</button>
              </div>
            ) : (
              <button onClick={auth.openLogin} className="btn btn-primary">{t('common.signIn', 'Sign In')}</button>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet context={{ auth }} />
      </main>

      <ComplianceFooter siteName="BoyVue" />
    </div>
  );
}

export default Layout;
