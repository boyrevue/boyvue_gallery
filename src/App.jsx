import React, { useState, useEffect, useRef } from 'react';
import { translations, getLang, setLang } from './i18n.js';

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

const ageGateText = {
  en: { title: 'Age Verification Required', warning: 'This website contains adult content', question: 'Are you 18 years or older?', yes: 'Yes, I am 18+', no: 'No, Exit', disclaimer: 'By entering, you confirm you are at least 18 years old.' },
  de: { title: 'Altersverifikation', warning: 'Erwachseneninhalte', question: 'Sind Sie 18+?', yes: 'Ja', no: 'Nein', disclaimer: 'Mit Eintritt bestätigen Sie 18+ zu sein.' },
  ru: { title: 'Проверка возраста', warning: 'Контент для взрослых', question: 'Вам 18+?', yes: 'Да', no: 'Нет', disclaimer: 'Входя, вы подтверждаете что вам 18+.' },
  es: { title: 'Verificación de edad', warning: 'Contenido adulto', question: '¿Tienes 18+?', yes: 'Sí', no: 'No', disclaimer: 'Al entrar confirmas tener 18+.' },
  zh: { title: '年龄验证', warning: '成人内容', question: '您满18岁了吗？', yes: '是', no: '否', disclaimer: '进入即确认已满18岁。' },
  ja: { title: '年齢確認', warning: '成人向け', question: '18歳以上ですか？', yes: 'はい', no: 'いいえ', disclaimer: '入場で18歳以上を確認。' },
  th: { title: 'ยืนยันอายุ', warning: 'เนื้อหาผู้ใหญ่', question: 'คุณอายุ 18+?', yes: 'ใช่', no: 'ไม่', disclaimer: 'การเข้าชมยืนยัน 18+' },
  ko: { title: '나이 확인', warning: '성인 콘텐츠', question: '18세 이상?', yes: '예', no: '아니오', disclaimer: '입장 시 18세 이상 확인.' },
  pt: { title: 'Verificação de idade', warning: 'Conteúdo adulto', question: 'Tem 18+?', yes: 'Sim', no: 'Não', disclaimer: 'Ao entrar confirma ter 18+.' },
  fr: { title: 'Vérification d\'âge', warning: 'Contenu adulte', question: '18+?', yes: 'Oui', no: 'Non', disclaimer: 'En entrant vous confirmez avoir 18+.' },
  it: { title: 'Verifica età', warning: 'Contenuto adulti', question: 'Hai 18+?', yes: 'Sì', no: 'No', disclaimer: 'Entrando confermi 18+.' },
  nl: { title: 'Leeftijdscheck', warning: 'Volwassen inhoud', question: '18+?', yes: 'Ja', no: 'Nee', disclaimer: 'Door te betreden bevestig je 18+.' },
  pl: { title: 'Weryfikacja wieku', warning: 'Treści dla dorosłych', question: '18+?', yes: 'Tak', no: 'Nie', disclaimer: 'Wchodząc potwierdzasz 18+.' },
  cs: { title: 'Ověření věku', warning: 'Obsah pro dospělé', question: '18+?', yes: 'Ano', no: 'Ne', disclaimer: 'Vstupem potvrzuješ 18+.' },
  ar: { title: 'التحقق من العمر', warning: 'محتوى للبالغين', question: '18+؟', yes: 'نعم', no: 'لا', disclaimer: 'بالدخول تؤكد 18+.' },
  el: { title: 'Επαλήθευση ηλικίας', warning: 'Περιεχόμενο ενηλίκων', question: '18+;', yes: 'Ναι', no: 'Όχι', disclaimer: 'Εισερχόμενοι επιβεβαιώνετε 18+.' },
  vi: { title: 'Xác minh tuổi', warning: 'Nội dung người lớn', question: '18+?', yes: 'Có', no: 'Không', disclaimer: 'Khi vào bạn xác nhận 18+.' },
  id: { title: 'Verifikasi usia', warning: 'Konten dewasa', question: '18+?', yes: 'Ya', no: 'Tidak', disclaimer: 'Dengan masuk konfirmasi 18+.' },
  tr: { title: 'Yaş doğrulama', warning: 'Yetişkin içerik', question: '18+?', yes: 'Evet', no: 'Hayır', disclaimer: 'Girerek 18+ onaylarsınız.' },
  hu: { title: 'Életkor ellenőrzés', warning: 'Felnőtt tartalom', question: '18+?', yes: 'Igen', no: 'Nem', disclaimer: 'Belépéssel megerősíted 18+.' }
};

