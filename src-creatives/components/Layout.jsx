import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';

function Layout() {
  const location = useLocation();
  const auth = useAuth();
  const [showHotOrNot, setShowHotOrNot] = useState(false);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/live', label: 'Live Now' },
    { to: '/performers', label: 'Fans' },
    { to: '/themes', label: 'Themes' },
    { to: '/hot-or-not', label: '🔥 Hot or Not', className: 'hot-link' },
  ];

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
            {auth.isAuthenticated ? (
              <div className="user-menu">
                {auth.user.avatarUrl && (
                  <img src={auth.user.avatarUrl} alt="" className="user-avatar" />
                )}
                <span className="user-name">{auth.user.displayName}</span>
                <button onClick={auth.logout} className="btn btn-logout">Logout</button>
              </div>
            ) : (
              <button onClick={auth.openLogin} className="btn btn-signin">Sign In</button>
            )}
            <Link to="/admin" className="btn btn-admin">Admin</Link>
          </div>
        </div>
      </header>

      <main className="main">
        <Outlet context={{ auth }} />
      </main>

      <footer className="footer">
        <div className="container">
          <p>All models 18+ at time of depiction. RTA Labeled.</p>
          <p>&copy; {new Date().getFullYear()} fans.boyvue.com - Affiliate powered content aggregator</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
