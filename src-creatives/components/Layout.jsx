import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import { languages } from '../i18n';

const API = '/api';

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { t, i18n } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [dragOverFaves, setDragOverFaves] = useState(false);
  const [justAdded, setJustAdded] = useState(null);

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/live', label: t('nav.liveNow') },
    { to: '/performers', label: t('nav.fans') },
  ];

  const changeLang = (code) => {
    i18n.changeLanguage(code);
    setShowLangMenu(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOverFaves(true);
  };

  const handleDragLeave = () => {
    setDragOverFaves(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOverFaves(false);
    
    if (!auth?.isAuthenticated) {
      auth.openLogin();
      return;
    }

    const performerId = e.dataTransfer.getData('performerId');
    const performerData = e.dataTransfer.getData('performerData');
    
    if (performerId) {
      try {
        const res = await fetch(`${API}/favorites/${performerId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isHot: true })
        });
        
        if (res.ok && performerData) {
          const performer = JSON.parse(performerData);
          setJustAdded(performer);
          setTimeout(() => setJustAdded(null), 2000);
        }
      } catch (err) {
        console.error('Error adding favorite:', err);
      }
    }
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
                className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
            
            {/* Favourites Drop Zone Tab */}
            <Link
              to="/my-faves"
              className={`nav-link faves-link ${location.pathname === '/my-faves' ? 'active' : ''} ${dragOverFaves ? 'drag-over' : ''} ${justAdded ? 'just-added' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              ❤️ {t('nav.favourites')}
              {justAdded && <span className="added-indicator">+1</span>}
            </Link>
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
