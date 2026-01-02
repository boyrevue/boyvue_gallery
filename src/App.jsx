import React, { useState, useEffect, useRef } from 'react';
import { translations, getLang, setLang, fetchTranslations, fetchLanguages, getTranslationsSync } from './i18n.js';
import { useAuth } from './hooks/useAuth.js';
import LoginModal from './components/LoginModal.jsx';
import HotOrNot from './pages/HotOrNot.jsx';
import ReviewModal from './components/ReviewModal.jsx';

const API = '/api';
const VIDEO_EXTS = ['.mp4', '.webm', '.avi', '.mov', '.wmv', '.flv', '.mkv'];

if (typeof window !== 'undefined' && window.location.search.includes('reset=1')) {
  localStorage.removeItem('ageVerified');
  localStorage.removeItem('lang');
  window.location.href = '/';
}

function isVideo(path) {
  if (!path) return false;
  return VIDEO_EXTS.includes(path.substring(path.lastIndexOf('.')).toLowerCase());
}

// Fallback age gate text - will be overridden by DB
const defaultAgeGateText = {
  title: 'Age Verification Required', warning: 'This website contains adult content',
  question: 'Are you 18 years or older?', yes: 'Yes, I am 18+', no: 'No, Exit',
  disclaimer: 'By entering, you confirm you are at least 18 years old.'
};

const countryFlags = {
  US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹', NL: '🇳🇱', BE: '🇧🇪', 
  RU: '🇷🇺', UA: '🇺🇦', PL: '🇵🇱', CZ: '🇨🇿', AT: '🇦🇹', CH: '🇨🇭', SE: '🇸🇪', NO: '🇳🇴',
  CN: '🇨🇳', JP: '🇯🇵', KR: '🇰🇷', TH: '🇹🇭', VN: '🇻🇳', ID: '🇮🇩', MY: '🇲🇾', SG: '🇸🇬', PH: '🇵🇭',
  BR: '🇧🇷', MX: '🇲🇽', AR: '🇦🇷', CO: '🇨🇴', AU: '🇦🇺', NZ: '🇳🇿', CA: '🇨🇦', IN: '🇮🇳',
  SA: '🇸🇦', AE: '🇦🇪', EG: '🇪🇬', TR: '🇹🇷', GR: '🇬🇷', PT: '🇵🇹', HU: '🇭🇺', RO: '🇷🇴', XX: '🌍'
};

