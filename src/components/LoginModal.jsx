import React, { useState } from 'react';

const modalOverlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', zIndex: 10000
};

const modalBox = {
  background: 'linear-gradient(145deg, #1a1a1a, #252525)',
  padding: '30px', borderRadius: '16px', maxWidth: '400px', width: '90%',
  textAlign: 'center', border: '2px solid #f60',
  boxShadow: '0 0 40px rgba(255,102,0,0.3)'
};

const btnBase = {
  width: '100%', padding: '14px', fontSize: '16px', border: 'none',
  borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
  marginBottom: '12px', transition: 'transform 0.1s, box-shadow 0.2s'
};

const inputStyle = {
  width: '100%', padding: '12px', fontSize: '16px', background: '#333',
  border: '1px solid #555', borderRadius: '8px', color: '#fff',
  marginBottom: '12px', boxSizing: 'border-box'
};

function LoginModal({ onClose, onLoginGoogle, onLoginReddit, onLoginTwitter, onLoginEmail }) {
  const [mode, setMode] = useState('social'); // social, email, register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await onLoginEmail(email, password, mode === 'register');
    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '15px', right: '15px',
          background: 'none', border: 'none', color: '#888',
          fontSize: '28px', cursor: 'pointer', lineHeight: 1
        }}>&times;</button>
        
        <div style={{ fontSize: '50px', marginBottom: '15px' }}>🔥</div>
        <h2 style={{ color: '#f60', margin: '0 0 8px', fontSize: '24px' }}>
          {mode === 'register' ? 'Create Account' : 'Sign In'}
        </h2>
        <p style={{ color: '#888', margin: '0 0 25px', fontSize: '14px' }}>
          Save your favorites across all devices
        </p>

        {mode === 'social' && (
          <>
            <button onClick={onLoginGoogle} style={{
              ...btnBase, background: '#fff', color: '#333'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            <button onClick={onLoginReddit} style={{
              ...btnBase, background: '#FF4500', color: '#fff'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path fill="#FF4500" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path fill="#fff" d="M18.5 12c0-.83-.67-1.5-1.5-1.5-.39 0-.74.15-1.01.39-1-.72-2.37-1.18-3.89-1.24l.66-3.12 2.16.46c.02.78.65 1.41 1.43 1.41.8 0 1.45-.65 1.45-1.45s-.65-1.45-1.45-1.45c-.57 0-1.06.33-1.29.81l-2.42-.52c-.15-.03-.29.07-.32.22l-.73 3.45c-1.56.04-2.97.51-3.99 1.24-.27-.24-.62-.39-1.01-.39-.83 0-1.5.67-1.5 1.5 0 .59.34 1.1.83 1.35-.03.18-.05.36-.05.54 0 2.76 3.21 5 7.17 5s7.17-2.24 7.17-5c0-.18-.02-.36-.05-.54.49-.25.83-.76.83-1.35zM8.5 13c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm6.29 3.08c-.78.78-2.04.78-2.79.78s-2.01 0-2.79-.78c-.14-.14-.14-.36 0-.5s.36-.14.5 0c.57.57 1.55.57 2.29.57s1.72 0 2.29-.57c.14-.14.36-.14.5 0s.14.36 0 .5zM15.5 15c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
              Continue with Reddit
            </button>

            <button onClick={onLoginTwitter} style={{
              ...btnBase, background: '#000', color: '#fff'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Continue with X
            </button>

            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#444' }}/>
              <span style={{ padding: '0 15px', color: '#666', fontSize: '13px' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: '#444' }}/>
            </div>

            <button onClick={() => setMode('email')} style={{
              ...btnBase, background: '#333', color: '#fff', border: '1px solid #555'
            }}>
              📧 Continue with Email
            </button>
          </>
        )}

        {(mode === 'email' || mode === 'register') && (
          <form onSubmit={handleEmailSubmit}>
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle} required
            />
            <input
              type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle} required minLength={6}
            />
            {error && <p style={{ color: '#f44', fontSize: '14px', margin: '0 0 12px' }}>{error}</p>}
            <button type="submit" style={{
              ...btnBase, background: 'linear-gradient(145deg, #f60, #c50)', color: '#fff'
            }}>
              {mode === 'register' ? 'Create Account' : 'Sign In'}
            </button>
            <button type="button" onClick={() => setMode('social')} style={{
              ...btnBase, background: '#333', color: '#888', border: '1px solid #444'
            }}>
              Back to social login
            </button>
            <p style={{ color: '#888', fontSize: '13px', marginTop: '15px' }}>
              {mode === 'email' ? (
                <>Don't have an account? <span onClick={() => setMode('register')} style={{ color: '#f60', cursor: 'pointer' }}>Sign up</span></>
              ) : (
                <>Already have an account? <span onClick={() => setMode('email')} style={{ color: '#f60', cursor: 'pointer' }}>Sign in</span></>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginModal;
