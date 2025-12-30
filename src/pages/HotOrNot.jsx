import React, { useState, useEffect, useCallback, useRef } from 'react';

const API = '/api';

const styles = {
  container: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', zIndex: 9000, overflow: 'hidden'
  },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    padding: '15px 20px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 10
  },
  cardStack: {
    position: 'relative', width: '100%', maxWidth: '400px',
    height: '70vh', maxHeight: '600px'
  },
  card: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: '20px', overflow: 'hidden', background: '#222',
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    touchAction: 'none', userSelect: 'none', cursor: 'grab'
  },
  cardImage: {
    width: '100%', height: '100%', objectFit: 'cover'
  },
  cardInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: '60px 20px 20px',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.9))'
  },
  buttons: {
    display: 'flex', justifyContent: 'center', gap: '30px',
    marginTop: '25px'
  },
  btn: {
    width: '70px', height: '70px', borderRadius: '50%',
    border: 'none', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '32px',
    transition: 'transform 0.15s, box-shadow 0.15s'
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '80px', pointerEvents: 'none', opacity: 0
  },
  stats: {
    display: 'flex', gap: '20px', justifyContent: 'center',
    marginBottom: '20px', fontSize: '14px', color: '#888'
  },
  emptyState: {
    textAlign: 'center', padding: '40px', color: '#888'
  }
};

