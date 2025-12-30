import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import '../styles/HotOrNot.css';

const API = '/api';

const AI_SUGGESTIONS = [
  "What type of performer is this?",
  "How would you classify them?",
  "What category fits best?",
  "Describe this performer in one word...",
  "What theme matches their vibe?"
];

const SUGGESTED_THEMES = ['Couples', 'Black', 'Asian', 'Latino', 'Skinny', 'Faves', 'BDSM'];
const REFRESH_OPTIONS = [5, 10, 15, 30, 60];

function HotOrNotPage() {
  const { auth } = useOutletContext();
  const [performers, setPerformers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ hotCount: 0, notCount: 0, totalRated: 0, byTheme: [], byCustomTheme: [] });
  const [themes, setThemes] = useState([]);
  const [customThemes, setCustomThemes] = useState([]);
  const [availableIcons, setAvailableIcons] = useState([]);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [pendingPerformer, setPendingPerformer] = useState(null);
  const [themeInput, setThemeInput] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [imageKey, setImageKey] = useState(Date.now());
  const [refreshRate, setRefreshRate] = useState(() => {
    const saved = localStorage.getItem('thumbRefreshRate');
    return saved ? parseInt(saved) : 10;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [recentlyUsedThemes, setRecentlyUsedThemes] = useState([]);
  const [countdown, setCountdown] = useState(0);
  
  const cardRef = useRef(null);
  const inputRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  // Refresh thumbnail based on rate
  useEffect(() => {
    setCountdown(refreshRate);
    const countdownInterval = setInterval(() => {
      setCountdown(prev => prev > 1 ? prev - 1 : refreshRate);
    }, 1000);
    
    const refreshInterval = setInterval(() => {
      setImageKey(Date.now());
    }, refreshRate * 1000);
    
    return () => {
      clearInterval(countdownInterval);
      clearInterval(refreshInterval);
    };
  }, [refreshRate, currentIndex]);

  const handleRefreshRateChange = (rate) => {
    setRefreshRate(rate);
    localStorage.setItem('thumbRefreshRate', rate.toString());
    setImageKey(Date.now()); // Immediate refresh
  };

  const getRefreshableUrl = (url) => {
    if (!url) return '/placeholder.jpg';
    return `${url}${url.includes('?') ? '&' : '?'}refresh=${imageKey}`;
  };

  const fetchThemes = useCallback(async () => {
    if (!auth?.user) return;
    try {
      const res = await fetch(`${API}/favorites/themes`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setThemes(data.themes || []);
        setCustomThemes(data.customThemes || []);
        setAvailableIcons(data.icons || []);
      }
    } catch (err) {}
  }, [auth?.user]);

  const fetchPerformers = useCallback(async () => {
    if (!auth?.user) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/favorites/next?count=10`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) { setPerformers(data.performers); setCurrentIndex(0); }
    } catch (err) {}
    setLoading(false);
  }, [auth?.user]);

  const fetchStats = useCallback(async () => {
    if (!auth?.user) return;
    try {
      const res = await fetch(`${API}/favorites/stats`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) {}
  }, [auth?.user]);

  useEffect(() => {
    if (auth?.user) { fetchThemes(); fetchPerformers(); fetchStats(); }
  }, [auth?.user]);

  useEffect(() => {
    if (showThemeSelector && inputRef.current) {
      inputRef.current.focus();
      setAiMessage(AI_SUGGESTIONS[Math.floor(Math.random() * AI_SUGGESTIONS.length)]);
    }
  }, [showThemeSelector]);

  const moveToNext = () => {
    setSwipeDirection(null);
    setShowThemeSelector(false);
    setPendingPerformer(null);
    setThemeInput('');
    setImageKey(Date.now());
    if (currentIndex >= performers.length - 1) fetchPerformers();
    else setCurrentIndex(prev => prev + 1);
  };

  const ratePerformer = async (isHot) => {
    const performer = performers[currentIndex];
    if (!performer) return;
    setSwipeDirection(isHot ? 'right' : 'left');
    setLastAction({ performer, isHot });

    try {
      await fetch(`${API}/favorites/${performer.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ isHot })
      });
      setStats(prev => ({
        ...prev,
        hotCount: isHot ? prev.hotCount + 1 : prev.hotCount,
        notCount: !isHot ? prev.notCount + 1 : prev.notCount,
        totalRated: prev.totalRated + 1
      }));
      if (isHot) {
        setPendingPerformer(performer);
        setTimeout(() => { setSwipeDirection(null); setShowThemeSelector(true); }, 300);
      } else {
        setTimeout(moveToNext, 300);
      }
    } catch (err) {}
  };

  const findOrCreateTheme = async (themeName) => {
    const name = themeName.trim();
    if (!name) return null;
    
    const systemMatch = themes.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (systemMatch) return { id: systemMatch.id, isCustom: false };
    
    const customMatch = customThemes.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (customMatch) return { id: customMatch.id, isCustom: true };
    
    const icons = ['🏷️','⭐','💫','✨','🎯','💎','🔮','🎪','🎭','🎨'];
    const icon = icons[customThemes.length % icons.length];
    
    try {
      const res = await fetch(`${API}/favorites/themes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ name, icon })
      });
      const data = await res.json();
      if (data.success) {
        setCustomThemes(prev => [...prev, data.theme]);
        return { id: data.theme.id, isCustom: true };
      }
    } catch (err) {}
    return null;
  };

  const classifyWithTheme = async (themeName) => {
    if (!pendingPerformer || !themeName) return;
    
    const theme = await findOrCreateTheme(themeName);
    if (!theme) return;
    
    try {
      const endpoint = theme.isCustom ? 'custom-theme' : 'theme';
      const body = theme.isCustom ? { userThemeId: theme.id } : { themeId: theme.id };
      await fetch(`${API}/favorites/${pendingPerformer.id}/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body)
      });
      setRecentlyUsedThemes(prev => [themeName, ...prev.filter(t => t !== themeName)].slice(0, 5));
      fetchStats();
    } catch (err) {}
    moveToNext();
  };

  const handleInputSubmit = (e) => {
    e.preventDefault();
    if (themeInput.trim()) classifyWithTheme(themeInput.trim());
  };

  const handleQuickTheme = (themeName) => {
    setThemeInput(themeName);
    classifyWithTheme(themeName);
  };

  const undoLast = async () => {
    if (!lastAction) return;
    try {
      const res = await fetch(`${API}/favorites/undo`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setStats(prev => ({
          ...prev,
          hotCount: lastAction.isHot ? prev.hotCount - 1 : prev.hotCount,
          notCount: !lastAction.isHot ? prev.notCount - 1 : prev.notCount,
          totalRated: prev.totalRated - 1
        }));
        setPerformers(prev => [lastAction.performer, ...prev.slice(currentIndex)]);
        setCurrentIndex(0);
        setLastAction(null);
        setShowThemeSelector(false);
        setPendingPerformer(null);
      }
    } catch (err) {}
  };

  const handleDragStart = (e) => {
    if (!cardRef.current || showThemeSelector) return;
    isDragging.current = true;
    const point = e.touches ? e.touches[0] : e;
    startPos.current = { x: point.clientX, y: point.clientY };
    cardRef.current.style.transition = 'none';
  };

  const handleDragMove = (e) => {
    if (!isDragging.current || !cardRef.current) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startPos.current.x;
    const dy = point.clientY - startPos.current.y;
    currentPos.current = { x: dx, y: dy };
    cardRef.current.style.transform = `translateX(${dx}px) translateY(${dy}px) rotate(${dx * 0.05}deg)`;
  };

  const handleDragEnd = () => {
    if (!isDragging.current || !cardRef.current) return;
    isDragging.current = false;
    cardRef.current.style.transition = 'transform 0.3s';
    if (currentPos.current.x > 100) ratePerformer(true);
    else if (currentPos.current.x < -100) ratePerformer(false);
    else cardRef.current.style.transform = 'translateX(0) translateY(0) rotate(0deg)';
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showThemeSelector) {
        if (e.key === 'Escape') moveToNext();
        return;
      }
      if (e.key === 'ArrowRight') ratePerformer(true);
      else if (e.key === 'ArrowLeft') ratePerformer(false);
      else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) undoLast();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, performers, lastAction, showThemeSelector]);

  if (!auth?.user) {
    return (
      <div className="hon-container">
        <div className="hon-login-prompt">
          <div className="hon-icon">🔥</div>
          <h2>Hot or Not</h2>
          <p>Sign in to rate performers and build your collection</p>
          <button onClick={auth?.openLogin} className="btn btn-primary btn-large">Sign In to Start</button>
        </div>
      </div>
    );
  }

  const currentPerformer = performers[currentIndex];
  const allExistingThemes = [...themes.map(t => t.name), ...customThemes.map(t => t.name)];
  const suggestedForInput = themeInput 
    ? [...allExistingThemes, ...SUGGESTED_THEMES].filter(t => 
        t.toLowerCase().includes(themeInput.toLowerCase()) && t.toLowerCase() !== themeInput.toLowerCase()
      ).slice(0, 5)
    : [...recentlyUsedThemes, ...SUGGESTED_THEMES.filter(t => !recentlyUsedThemes.includes(t))].slice(0, 8);

  return (
    <div className="hon-container">
      <div className="hon-header">
        <div className="hon-stats">
          <span>🔥 {stats.hotCount}</span>
          <span>❌ {stats.notCount}</span>
          <span>📊 {stats.totalRated}</span>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="settings-btn">⚙️</button>
      </div>

      {showSettings && (
        <div className="settings-panel">
          <p>Thumbnail refresh rate:</p>
          <div className="refresh-options">
            {REFRESH_OPTIONS.map(rate => (
              <button
                key={rate}
                onClick={() => handleRefreshRateChange(rate)}
                className={`refresh-btn ${refreshRate === rate ? 'active' : ''}`}
              >
                {rate}s
              </button>
            ))}
          </div>
        </div>
      )}

      {showThemeSelector && pendingPerformer ? (
        <div className="ai-classifier">
          <div className="ai-header">
            <div className="ai-avatar">🤖</div>
            <div className="ai-bubble">
              <p>{aiMessage}</p>
              <span className="performer-name">for <strong>{pendingPerformer.display_name}</strong></span>
            </div>
          </div>
          
          <div className="performer-mini">
            <img src={getRefreshableUrl(pendingPerformer.avatar_url)} alt="" />
            <div className="refresh-countdown">{countdown}s</div>
          </div>

          <form onSubmit={handleInputSubmit} className="theme-input-form">
            <input
              ref={inputRef}
              type="text"
              value={themeInput}
              onChange={e => setThemeInput(e.target.value)}
              placeholder="Type a theme (e.g., Twink, Muscle, Bear...)"
              className="theme-text-input"
              autoComplete="off"
            />
            <button type="submit" disabled={!themeInput.trim()} className="btn-send">→</button>
          </form>

          <div className="quick-themes">
            {suggestedForInput.map(theme => (
              <button key={theme} onClick={() => handleQuickTheme(theme)} className="quick-theme-btn">
                {theme}
              </button>
            ))}
          </div>

          {customThemes.length > 0 && (
            <div className="your-themes">
              <p>Your themes:</p>
              <div className="your-themes-list">
                {customThemes.map(t => (
                  <button key={t.id} onClick={() => handleQuickTheme(t.name)} className="your-theme-btn">
                    {t.icon} {t.name}
                    <span className="theme-count">{stats.byCustomTheme?.find(s => s.id === t.id)?.count || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={moveToNext} className="btn-skip-text">Skip → Next performer</button>
        </div>
      ) : loading ? (
        <div className="hon-loading"><div className="spinner"></div><p>Loading...</p></div>
      ) : !currentPerformer ? (
        <div className="hon-empty">
          <div className="hon-icon">🎉</div>
          <h3>All caught up!</h3>
          <button onClick={fetchPerformers} className="btn btn-primary">Check for more</button>
        </div>
      ) : (
        <>
          <div className="hon-card-stack">
            {performers[currentIndex + 1] && (
              <div className="hon-card hon-card-next">
                <img src={performers[currentIndex + 1].avatar_url} alt="" />
              </div>
            )}
            <div
              ref={cardRef}
              className={`hon-card ${swipeDirection === 'right' ? 'swipe-right' : ''} ${swipeDirection === 'left' ? 'swipe-left' : ''}`}
              onMouseDown={handleDragStart} onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}
              onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd}
            >
              <img src={getRefreshableUrl(currentPerformer.avatar_url)} alt={currentPerformer.display_name} draggable={false} />
              <div className="refresh-indicator">{countdown}s ↻</div>
              <div className="hon-card-info">
                <h3>{currentPerformer.display_name}</h3>
                <p>{currentPerformer.platform_name} • {(currentPerformer.follower_count || 0).toLocaleString()} followers</p>
                {currentPerformer.is_online && <span className="live-badge">🟢 LIVE</span>}
              </div>
            </div>
          </div>
          <div className="hon-buttons">
            <button onClick={() => ratePerformer(false)} className="hon-btn hon-btn-not">✗</button>
            <button onClick={undoLast} disabled={!lastAction} className="hon-btn hon-btn-undo">↩</button>
            <button onClick={() => ratePerformer(true)} className="hon-btn hon-btn-hot">🔥</button>
          </div>
          <p className="hon-hint">Swipe or use arrow keys</p>
        </>
      )}
    </div>
  );
}

export default HotOrNotPage;
