import React, { useState, useEffect } from 'react';

const API = '/api';
const SITE_NAME = 'BoyVue Gallery';
const SITE_URL = 'https://boyvue.com';
const VIDEO_EXTS = ['.mp4', '.webm', '.avi', '.mov', '.wmv', '.flv', '.mkv'];

function isVideo(path) {
  if (!path) return false;
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  return VIDEO_EXTS.includes(ext);
}

function slugify(text) {
  return text?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || '';
}

function updateSEO(seo) {
  document.title = seo.title || SITE_NAME;
  const updateMeta = (name, content, isProperty = false) => {
    const attr = isProperty ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  };
  updateMeta('description', seo.description || 'Free gay photos and videos gallery');
  updateMeta('keywords', (seo.keywords || []).join(', '));
  updateMeta('og:title', seo.title, true);
  updateMeta('og:description', seo.description, true);
  updateMeta('og:type', seo.ogType || 'website', true);
  updateMeta('og:url', SITE_URL + (seo.canonical || ''), true);
  if (seo.ogImage) updateMeta('og:image', SITE_URL + seo.ogImage, true);
}

// Compliance Page Component
function CompliancePage({ onBack }) {
  useEffect(() => {
    updateSEO({ title: 'Legal Compliance - BoyVue', description: '18 U.S.C. 2257 compliance, privacy policy, terms of service, and DMCA information.', canonical: '/compliance' });
  }, []);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', background: '#111', color: '#ccc', minHeight: '100vh' }}>
      <header style={{ background: '#222', padding: '15px 20px', borderBottom: '2px solid #f60', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: '#f60', cursor: 'pointer' }} onClick={onBack}>BoyVue Gallery</h1>
        <button onClick={onBack} style={{ background: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>Back to Gallery</button>
      </header>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ color: '#f60' }}>Legal Compliance</h1>
        
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#fff' }}>18 U.S.C. § 2257 Statement</h2>
          <p>All models, actors, actresses and other persons that appear in any visual depiction of actual or simulated sexual conduct appearing or otherwise contained on this website were over the age of eighteen (18) years at the time of the creation of such depictions.</p>
          <p>All content and images are in full compliance with the requirements of 18 U.S.C. § 2257 and associated regulations.</p>
          <p>The operators of this website are not the primary producer of any of the visual content contained on the website. The original records required pursuant to 18 U.S.C. § 2257 and 28 C.F.R. Part 75 for all materials contained on this website are on file with the respective content owners.</p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#fff' }}>Age Verification</h2>
          <p>This website contains age-restricted materials including nudity and explicit depictions of sexual activity. By entering this site, you certify that:</p>
          <ul>
            <li>You are at least 18 years of age (or the age of majority in your jurisdiction)</li>
            <li>You are accessing this material for personal use only</li>
            <li>You will not permit any minor to access this material</li>
            <li>You are voluntarily choosing to access this material</li>
            <li>Adult content is legal in your jurisdiction</li>
          </ul>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#fff' }}>Content Removal (DMCA)</h2>
          <p>We respect the intellectual property rights of others. If you believe that your copyrighted work has been copied and is accessible on this website in a way that constitutes copyright infringement, please contact us.</p>
          <p>To file a DMCA takedown notice, please provide:</p>
          <ul>
            <li>Identification of the copyrighted work claimed to be infringed</li>
            <li>Identification of the material to be removed (including URL)</li>
            <li>Your contact information (name, address, phone, email)</li>
            <li>A statement of good faith belief</li>
            <li>A statement of accuracy under penalty of perjury</li>
            <li>Your physical or electronic signature</li>
          </ul>
          <p>Contact: <a href="mailto:dmca@boyvue.com" style={{ color: '#f60' }}>dmca@boyvue.com</a></p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#fff' }}>Privacy Policy</h2>
          <p>We collect minimal information necessary to operate this website:</p>
          <ul>
            <li><strong>Cookies:</strong> Used for session management and preferences</li>
            <li><strong>IP Addresses:</strong> Logged for security and abuse prevention</li>
            <li><strong>Comments:</strong> Username and comment text are stored publicly</li>
          </ul>
          <p>We do not sell or share personal information with third parties except as required by law.</p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#fff' }}>Terms of Service</h2>
          <ul>
            <li>You must be 18+ to use this website</li>
            <li>Content is provided for personal, non-commercial use only</li>
            <li>Downloading or redistributing content without permission is prohibited</li>
            <li>We reserve the right to remove content or terminate access at any time</li>
            <li>User-generated content (comments) must not contain illegal material</li>
          </ul>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#fff' }}>RTA Label</h2>
          <p>This site is labeled with the RTA (Restricted to Adults) label for parental filtering.</p>
          <p>Learn more: <a href="https://www.rtalabel.org/" target="_blank" rel="noopener noreferrer" style={{ color: '#f60' }}>www.rtalabel.org</a></p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#fff' }}>Contact</h2>
          <p>Legal: <a href="mailto:legal@boyvue.com" style={{ color: '#f60' }}>legal@boyvue.com</a></p>
          <p>DMCA: <a href="mailto:dmca@boyvue.com" style={{ color: '#f60' }}>dmca@boyvue.com</a></p>
          <p>General: <a href="mailto:contact@boyvue.com" style={{ color: '#f60' }}>contact@boyvue.com</a></p>
        </section>

        <p style={{ color: '#666', fontSize: '12px' }}>Last updated: December 2025</p>
      </div>
    </div>
  );
}