function HotOrNot({ user, onClose, onLoginRequired }) {
  const [performers, setPerformers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ hotCount: 0, notCount: 0, totalRated: 0 });
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  
  const cardRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  // Fetch performers to rate
  const fetchPerformers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/favorites/next?count=10`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setPerformers(data.performers);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Failed to fetch performers:', err);
    }
    setLoading(false);
  }, [user]);

  // Fetch user stats
  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/favorites/stats`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPerformers();
      fetchStats();
    }
  }, [user, fetchPerformers, fetchStats]);

  // Rate performer
  const ratePerformer = async (isHot) => {
    const performer = performers[currentIndex];
    if (!performer) return;

    setSwipeDirection(isHot ? 'right' : 'left');
    setLastAction({ performer, isHot });

    try {
      await fetch(`${API}/favorites/${performer.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isHot })
      });

      setStats(prev => ({
        ...prev,
        hotCount: isHot ? prev.hotCount + 1 : prev.hotCount,
        notCount: !isHot ? prev.notCount + 1 : prev.notCount,
        totalRated: prev.totalRated + 1
      }));
    } catch (err) {
      console.error('Failed to rate:', err);
    }

    // Animate and move to next
    setTimeout(() => {
      setSwipeDirection(null);
      if (currentIndex >= performers.length - 1) {
        fetchPerformers();
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    }, 300);
  };

  // Undo last action
  const undoLast = async () => {
    if (!lastAction) return;
    try {
      const res = await fetch(`${API}/favorites/undo`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setStats(prev => ({
          ...prev,
          hotCount: lastAction.isHot ? prev.hotCount - 1 : prev.hotCount,
          notCount: !lastAction.isHot ? prev.notCount - 1 : prev.notCount,
          totalRated: prev.totalRated - 1
        }));
        // Re-add performer to current position
        setPerformers(prev => [lastAction.performer, ...prev.slice(currentIndex)]);
        setCurrentIndex(0);
        setLastAction(null);
      }
    } catch (err) {
      console.error('Undo failed:', err);
    }
  };

  // Touch/mouse handlers for swiping
  const handleDragStart = (e) => {
    if (!cardRef.current) return;
    isDragging.current = true;
    const point = e.touches ? e.touches[0] : e;
    startPos.current = { x: point.clientX, y: point.clientY };
    currentPos.current = { x: 0, y: 0 };
    cardRef.current.style.transition = 'none';
  };

  const handleDragMove = (e) => {
    if (!isDragging.current || !cardRef.current) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startPos.current.x;
    const dy = point.clientY - startPos.current.y;
    currentPos.current = { x: dx, y: dy };
    
    const rotate = dx * 0.05;
    cardRef.current.style.transform = `translateX(${dx}px) translateY(${dy}px) rotate(${rotate}deg)`;
    
    // Update overlay opacity
    const overlay = cardRef.current.querySelector('.swipe-overlay');
    if (overlay) {
      const opacity = Math.min(Math.abs(dx) / 100, 1);
      overlay.style.opacity = dx > 0 ? opacity : 0;
      overlay.style.background = 'rgba(0, 255, 0, 0.3)';
    }
    const overlayNot = cardRef.current.querySelector('.swipe-overlay-not');
    if (overlayNot) {
      const opacity = Math.min(Math.abs(dx) / 100, 1);
      overlayNot.style.opacity = dx < 0 ? opacity : 0;
      overlayNot.style.background = 'rgba(255, 0, 0, 0.3)';
    }
  };

  const handleDragEnd = () => {
    if (!isDragging.current || !cardRef.current) return;
    isDragging.current = false;
    
    const threshold = 100;
    cardRef.current.style.transition = 'transform 0.3s';
    
    if (currentPos.current.x > threshold) {
      ratePerformer(true); // Hot
    } else if (currentPos.current.x < -threshold) {
      ratePerformer(false); // Not
    } else {
      cardRef.current.style.transform = 'translateX(0) translateY(0) rotate(0deg)';
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') ratePerformer(true);
      else if (e.key === 'ArrowLeft') ratePerformer(false);
      else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) undoLast();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, performers, lastAction]);

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '80px', marginBottom: '20px' }}>🔥</div>
          <h2 style={{ color: '#f60', marginBottom: '15px' }}>Hot or Not</h2>
          <p style={{ marginBottom: '25px' }}>Sign in to save your favorites and rate performers</p>
          <button onClick={onLoginRequired} style={{
            padding: '15px 40px', fontSize: '18px',
            background: 'linear-gradient(145deg, #f60, #c50)',
            color: '#fff', border: 'none', borderRadius: '8px',
            cursor: 'pointer', fontWeight: 'bold'
          }}>Sign In to Start</button>
        </div>
      </div>
    );
  }

  const currentPerformer = performers[currentIndex];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#fff',
          fontSize: '28px', cursor: 'pointer', padding: '5px 10px'
        }}>&times;</button>
        <h2 style={{ margin: 0, color: '#f60', fontSize: '20px' }}>🔥 Hot or Not</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user.avatarUrl && <img src={user.avatarUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />}
          <span style={{ color: '#888', fontSize: '14px' }}>{user.displayName}</span>
        </div>
      </div>

      <div style={styles.stats}>
        <span>🔥 {stats.hotCount} Hot</span>
        <span>❌ {stats.notCount} Not</span>
        <span>📊 {stats.totalRated} Rated</span>
      </div>

      {loading ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '40px' }}>⏳</div>
          <p>Loading performers...</p>
        </div>
      ) : !currentPerformer ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🎉</div>
          <h3 style={{ color: '#fff', marginBottom: '10px' }}>All caught up!</h3>
          <p>You've rated all available performers</p>
          <button onClick={fetchPerformers} style={{
            marginTop: '20px', padding: '12px 30px', background: '#f60',
            color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer'
          }}>Check for more</button>
        </div>
      ) : (
        <>
          <div style={styles.cardStack}>
            {/* Next card preview */}
            {performers[currentIndex + 1] && (
              <div style={{ ...styles.card, transform: 'scale(0.95)', opacity: 0.5, zIndex: 1 }}>
                <img src={currentPerformer.thumbnail_url || currentPerformer.profile_image} alt="" style={styles.cardImage} />
              </div>
            )}
            
            {/* Current card */}
            <div
              ref={cardRef}
              style={{
                ...styles.card,
                zIndex: 2,
                transform: swipeDirection === 'right' ? 'translateX(150%) rotate(30deg)' :
                          swipeDirection === 'left' ? 'translateX(-150%) rotate(-30deg)' :
                          'translateX(0) rotate(0deg)',
                transition: swipeDirection ? 'transform 0.3s ease-out' : 'none'
              }}
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <img 
                src={currentPerformer.thumbnail_url || currentPerformer.profile_image || '/placeholder.jpg'} 
                alt={currentPerformer.display_name}
                style={styles.cardImage}
                draggable={false}
              />
              <div className="swipe-overlay" style={{ ...styles.overlay, color: '#0f0' }}>👍</div>
              <div className="swipe-overlay-not" style={{ ...styles.overlay, color: '#f00' }}>👎</div>
              <div style={styles.cardInfo}>
                <h3 style={{ margin: '0 0 5px', fontSize: '24px', color: '#fff' }}>
                  {currentPerformer.display_name}
                </h3>
                <p style={{ margin: '0 0 5px', fontSize: '14px', color: '#888' }}>
                  {currentPerformer.platform_name} • {(currentPerformer.followers_count || 0).toLocaleString()} followers
                </p>
                {currentPerformer.is_online && (
                  <span style={{ 
                    display: 'inline-block', padding: '4px 12px', background: '#0f0',
                    color: '#000', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
                  }}>🟢 LIVE</span>
                )}
              </div>
            </div>
          </div>

          <div style={styles.buttons}>
            <button 
              onClick={() => ratePerformer(false)}
              style={{ ...styles.btn, background: '#333', color: '#f44' }}
              title="Not (← key)"
            >✗</button>
            
            <button 
              onClick={undoLast}
              disabled={!lastAction}
              style={{ 
                ...styles.btn, 
                width: '50px', height: '50px', fontSize: '20px',
                background: lastAction ? '#333' : '#222', 
                color: lastAction ? '#f90' : '#444'
              }}
              title="Undo (Ctrl+Z)"
            >↩</button>
            
            <button 
              onClick={() => ratePerformer(true)}
              style={{ ...styles.btn, background: 'linear-gradient(145deg, #0f0, #0a0)', color: '#fff' }}
              title="Hot (→ key)"
            >🔥</button>
          </div>

          <p style={{ color: '#666', fontSize: '12px', marginTop: '15px' }}>
            Swipe or use arrow keys • Esc to exit
          </p>
        </>
      )}
    </div>
  );
}

export default HotOrNot;