function AgeGate({ lang, onAccept, onDecline, onLangChange }) {
  const text = ageGateText[lang] || ageGateText.en;
  const isRtl = lang === 'ar';
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
          {Object.keys(translations).map(code => (
            <button key={code} onClick={() => onLangChange(code)} style={{ background: lang === code ? '#f60' : '#333', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }} title={translations[code].name}>{translations[code].flag}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Video thumbnail component with rotating preview
function VideoThumbnail({ img, ui, onClick }) {
  const [thumbs, setThumbs] = useState([]);
  const [currentThumb, setCurrentThumb] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Fetch video thumbnails
    fetch(`${API}/video-thumbs/${img.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.thumbs && data.thumbs.length > 0) {
          setThumbs(data.thumbs);
        }
      })
      .catch(() => {});
  }, [img.id]);

  useEffect(() => {
    if (isHovering && thumbs.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentThumb(prev => (prev + 1) % thumbs.length);
      }, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setCurrentThumb(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHovering, thumbs.length]);

  const hasRotatingThumbs = thumbs.length > 0;
  const displayThumb = hasRotatingThumbs ? thumbs[currentThumb] : null;

  return (
    <article 
      style={{ background: '#222', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', position: 'relative' }} 
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div style={{ width: '100%', height: '150px', background: '#333', position: 'relative', overflow: 'hidden' }}>
        {hasRotatingThumbs ? (
          <img 
            src={displayThumb} 
            alt={img.title || ui.untitled} 
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.3s' }} 
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '48px' }}>▶</span>
          </div>
        )}
        {/* Progress dots */}
        {isHovering && thumbs.length > 1 && (
          <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px' }}>
            {thumbs.map((_, i) => (
              <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === currentThumb ? '#f60' : 'rgba(255,255,255,0.5)' }} />
            ))}
          </div>
        )}
        {/* Play icon overlay */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: isHovering ? 1 : 0.7, transition: 'opacity 0.3s' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(0,0,0,0.7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '20px', marginLeft: '3px' }}>▶</span>
          </div>
        </div>
      </div>
      <span style={{ position: 'absolute', top: '5px', right: '5px', background: '#f60', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '10px' }}>{ui.video}</span>
      <div style={{ padding: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '12px', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'normal' }}>{img.title || ui.untitled}</h3>
        <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#666' }}>{img.view_count} {ui.views} | {parseFloat(img.average_rating || 0).toFixed(1)} {ui.rating}</p>
      </div>
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

  const ui = translations[lang]?.ui || translations.en.ui;
  const meta = translations[lang]?.meta || translations.en.meta;

  useEffect(() => {
    if (!localStorage.getItem('lang')) {
      fetch(`${API}/detect-language`).then(r => r.json()).then(data => {
        if (data.lang && translations[data.lang]) { setLang(data.lang); setLangState(data.lang); }
      }).catch(() => {});
    }
  }, []);

  const handleAgeAccept = () => { localStorage.setItem('ageVerified', 'true'); setAgeVerified(true); };
  const handleAgeDecline = () => { window.location.href = 'https://www.google.com'; };
  const changeLang = (code) => { setLang(code); setLangState(code); document.title = translations[code].meta.title; };

  useEffect(() => {
    if (!ageVerified) return;
    fetch(`${API}/stats`).then(r => r.json()).then(setStats);
    fetch(`${API}/categories`).then(r => r.json()).then(d => setCategories(d.categories || []));
    document.title = meta.title;
  }, [ageVerified]);

  useEffect(() => {
    if (!ageVerified || selectedImage || searchResults || showCompliance) return;
    setLoading(true);
    if (selectedCat) {
      fetch(`${API}/categories/${selectedCat}`).then(r => r.json()).then(d => { setSelectedCatData(d.category); setImages(d.images || []); setLoading(false); });
    } else {
      fetch(`${API}/media?page=${page}&limit=12`).then(r => r.json()).then(d => { setImages(d.images || []); setTotalPages(d.pagination?.pages || 1); setLoading(false); });
    }
  }, [selectedCat, page, selectedImage, searchResults, showCompliance, ageVerified]);

  if (!ageVerified) return <AgeGate lang={lang} onAccept={handleAgeAccept} onDecline={handleAgeDecline} onLangChange={(code) => { setLang(code); setLangState(code); }} />;

  const selectCategory = (id) => { setSelectedCat(id); setSelectedCatData(null); setSelectedImage(null); setSearchResults(null); setShowCompliance(false); setPage(1); };
  const openImage = (img) => { fetch(`${API}/media/${img.id}`).then(r => r.json()).then(data => { setSelectedImage(data); setRelated(data.related || []); }); fetch(`${API}/media/${img.id}/comments`).then(r => r.json()).then(d => setComments(d.comments || [])); };
  const closeImage = () => { setSelectedImage(null); setComments([]); setRelated([]); };
  const saveUsername = (name) => { setUsername(name); localStorage.setItem('username', name); };
  const postComment = async () => { if (!username.trim() || !newComment.trim()) return; const res = await fetch(`${API}/media/${selectedImage.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, comment_text: newComment }) }); if (res.ok) { const data = await res.json(); setComments([data.comment, ...comments]); setNewComment(''); } };
  const doSearch = async (e) => { e.preventDefault(); if (!searchQuery.trim()) return; const res = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery)}&limit=12`); const data = await res.json(); setSearchResults(data); setSelectedImage(null); setSelectedCat(null); };
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
      <header style={{ background: '#222', padding: '20px', borderBottom: '2px solid #f60' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div><h1 style={{ margin: 0, color: '#f60', cursor: 'pointer' }} onClick={() => { selectCategory(null); clearSearch(); }}>BoyVue Gallery</h1><p style={{ margin: '5px 0 0', color: '#888' }}>{stats.images?.toLocaleString() || 0} {ui.images} | {stats.comments?.toLocaleString() || 0} {ui.comments} | {stats.users?.toLocaleString() || 0} {ui.users}</p></div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <form onSubmit={doSearch} style={{ display: 'flex', gap: '10px' }}><input type="text" placeholder={ui.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '10px 15px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', width: '180px' }} /><button type="submit" style={{ padding: '10px 20px', background: '#f60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{ui.search}</button></form>
            <LanguageSelector lang={lang} onChange={changeLang} />
          </div>
        </div>
      </header>
      <div style={{ display: 'flex' }}>
        <aside style={{ width: '250px', background: '#1a1a1a', padding: '20px', minHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          <h2 style={{ color: '#f60', marginTop: 0, fontSize: '18px' }}>{ui.categories}</h2>
          <div onClick={() => { selectCategory(null); clearSearch(); }} style={{ padding: '8px', cursor: 'pointer', background: !selectedCat && !searchResults ? '#333' : 'transparent', marginBottom: '5px', borderRadius: '4px' }}>{ui.allImages}</div>
          {categories.map(cat => <div key={cat.id} onClick={() => selectCategory(cat.id)} style={{ padding: '8px', cursor: 'pointer', background: selectedCat === cat.id ? '#333' : 'transparent', marginBottom: '5px', borderRadius: '4px', fontSize: '14px' }}>{cat.catname} <span style={{ color: '#666' }}>({cat.photo_count})</span></div>)}
        </aside>
        <main style={{ flex: 1, padding: '20px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px' }}>{currentTitle}{searchResults && <button onClick={clearSearch} style={{ marginLeft: '15px', padding: '5px 10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{ui.clearSearch}</button>}</h2>
          {selectedCatData?.description && <p style={{ color: '#888', marginBottom: '20px' }}>{selectedCatData.description}</p>}
          {loading ? <p>{ui.loading}</p> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                {displayImages.map(img => {
                  const isVid = isVideo(img.local_path);
                  if (isVid) {
                    return <VideoThumbnail key={img.id} img={img} ui={ui} onClick={() => openImage(img)} />;
                  }
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
