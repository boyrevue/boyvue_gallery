import React, { useEffect } from 'react';

// Redirect to central admin on boyvue.com
export default function AdminPage() {
  useEffect(() => {
    // Redirect to central admin with site parameter
    window.location.href = 'https://boyvue.com/admin?site=adult';
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#ff1493' }}>Redirecting to Central Admin...</h1>
        <p style={{ color: '#888' }}>
          Admin has been consolidated to <a href="https://boyvue.com/admin" style={{ color: '#00d4ff' }}>boyvue.com/admin</a>
        </p>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '20px' }}>
          If you are not redirected automatically, <a href="https://boyvue.com/admin?site=adult" style={{ color: '#00d4ff' }}>click here</a>
        </p>
      </div>
    </div>
  );
}
