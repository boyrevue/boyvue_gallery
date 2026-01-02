import React, { useState } from 'react';

function LoginModal({ onClose, onLoginGoogle, onLoginReddit, onLoginTwitter, onLoginEmail }) {
  const [mode, setMode] = useState('social');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await onLoginEmail(email, password, mode === 'register');
    if (result.error) setError(result.error);
  };

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="login-modal" onClick={e => e.stopPropagation()}>
        <button className="login-close" onClick={onClose}>&times;</button>

        <div className="login-icon">🔥</div>
        <h2 className="login-title">{mode === 'register' ? 'Create Account' : 'Sign In'}</h2>
        <p className="login-subtitle">Access all BoyVue sites with one account</p>

        {mode === 'social' && (
          <>
            <button onClick={onLoginGoogle} className="login-btn login-btn-google">
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            <button onClick={onLoginReddit} className="login-btn login-btn-reddit">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="#FF4500"/><path fill="#fff" d="M18.5 12c0-.83-.67-1.5-1.5-1.5-.39 0-.74.15-1.01.39-1-.72-2.37-1.18-3.89-1.24l.66-3.12 2.16.46c.02.78.65 1.41 1.43 1.41.8 0 1.45-.65 1.45-1.45s-.65-1.45-1.45-1.45c-.57 0-1.06.33-1.29.81l-2.42-.52c-.15-.03-.29.07-.32.22l-.73 3.45c-1.56.04-2.97.51-3.99 1.24-.27-.24-.62-.39-1.01-.39-.83 0-1.5.67-1.5 1.5 0 .59.34 1.1.83 1.35-.03.18-.05.36-.05.54 0 2.76 3.21 5 7.17 5s7.17-2.24 7.17-5c0-.18-.02-.36-.05-.54.49-.25.83-.76.83-1.35zM8.5 13c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm6.29 3.08c-.78.78-2.04.78-2.79.78s-2.01 0-2.79-.78c-.14-.14-.14-.36 0-.5s.36-.14.5 0c.57.57 1.55.57 2.29.57s1.72 0 2.29-.57c.14-.14.36-.14.5 0s.14.36 0 .5zM15.5 15c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
              Continue with Reddit
            </button>
            <button onClick={onLoginTwitter} className="login-btn login-btn-twitter">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Continue with X
            </button>
            <div className="login-divider"><span>or</span></div>
            <button onClick={() => setMode('email')} className="login-btn login-btn-email">
              Continue with Email
            </button>
          </>
        )}

        {(mode === 'email' || mode === 'register') && (
          <form onSubmit={handleEmailSubmit}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="login-input"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="login-input"
              required
              minLength={6}
            />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-btn login-btn-submit">
              {mode === 'register' ? 'Create Account' : 'Sign In'}
            </button>
            <button type="button" onClick={() => setMode('social')} className="login-btn login-btn-back">
              Back to social login
            </button>
            <p className="login-toggle">
              {mode === 'email' ? (
                <>Don't have an account? <span onClick={() => setMode('register')}>Sign up</span></>
              ) : (
                <>Already have an account? <span onClick={() => setMode('email')}>Sign in</span></>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginModal;
