import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import { languages } from '../i18n';

function Layout() {
  const location = useLocation();
  const auth = useAuth();
  const { t, i18n } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/live', label: t('nav.liveNow') },
    { to: '/performers', label: t('nav.fans') },
    { to: '/my-faves', label: '❤️ ' + t('nav.favourites'), className: 'faves-link' },
  ];

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
            <span className="logo-text">Fans</span>
            <span className="logo-sub">.boyvue.com</span>
          </Link>

          <nav className="nav">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${location.pathname === link.to ? 'active' : ''} ${link.className || ''}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            {/* Language Selector */}
            <div className="lang-selector">
              <button 
                className="lang-btn" 
                onClick={() => setShowLangMenu(!showLangMenu)}
              >
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
                <button onClick={auth.logout} className="btn btn-logout">{t('nav.logout')}</button>
              </div>
            ) : (
              <button onClick={auth.openLogin} className="btn btn-signin">{t('nav.signIn')}</button>
            )}
            <Link to="/admin" className="btn btn-admin">{t('nav.admin')}</Link>
          </div>
        </div>
      </header>

      <main className="main">
        <Outlet context={{ auth }} />
      </main>

      <footer className="footer">
        <div className="container">
          <p>{t('footer.ageNotice')}</p>
          <p>&copy; {new Date().getFullYear()} fans.boyvue.com - {t('footer.copyright')}</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