function AgeGate({ lang, ageGateText, languages, onAccept, onDecline, onLangChange }) {
  const text = ageGateText || defaultAgeGateText;
  const isRtl = lang === 'ar';
  const langList = languages || translations;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, direction: isRtl ? 'rtl' : 'ltr' }}>
      <div style={{ background: 'linear-gradient(145deg, #1a1a1a, #222)', padding: '40px', borderRadius: '16px', maxWidth: '500px', textAlign: 'center', border: '2px solid #f60', boxShadow: '0 0 50px rgba(255,102,0,0.3)' }}>
        <div style={{ fontSize: '60px', marginBottom: '20px' }}>🔞</div>
        <h1 style={{ color: '#f60', margin: '0 0 15px', fontSize: '28px' }}>{text.title}</h1>
        <p style={{ color: '#ff6666', fontSize: '18px', margin: '0 0 20px', fontWeight: 'bold' }}>⚠️ {text.warning}</p>
        <p style={{ color: '#fff', fontSize: '22px', margin: '0 0 30px' }}>{text.question}</p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '25px' }}>
          <button onClick={onAccept} style={{ padding: '15px 40px', fontSize: '18px', background: 'linear-gradient(145deg, #f60, #c50)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>{text.yes}</button>
          <button onClick={onDecline} style={{ padding: '15px 40px', fontSize: '18px', background: '#333', color: '#fff', border: '2px solid #666', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>{text.no}</button>
        </div>
        <p style={{ color: '#888', fontSize: '12px', margin: '0 0 20px' }}>{text.disclaimer}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', paddingTop: '15px', borderTop: '1px solid #333' }}>
          {Object.keys(langList).map(code => (
            <button key={code} onClick={() => onLangChange(code)} style={{ background: lang === code ? '#f60' : '#333', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }} title={langList[code].name}>{langList[code].flag}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatsModal({ onClose, analytics }) {
  if (!analytics) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }} onClick={onClose}>
      <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '12px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto', border: '1px solid #333' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#f60' }}>📊 Live Statistics</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '25px' }}>
          <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', color: '#4f4', fontWeight: 'bold' }}>{analytics.live}</div>
            <div style={{ color: '#888', fontSize: '12px' }}>🟢 Online Now</div>
          </div>
          <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', color: '#f60', fontWeight: 'bold' }}>{analytics.today?.visitors || 0}</div>
            <div style={{ color: '#888', fontSize: '12px' }}>👥 Today</div>
          </div>
          <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', color: '#6cf', fontWeight: 'bold' }}>{analytics.today?.pageviews || 0}</div>
            <div style={{ color: '#888', fontSize: '12px' }}>📄 Views</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h3 style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>🌍 Countries</h3>
            <div style={{ background: '#222', borderRadius: '8px', padding: '10px' }}>
              {analytics.countries?.slice(0, 10).map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 9 ? '1px solid #333' : 'none' }}>
                  <span>{countryFlags[c.country] || '🌍'} {c.country}</span>
                  <span style={{ color: '#f60' }}>{c.visitors}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>🔗 Referrers</h3>
            <div style={{ background: '#222', borderRadius: '8px', padding: '10px' }}>
              {analytics.topReferers?.slice(0, 10).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 9 ? '1px solid #333' : 'none', fontSize: '12px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{r.referer ? new URL(r.referer).hostname : 'Direct'}</span>
                  <span style={{ color: '#f60' }}>{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoThumbnail({ img, ui, onClick }) {
  const [thumbs, setThumbs] = useState([]);
  const [currentThumb, setCurrentThumb] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/video-thumbs/${img.id}`).then(r => r.json()).then(data => {
      if (data.thumbs?.length > 0) setThumbs(data.thumbs);
    }).catch(() => {});
  }, [img.id]);

  useEffect(() => {
    if (isHovering && thumbs.length > 1) {
      intervalRef.current = setInterval(() => setCurrentThumb(prev => (prev + 1) % thumbs.length), 2000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCurrentThumb(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isHovering, thumbs.length]);

  return (
    <article style={{ background: '#222', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', position: 'relative' }} onClick={onClick} onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
      <div style={{ width: '100%', height: '150px', background: '#333', position: 'relative', overflow: 'hidden' }}>
        {thumbs.length > 0 ? (
          <img src={thumbs[currentThumb]} alt={img.title || ui.untitled} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '48px' }}>▶</span></div>
        )}
        {isHovering && thumbs.length > 1 && (
          <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px' }}>
            {thumbs.map((_, i) => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === currentThumb ? '#f60' : 'rgba(255,255,255,0.5)' }} />)}
          </div>
        )}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: isHovering ? 1 : 0.7 }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(0,0,0,0.7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '20px', marginLeft: '3px' }}>▶</span></div>
        </div>
      </div>
      <span style={{ position: 'absolute', top: '5px', right: '5px', background: '#f60', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '10px' }}>{ui.video}</span>
      <div style={{ padding: '10px' }}><h3 style={{ margin: 0, fontSize: '12px', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'normal' }}>{img.title || ui.untitled}</h3><p style={{ margin: '5px 0 0', fontSize: '11px', color: '#666' }}>{img.view_count} {ui.views} | {parseFloat(img.average_rating || 0).toFixed(1)} {ui.rating}</p></div>
    </article>
  );
}

function LanguageSelector({ lang, onChange }) {
  const [open, setOpen] = useState(false);
  const current = translations[lang];
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ background: '#333', border: '1px solid #555', borderRadius: '4px', padding: '8px 12px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
        <span style={{ fontSize: '20px' }}>{current.flag}</span><span>{current.name}</span><span style={{ fontSize: '10px' }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, background: '#222', border: '1px solid #444', borderRadius: '4px', marginTop: '5px', zIndex: 1000, minWidth: '150px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', maxHeight: '400px', overflowY: 'auto' }}>
          {Object.values(translations).map(tr => (
            <div key={tr.code} onClick={() => { onChange(tr.code); setOpen(false); }} style={{ padding: '10px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: lang === tr.code ? '#444' : 'transparent', borderBottom: '1px solid #333' }}>
              <span style={{ fontSize: '20px' }}>{tr.flag}</span><span style={{ color: '#fff' }}>{tr.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function ShareButtons({ url, title, image }) {
  const fullUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title || "");
  const encodedImage = encodeURIComponent(image || "");
  
  const shares = {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&media=${encodedImage}&description=${encodedTitle}`,
    tumblr: `https://www.tumblr.com/share/link?url=${encodedUrl}&name=${encodedTitle}`,
    vk: `https://vk.com/share.php?url=${encodedUrl}&title=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`
  };
  
  const btnStyle = (bg) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: "36px", height: "36px", borderRadius: "50%",
    background: bg, color: "#fff", textDecoration: "none", fontSize: "16px"
  });
  
  const copyLink = () => { navigator.clipboard.writeText(fullUrl); alert("Link copied!"); };
  
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "15px", alignItems: "center" }}>
      <span style={{ color: "#888", fontSize: "13px", marginRight: "5px" }}>Share:</span>
      <a href={shares.twitter} target="_blank" rel="noopener noreferrer" style={btnStyle("#1DA1F2")} title="Twitter">𝕏</a>
      <a href={shares.facebook} target="_blank" rel="noopener noreferrer" style={btnStyle("#4267B2")} title="Facebook">f</a>
      <a href={shares.reddit} target="_blank" rel="noopener noreferrer" style={btnStyle("#FF4500")} title="Reddit">⬆</a>
      <a href={shares.telegram} target="_blank" rel="noopener noreferrer" style={btnStyle("#0088cc")} title="Telegram">✈</a>
      <a href={shares.whatsapp} target="_blank" rel="noopener noreferrer" style={btnStyle("#25D366")} title="WhatsApp">💬</a>
      <a href={shares.pinterest} target="_blank" rel="noopener noreferrer" style={btnStyle("#E60023")} title="Pinterest">P</a>
      <a href={shares.tumblr} target="_blank" rel="noopener noreferrer" style={btnStyle("#35465C")} title="Tumblr">t</a>
      <a href={shares.vk} target="_blank" rel="noopener noreferrer" style={btnStyle("#4C75A3")} title="VK">V</a>
      <a href={shares.email} style={btnStyle("#666")} title="Email">✉</a>
      <button onClick={copyLink} style={{ ...btnStyle("#333"), border: "none", cursor: "pointer" }} title="Copy Link">🔗</button>
    </div>
  );
}

function Footer({ ui, onCompliance }) {
  return (
    <footer style={{ background: '#1a1a1a', padding: '30px 20px', textAlign: 'center', color: '#666', fontSize: '14px', borderTop: '1px solid #333' }}>
      <div style={{ marginBottom: '15px' }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onCompliance(); }} style={{ color: '#888', marginRight: '20px' }}>{ui.compliance}</a>
        <a href="#" onClick={(e) => { e.preventDefault(); onCompliance(); }} style={{ color: '#888', marginRight: '20px' }}>{ui.privacy}</a>
        <a href="#" onClick={(e) => { e.preventDefault(); onCompliance(); }} style={{ color: '#888', marginRight: '20px' }}>{ui.terms}</a>
        <a href="#" onClick={(e) => { e.preventDefault(); onCompliance(); }} style={{ color: '#888', marginRight: '20px' }}>{ui.dmca}</a>
        <a href="#" onClick={(e) => { e.preventDefault(); onCompliance(); }} style={{ color: '#888' }}>{ui.contact}</a>
      </div>
      <p>BoyVue Gallery</p>
      <p style={{ fontSize: '12px' }}>{ui.allModels} {ui.rtaLabel}</p>
      <p style={{ fontSize: '11px', color: '#555' }}>© 2025 BoyVue.com - {ui.allRights}</p>
    </footer>
  );
}