function App() {
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
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [newComment, setNewComment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showCompliance, setShowCompliance] = useState(false);

  useEffect(() => {
    fetch(`${API}/stats`).then(r => r.json()).then(setStats);
    fetch(`${API}/categories`).then(r => r.json()).then(d => setCategories(d.categories || []));
    updateSEO({ title: 'BoyVue Gallery - Free Gay Photos & Videos', description: 'Browse thousands of free gay photos and videos. High quality twink, muscle, and amateur content updated daily.', keywords: ['gay', 'twink', 'photos', 'videos', 'free', 'gallery'], canonical: '/' });
  }, []);

  useEffect(() => {
    if (selectedImage || searchResults || showCompliance) return;
    setLoading(true);
    if (selectedCat) {
      fetch(`${API}/categories/${selectedCat}`).then(r => r.json()).then(d => { setSelectedCatData(d.category); setImages(d.images || []); if (d.seo) updateSEO(d.seo); setLoading(false); });
    } else {
      fetch(`${API}/media?page=${page}&limit=12`).then(r => r.json()).then(d => { setImages(d.images || []); setTotalPages(d.pagination?.pages || 1); setLoading(false); });
    }
  }, [selectedCat, page, selectedImage, searchResults, showCompliance]);

  const selectCategory = (id) => { setSelectedCat(id); setSelectedCatData(null); setSelectedImage(null); setSearchResults(null); setShowCompliance(false); setPage(1); };
  const openImage = (img) => {
    fetch(`${API}/media/${img.id}`).then(r => r.json()).then(data => { setSelectedImage(data); setRelated(data.related || []); if (data.seo) updateSEO(data.seo); });
    fetch(`${API}/media/${img.id}/comments`).then(r => r.json()).then(d => setComments(d.comments || []));
  };
  const closeImage = () => { setSelectedImage(null); setComments([]); setRelated([]); };
  const saveUsername = (name) => { setUsername(name); localStorage.setItem('username', name); };
  const postComment = async () => {
    if (!username.trim() || !newComment.trim()) return;
    const res = await fetch(`${API}/media/${selectedImage.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, comment_text: newComment }) });
    if (res.ok) { const data = await res.json(); setComments([data.comment, ...comments]); setNewComment(''); }
  };
  const doSearch = async (e) => { e.preventDefault(); if (!searchQuery.trim()) return; const res = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery)}&limit=12`); const data = await res.json(); setSearchResults(data); setSelectedImage(null); setSelectedCat(null); setShowCompliance(false); if (data.seo) updateSEO(data.seo); };
  const clearSearch = () => { setSearchResults(null); setSearchQuery(''); };
  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (showCompliance) return <CompliancePage onBack={() => setShowCompliance(false)} />;

  // Image Detail View
  if (selectedImage) {
    const isVid = isVideo(selectedImage.local_path);
    return (
      <div style={{ fontFamily: 'Arial, sans-serif', background: '#111', color: '#fff', minHeight: '100vh' }}>
        <header style={{ background: '#222', padding: '15px 20px', borderBottom: '2px solid #f60', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, color: '#f60', cursor: 'pointer' }} onClick={closeImage}>BoyVue Gallery</h1>
          <button onClick={closeImage} style={{ background: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>Back to Gallery</button>
        </header>
        <article style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
          <nav style={{ marginBottom: '15px', color: '#888', fontSize: '14px' }}>
            <span style={{ cursor: 'pointer' }} onClick={() => { closeImage(); selectCategory(null); }}>Home</span>{' > '}
            <span style={{ cursor: 'pointer' }} onClick={() => { closeImage(); selectCategory(selectedImage.belongs_to_gallery); }}>{selectedImage.category_name}</span>{' > '}
            <span>{selectedImage.title || 'Photo'}</span>
          </nav>
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '300px' }}>
              {isVid ? <video controls style={{ width: '100%', borderRadius: '8px' }}><source src={`/media/${selectedImage.local_path}`} type="video/mp4" /></video> : <img src={`/media/${selectedImage.local_path}`} alt={selectedImage.title} style={{ width: '100%', borderRadius: '8px' }} />}
              <h1 style={{ marginTop: '15px', fontSize: '24px' }}>{selectedImage.title || 'Untitled'}</h1>
              <p style={{ color: '#888' }}>{selectedImage.description}</p>
              <div style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>Views: {selectedImage.view_count} | Rating: {parseFloat(selectedImage.average_rating || 0).toFixed(1)} | Category: <a href="#" onClick={(e) => { e.preventDefault(); closeImage(); selectCategory(selectedImage.belongs_to_gallery); }} style={{ color: '#f60' }}>{selectedImage.category_name}</a></div>
              {selectedImage.tags?.length > 0 && <div style={{ marginBottom: '20px' }}><strong style={{ color: '#888' }}>Tags: </strong>{selectedImage.tags.map((tag, i) => <span key={i} style={{ background: '#333', padding: '3px 8px', borderRadius: '3px', marginRight: '5px', fontSize: '12px', color: '#ccc' }}>{tag}</span>)}</div>}
              {related.length > 0 && <div style={{ marginTop: '30px' }}><h3 style={{ color: '#f60' }}>Related in {selectedImage.category_name}</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>{related.map(r => <div key={r.id} onClick={() => openImage(r)} style={{ cursor: 'pointer' }}><img src={`/media/${r.thumbnail_path}`} alt={r.title} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => { e.target.style.display = 'none'; }} /></div>)}</div></div>}
            </div>
            <aside style={{ flex: 1, minWidth: '280px', background: '#1a1a1a', padding: '20px', borderRadius: '8px', alignSelf: 'flex-start' }}>
              <h3 style={{ color: '#f60', marginTop: 0 }}>Comments ({comments.length})</h3>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#222', borderRadius: '8px' }}>
                <input type="text" placeholder="Your name" value={username} onChange={(e) => saveUsername(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <textarea placeholder="Write a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} style={{ width: '100%', padding: '10px', height: '80px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', resize: 'none', boxSizing: 'border-box' }} />
                <button onClick={postComment} disabled={!username.trim() || !newComment.trim()} style={{ marginTop: '10px', padding: '10px 20px', background: '#f60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%' }}>Post Comment</button>
              </div>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>{comments.length === 0 ? <p style={{ color: '#666' }}>No comments yet.</p> : comments.map(c => <div key={c.id} style={{ padding: '12px', background: '#222', borderRadius: '6px', marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><strong style={{ color: '#f60' }}>{c.username}</strong><span style={{ color: '#666', fontSize: '12px' }}>{formatDate(c.created_at)}</span></div><p style={{ margin: 0, color: '#ccc', whiteSpace: 'pre-wrap' }}>{c.comment_text}</p></div>)}</div>
            </aside>
          </div>
        </article>
        <Footer onCompliance={() => { closeImage(); setShowCompliance(true); }} />
      </div>
    );
  }

  // Gallery View
  const displayImages = searchResults ? searchResults.results : images;
  const currentTitle = searchResults ? `Search: ${searchQuery}` : (selectedCatData ? selectedCatData.catname : 'All Images');

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', background: '#111', color: '#fff', minHeight: '100vh' }}>
      <header style={{ background: '#222', padding: '20px', borderBottom: '2px solid #f60' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ margin: 0, color: '#f60', cursor: 'pointer' }} onClick={() => { selectCategory(null); clearSearch(); }}>BoyVue Gallery</h1>
            <p style={{ margin: '5px 0 0', color: '#888' }}>{stats.images?.toLocaleString() || 0} images | {stats.comments?.toLocaleString() || 0} comments | {stats.users?.toLocaleString() || 0} users</p>
          </div>
          <form onSubmit={doSearch} style={{ display: 'flex', gap: '10px' }}>
            <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '10px 15px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', width: '200px' }} />
            <button type="submit" style={{ padding: '10px 20px', background: '#f60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Search</button>
          </form>
        </div>
      </header>
      <div style={{ display: 'flex' }}>
        <aside style={{ width: '250px', background: '#1a1a1a', padding: '20px', minHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          <h2 style={{ color: '#f60', marginTop: 0, fontSize: '18px' }}>Categories</h2>
          <nav>
            <div onClick={() => { selectCategory(null); clearSearch(); }} style={{ padding: '8px', cursor: 'pointer', background: !selectedCat && !searchResults ? '#333' : 'transparent', marginBottom: '5px', borderRadius: '4px' }}>All Images</div>
            {categories.map(cat => <div key={cat.id} onClick={() => selectCategory(cat.id)} style={{ padding: '8px', cursor: 'pointer', background: selectedCat === cat.id ? '#333' : 'transparent', marginBottom: '5px', borderRadius: '4px', fontSize: '14px' }}>{cat.catname} <span style={{ color: '#666' }}>({cat.photo_count})</span></div>)}
          </nav>
        </aside>
        <main style={{ flex: 1, padding: '20px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px' }}>{currentTitle}{searchResults && <button onClick={clearSearch} style={{ marginLeft: '15px', padding: '5px 10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Clear</button>}</h2>
          {selectedCatData?.description && <p style={{ color: '#888', marginBottom: '20px' }}>{selectedCatData.description}</p>}
          {loading ? <p>Loading...</p> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                {displayImages.map(img => {
                  const isVid = isVideo(img.local_path);
                  return (
                    <article key={img.id} style={{ background: '#222', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', position: 'relative' }} onClick={() => openImage(img)}>
                      {isVid ? <div style={{ width: '100%', height: '150px', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '48px' }}>▶</span></div> : <img src={`/media/${img.thumbnail_path}`} alt={img.title || 'Image'} loading="lazy" style={{ width: '100%', height: '150px', objectFit: 'cover' }} onError={(e) => { e.target.src = `/media/${img.local_path}`; }} />}
                      {isVid && <span style={{ position: 'absolute', top: '5px', right: '5px', background: '#f60', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '10px' }}>VIDEO</span>}
                      <div style={{ padding: '10px' }}><h3 style={{ margin: 0, fontSize: '12px', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'normal' }}>{img.title || 'Untitled'}</h3><p style={{ margin: '5px 0 0', fontSize: '11px', color: '#666' }}>{img.view_count} views | {parseFloat(img.average_rating || 0).toFixed(1)} rating</p></div>
                    </article>
                  );
                })}
              </div>
              {!searchResults && <nav style={{ marginTop: '30px', textAlign: 'center' }}><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '10px 20px', margin: '0 10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Prev</button><span style={{ color: '#888' }}>Page {page} of {totalPages.toLocaleString()}</span><button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '10px 20px', margin: '0 10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Next</button></nav>}
            </>
          )}
        </main>
      </div>
      <Footer onCompliance={() => setShowCompliance(true)} />
    </div>
  );
}

function Footer({ onCompliance }) {
  return (
    <footer style={{ background: '#1a1a1a', padding: '30px 20px', textAlign: 'center', color: '#666', fontSize: '14px', borderTop: '1px solid #333' }}>
      <div style={{ marginBottom: '15px' }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onCompliance(); }} style={{ color: '#888', marginRight: '20px' }}>18 U.S.C. 2257</a>
        <a href="#" onClick={(e) => { e.preventDefault(); onCompliance(); }} style={{ color: '#888', marginRight: '20px' }}>Privacy Policy</a>
        <a href="#" onClick={(e) => { e.preventDefault(); onCompliance(); }} style={{ color: '#888', marginRight: '20px' }}>Terms of Service</a>
        <a href="#" onClick={(e) => { e.preventDefault(); onCompliance(); }} style={{ color: '#888', marginRight: '20px' }}>DMCA</a>
        <a href="#" onClick={(e) => { e.preventDefault(); onCompliance(); }} style={{ color: '#888' }}>Contact</a>
      </div>
      <p>BoyVue Gallery - Free Gay Photos & Videos</p>
      <p style={{ fontSize: '12px' }}>All models were 18 years of age or older at the time of depiction. This site is labeled with the RTA label.</p>
      <p style={{ fontSize: '11px', color: '#555' }}>© 2025 BoyVue.com - All Rights Reserved</p>
    </footer>
  );
}

export default App;
