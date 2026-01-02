import { useState, useEffect, useCallback } from 'react';

const API = '/api/auth';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch(`${API}/me`, { credentials: 'include' });
      const data = await res.json();
      if (data.authenticated) {
        setUser(data.user);
      } else if (data.expired) {
        await refreshToken();
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = async () => {
    try {
      const res = await fetch(`${API}/refresh`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.user) setUser(data.user);
    } catch (err) {
      console.error('Token refresh failed:', err);
    }
  };

  const loginWithGoogle = () => {
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = `${API}/google?redirect=${redirect}`;
  };

  const loginWithReddit = () => {
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = `${API}/reddit?redirect=${redirect}`;
  };

  const loginWithTwitter = () => {
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = `${API}/twitter?redirect=${redirect}`;
  };

  const loginWithEmail = async (email, password, isRegister = false) => {
    const endpoint = isRegister ? 'register' : 'login';
    try {
      const res = await fetch(`${API}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setShowLoginModal(false);
        return { success: true };
      }
      return { error: data.error || 'Login failed' };
    } catch (err) {
      return { error: 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {}
    setUser(null);
  };

  const openLogin = useCallback(() => setShowLoginModal(true), []);
  const closeLogin = useCallback(() => setShowLoginModal(false), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      checkAuth();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return {
    user, loading, isAuthenticated: !!user, showLoginModal,
    openLogin, closeLogin, loginWithGoogle, loginWithReddit,
    loginWithTwitter, loginWithEmail, logout, checkAuth
  };
}

export default useAuth;