function CompliancePage({ ui, onBack }) {
  return (
    <div style={{ fontFamily: 'Arial', background: '#111', color: '#ccc', minHeight: '100vh' }}>
      <header style={{ background: '#222', padding: '15px 20px', borderBottom: '2px solid #f60' }}>
        <h1 style={{ margin: 0, color: '#f60', cursor: 'pointer' }} onClick={onBack}>BoyVue Gallery</h1>
      </header>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ color: '#f60' }}>{ui.legalCompliance}</h1>
        <section style={{ marginBottom: '40px' }}><h2 style={{ color: '#fff' }}>{ui.statementTitle}</h2><p>{ui.statementText}</p></section>
        <section style={{ marginBottom: '40px' }}><h2 style={{ color: '#fff' }}>{ui.ageVerification}</h2><p>{ui.ageVerificationText}</p></section>
        <section style={{ marginBottom: '40px' }}><h2 style={{ color: '#fff' }}>{ui.contentRemoval}</h2><p>Email: <a href="mailto:dmca@boyvue.com" style={{ color: '#f60' }}>dmca@boyvue.com</a></p></section>
        <button onClick={onBack} style={{ padding: '10px 30px', background: '#f60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{ui.backToGallery}</button>
      </div>
    </div>
  );
}

function App() {
  const [ageVerified, setAgeVerified] = useState(() => localStorage.getItem('ageVerified') === 'true');
  const [lang, setLangState] = useState(() => getLang());
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [stats, setStats] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedCatData, setSelectedCatData] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [comments, setComments] = useState([]);
  const [related, setRelated] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const [newComment, setNewComment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showCompliance, setShowCompliance] = useState(false);
  const [translationData, setTranslationData] = useState(null);
  const [languages, setLanguages] = useState(null);
  const [showHotOrNot, setShowHotOrNot] = useState(false);
  const [showReview, setShowReview] = useState(null); // {slug, name} or null
  
  // Auth hook for login/logout
  const auth = useAuth();

  // Fetch translations from DB on mount and when language changes
  useEffect(() => {
    fetchTranslations(lang).then(data => setTranslationData(data)).catch(() => {});
    fetchLanguages().then(data => setLanguages(data)).catch(() => {});
  }, [lang]);

  const currentTranslation = translationData || getTranslationsSync(lang);
  const ui = currentTranslation?.ui || translations[lang]?.ui || translations.en.ui;
  const meta = currentTranslation?.meta || translations[lang]?.meta || translations.en.meta;
  const ageGateText = currentTranslation?.ageGate || null;

  useEffect(() => {
    if (!localStorage.getItem('lang')) {
      fetch(`${API}/detect-language`).then(r => r.json()).then(data => {
        if (data.lang && translations[data.lang]) { setLang(data.lang); setLangState(data.lang); }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!ageVerified) return;
    const fetchAnalytics = () => {
      fetch(`${API}/analytics`).then(r => r.json()).then(setAnalytics).catch(() => {});
    };
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [ageVerified]);

  const handleAgeAccept = () => { localStorage.setItem('ageVerified', 'true'); setAgeVerified(true); };
  const handleAgeDecline = () => { window.location.href = 'https://www.google.com'; };
  const changeLang = (code) => { setLang(code); setLangState(code); document.title = translations[code].meta.title; };

  // Fetch stats and categories with language
  useEffect(() => {
    if (!ageVerified) return;
    fetch(`${API}/stats`).then(r => r.json()).then(setStats);
    fetch(`${API}/categories?lang=${lang}`).then(r => r.json()).then(d => setCategories(d.categories || []));
    document.title = meta.title;
  }, [ageVerified, lang]);

  // Fetch images with language
  useEffect(() => {
    if (!ageVerified || selectedImage || searchResults || showCompliance) return;
    setLoading(true);
    if (selectedCat) {
      fetch(`${API}/categories/${selectedCat}?lang=${lang}`).then(r => r.json()).then(d => { 
        setSelectedCatData(d.category); 
        setImages(d.images || []); 
        setLoading(false); 
      });
    } else {
      fetch(`${API}/media?page=${page}&limit=12&lang=${lang}`).then(r => r.json()).then(d => { 
        setImages(d.images || []); 
        setTotalPages(d.pagination?.pages || 1); 
        setLoading(false); 
      });
    }
  }, [selectedCat, page, selectedImage, searchResults, showCompliance, ageVerified, lang]);

  if (!ageVerified) return <AgeGate lang={lang} ageGateText={ageGateText} languages={languages || translations} onAccept={handleAgeAccept} onDecline={handleAgeDecline} onLangChange={(code) => { setLang(code); setLangState(code); }} />;

  const selectCategory = (id) => { setSelectedCat(id); setSelectedCatData(null); setSelectedImage(null); setSearchResults(null); setShowCompliance(false); setPage(1); };
  
  const openImage = (img) => { 
    fetch(`${API}/media/${img.id}?lang=${lang}`).then(r => r.json()).then(data => { 
      setSelectedImage(data); 
      setRelated(data.related || []); 
    }); 
    fetch(`${API}/media/${img.id}/comments?lang=${lang}`).then(r => r.json()).then(d => setComments(d.comments || [])); 
  };
  
  const closeImage = () => { setSelectedImage(null); setComments([]); setRelated([]); };
  const saveUsername = (name) => { setUsername(name); localStorage.setItem('username', name); };
  const postComment = async () => { 
    if (!username.trim() || !newComment.trim()) return; 
    const res = await fetch(`${API}/media/${selectedImage.id}/comments`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ username, comment_text: newComment }) 
    }); 
    if (res.ok) { const data = await res.json(); setComments([data.comment, ...comments]); setNewComment(''); } 
  };
  
  const doSearch = async (e) => { 
    e.preventDefault(); 
    if (!searchQuery.trim()) return; 
    const res = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery)}&limit=24&lang=${lang}`); 
    const data = await res.json(); 
    setSearchResults(data); 
    setSelectedImage(null); 
    setSelectedCat(null); 
  };
  
  const clearSearch = () => { setSearchResults(null); setSearchQuery(''); };
  const formatDate = (d) => new Date(d).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' });

  if (showCompliance) return <CompliancePage ui={ui} onBack={() => setShowCompliance(false)} />;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  if (selectedImage) {
    const isVid = isVideo(selectedImage.local_path);
    return (
      <div style={{ fontFamily: 'Arial', background: '#111', color: '#fff', minHeight: '100vh', direction: dir }}>
        <header style={{ background: '#222', padding: '15px 20px', borderBottom: '2px solid #f60', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h1 style={{ margin: 0, color: '#f60', cursor: 'pointer' }} onClick={closeImage}>BoyVue</h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><LanguageSelector lang={lang} onChange={changeLang} /><button onClick={closeImage} style={{ background: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>{ui.backToGallery}</button></div>
        </header>
        <article style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
          <nav style={{ marginBottom: '15px', color: '#888', fontSize: '14px' }}><span style={{ cursor: 'pointer' }} onClick={() => { closeImage(); selectCategory(null); }}>{ui.home}</span>{' > '}<span style={{ cursor: 'pointer' }} onClick={() => { closeImage(); selectCategory(selectedImage.belongs_to_gallery); }}>{selectedImage.category_name}</span>{' > '}<span>{selectedImage.title || ui.untitled}</span></nav>
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '300px' }}>
              {isVid ? <video controls style={{ width: '100%', borderRadius: '8px' }}><source src={`/media/${selectedImage.local_path}`} type="video/mp4" /></video> : <img src={`/media/${selectedImage.local_path}`} alt={selectedImage.title} style={{ width: '100%', borderRadius: '8px' }} />}
              <h1 style={{ marginTop: '15px', fontSize: '24px' }}>{selectedImage.title || ui.untitled}</h1>
              <p style={{ color: '#888' }}>{selectedImage.description}</p>
              <div style={{ color: '#666', fontSize: '14px' }}>{ui.views}: {selectedImage.view_count} | {ui.rating}: {parseFloat(selectedImage.average_rating || 0).toFixed(1)}</div>
              <ShareButtons url={`https://boyvue.com/pics/v/${selectedImage.id}`} title={selectedImage.title} image={`https://boyvue.com/media/${selectedImage.thumbnail_path}`} />
              {selectedImage.keywords?.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <span style={{ color: '#888', fontSize: '12px' }}>Tags: </span>
                  {selectedImage.keywords.slice(0, 10).map((kw, i) => (
                    <span key={i} onClick={() => { setSearchQuery(kw); doSearch({ preventDefault: () => {} }); }} style={{ display: 'inline-block', background: '#333', color: '#ccc', padding: '3px 8px', margin: '2px', borderRadius: '3px', fontSize: '11px', cursor: 'pointer' }}>{kw}</span>
                  ))}
                </div>
              )}
              {related.length > 0 && <div style={{ marginTop: '30px' }}><h3 style={{ color: '#f60' }}>{ui.relatedIn} {selectedImage.category_name}</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>{related.map(r => <div key={r.id} onClick={() => openImage(r)} style={{ cursor: 'pointer' }}><img src={`/media/${r.thumbnail_path}`} alt={r.title} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => { e.target.style.display = 'none'; }} /></div>)}</div></div>}
            </div>
            <aside style={{ flex: 1, minWidth: '280px', background: '#1a1a1a', padding: '20px', borderRadius: '8px', alignSelf: 'flex-start' }}>
              <h3 style={{ color: '#f60', marginTop: 0 }}>{ui.comments} ({comments.length})</h3>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#222', borderRadius: '8px' }}>
                <input type="text" placeholder={ui.yourName} value={username} onChange={(e) => saveUsername(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <textarea placeholder={ui.writeComment} value={newComment} onChange={(e) => setNewComment(e.target.value)} style={{ width: '100%', padding: '10px', height: '80px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', resize: 'none', boxSizing: 'border-box' }} />
                <button onClick={postComment} disabled={!username.trim() || !newComment.trim()} style={{ marginTop: '10px', padding: '10px 20px', background: '#f60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%' }}>{ui.postComment}</button>
              </div>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>{comments.length === 0 ? <p style={{ color: '#666' }}>{ui.noComments}</p> : comments.map(c => <div key={c.id} style={{ padding: '12px', background: '#222', borderRadius: '6px', marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><strong style={{ color: '#f60' }}>{c.username}</strong><span style={{ color: '#666', fontSize: '12px' }}>{formatDate(c.created_at)}</span></div><p style={{ margin: 0, color: '#ccc' }}>{c.comment_text}</p></div>)}</div>
            </aside>
          </div>
        </article>
        <Footer ui={ui} onCompliance={() => { closeImage(); setShowCompliance(true); }} />
      </div>
    );
  }

  const displayImages = searchResults ? searchResults.results : images;
  const currentTitle = searchResults ? `${ui.search}: ${searchQuery}` : (selectedCatData ? selectedCatData.catname : ui.allImages);

  return (
    <div style={{ fontFamily: 'Arial', background: '#111', color: '#fff', minHeight: '100vh', direction: dir }}>
      {showStatsModal && <StatsModal analytics={analytics} onClose={() => setShowStatsModal(false)} />}
      {showReview && <ReviewModal categorySlug={showReview.slug} categoryName={showReview.name} lang={lang} onClose={() => setShowReview(null)} />}
      {auth.showLoginModal && <LoginModal 
        onClose={auth.closeLogin}
        onLoginGoogle={auth.loginWithGoogle}
        onLoginReddit={auth.loginWithReddit}
        onLoginTwitter={auth.loginWithTwitter}
        onLoginEmail={auth.loginWithEmail}
      />}
      {showHotOrNot && <HotOrNot 
        user={auth.user}
        onClose={() => setShowHotOrNot(false)}
        onLoginRequired={auth.openLogin}
      />}
      <header style={{ background: '#222', padding: '20px', borderBottom: '2px solid #f60' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ margin: 0, color: '#f60', cursor: 'pointer' }} onClick={() => { selectCategory(null); clearSearch(); }}>BoyVue Gallery</h1>
            <p style={{ margin: '5px 0 0', color: '#888', cursor: 'pointer' }} onClick={() => setShowStatsModal(true)}>
              <span style={{ color: '#4f4' }}>🟢 {analytics?.live || 0} {ui.online || 'online'}</span>
              {' | '}{stats.images?.toLocaleString() || 0} {ui.images}
              {' | '}{stats.comments?.toLocaleString() || 0} {ui.comments}
              {analytics?.countries?.slice(0, 3).map(c => ` ${countryFlags[c.country] || '🌍'}`).join('')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <form onSubmit={doSearch} style={{ display: 'flex', gap: '10px' }}><input type="text" placeholder={ui.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '10px 15px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', width: '180px' }} /><button type="submit" style={{ padding: '10px 20px', background: '#f60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{ui.search}</button></form>
            <LanguageSelector lang={lang} onChange={changeLang} />
            <button onClick={() => setShowHotOrNot(true)} style={{ padding: '8px 16px', background: 'linear-gradient(145deg, #f60, #c50)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>🔥 Hot or Not</button>
            {auth.isAuthenticated ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {auth.user.avatarUrl && <img src={auth.user.avatarUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />}
                <span style={{ color: '#888', fontSize: '14px' }}>{auth.user.displayName}</span>
                <button onClick={auth.logout} style={{ padding: '6px 12px', background: '#333', color: '#888', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Logout</button>
              </div>
            ) : (
              <button onClick={auth.openLogin} style={{ padding: '8px 16px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Sign In</button>
            )}
            <a href="/admin" rel="nofollow noopener" style={{ color: '#666', fontSize: '12px', textDecoration: 'none', padding: '8px 12px', background: '#222', borderRadius: '4px' }}>Admin</a>
          </div>
        </div>
      </header>
      <div style={{ display: 'flex' }}>
        <aside style={{ width: '250px', background: '#1a1a1a', padding: '20px', minHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          <h2 style={{ color: '#f60', marginTop: 0, fontSize: '18px' }}>{ui.categories}</h2>
          <div onClick={() => { selectCategory(null); clearSearch(); }} style={{ padding: '8px', cursor: 'pointer', background: !selectedCat && !searchResults ? '#333' : 'transparent', marginBottom: '5px', borderRadius: '4px' }}>{ui.allImages}</div>
          {categories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', padding: '8px', cursor: 'pointer', background: selectedCat === cat.id ? '#333' : 'transparent', marginBottom: '5px', borderRadius: '4px', fontSize: '14px' }}>
              <span onClick={() => selectCategory(cat.id)} style={{ flex: 1 }}>{cat.catname} <span style={{ color: '#666' }}>({cat.photo_count})</span></span>
              {cat.has_review && (
                <button onClick={(e) => { e.stopPropagation(); setShowReview({ slug: cat.slug || cat.catname, name: cat.catname }); }} title="View Review" style={{ background: 'transparent', border: 'none', color: '#f60', cursor: 'pointer', padding: '2px 6px', fontSize: '14px', marginLeft: '4px' }}>&#9733;</button>
              )}
            </div>
          ))}
        </aside>
        <main style={{ flex: 1, padding: '20px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <span>{currentTitle}</span>
            {selectedCatData?.has_review && (
              <button onClick={() => setShowReview({ slug: selectedCatData.slug || selectedCatData.catname, name: selectedCatData.catname })} style={{ padding: '6px 12px', background: 'linear-gradient(145deg, #f60, #c50)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '14px' }}>&#9733;</span> View Review
              </button>
            )}
            {searchResults && <button onClick={clearSearch} style={{ padding: '5px 10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{ui.clearSearch}</button>}
          </h2>
          {selectedCatData?.description && <p style={{ color: '#888', marginBottom: '20px' }}>{selectedCatData.description}</p>}
          {loading ? <p>{ui.loading}</p> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                {displayImages.map(img => {
                  const isVid = isVideo(img.local_path);
                  if (isVid) return <VideoThumbnail key={img.id} img={img} ui={ui} onClick={() => openImage(img)} />;
                  return (
                    <article key={img.id} style={{ background: '#222', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', position: 'relative' }} onClick={() => openImage(img)}>
                      <img src={`/media/${img.thumbnail_path}`} alt={img.title || ui.untitled} loading="lazy" style={{ width: '100%', height: '150px', objectFit: 'cover' }} onError={(e) => { e.target.src = `/media/${img.local_path}`; }} />
                      <div style={{ padding: '10px' }}><h3 style={{ margin: 0, fontSize: '12px', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'normal' }}>{img.title || ui.untitled}</h3><p style={{ margin: '5px 0 0', fontSize: '11px', color: '#666' }}>{img.view_count} {ui.views} | {parseFloat(img.average_rating || 0).toFixed(1)} {ui.rating}</p></div>
                    </article>
                  );
                })}
              </div>
              {!searchResults && <nav style={{ marginTop: '30px', textAlign: 'center' }}><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '10px 20px', margin: '0 10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{ui.prev}</button><span style={{ color: '#888' }}>{ui.page} {page} {ui.of} {totalPages.toLocaleString()}</span><button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '10px 20px', margin: '0 10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{ui.next}</button></nav>}
            </>
          )}
        </main>
      </div>
      <Footer ui={ui} onCompliance={() => setShowCompliance(true)} />
    </div>
  );
}

export default App;
