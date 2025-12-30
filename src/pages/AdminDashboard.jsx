import React, { useState, useEffect } from 'react';

const API_BASE = '/api/admin';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard data
  const [searchEngines, setSearchEngines] = useState({ summary: [], trends: [] });
  const [landingPages, setLandingPages] = useState([]);
  const [geoData, setGeoData] = useState([]);
  const [contentStats, setContentStats] = useState({});
  const [seoStatus, setSeoStatus] = useState({ sitemaps: [], vocabularies: [] });
  const [days, setDays] = useState(30);

  // New features
  const [searchTerms, setSearchTerms] = useState({ engines: {} });
  const [vocabulary, setVocabulary] = useState({ concepts: [], topConcepts: [] });
  const [serpPreviews, setSerpPreviews] = useState({ previews: [] });
  const [serpPageType, setSerpPageType] = useState('home');
  const [serpCategory, setSerpCategory] = useState('Twink');
  const [serpI18n, setSerpI18n] = useState({ byRegion: [], byLanguage: [], queriesByRegion: {} });
  const [archivedTerms, setArchivedTerms] = useState({ summary: {}, by_language: {}, by_type: {}, term_status: {} });
  const [termFilter, setTermFilter] = useState('all'); // all, pending, relevant, ignored
  const [seoModels, setSeoModels] = useState([]);
  const [seoWebsites, setSeoWebsites] = useState([]);
  const [i18nTerms, setI18nTerms] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0, keyword: '' });
  const [activeTab, setActiveTab] = useState('overview');
  const [competitorKeywords, setCompetitorKeywords] = useState([]);
  const [fetchingKeywords, setFetchingKeywords] = useState(false);
  const [dataForSeoBalance, setDataForSeoBalance] = useState(null);

  useEffect(() => {
    if (token) {
      checkAuth();
    }
  }, [token]);

  const checkAuth = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`, {
        headers: { 'X-Admin-Token': token }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        loadDashboardData();
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem('adminToken');
      }
    } catch {
      setIsAuthenticated(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        localStorage.setItem('adminToken', data.token);
        setIsAuthenticated(true);
        loadDashboardData();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Connection error');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: { 'X-Admin-Token': token }
    });
    setToken('');
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
  };

  const loadDashboardData = async () => {
    const headers = { 'X-Admin-Token': token };

    try {
      const [seRes, lpRes, geoRes, statsRes, seoRes] = await Promise.all([
        fetch(`${API_BASE}/analytics/search-engines?days=${days}`, { headers }),
        fetch(`${API_BASE}/analytics/landing-pages?days=${days}&limit=20`, { headers }),
        fetch(`${API_BASE}/analytics/geo?days=${days}`, { headers }),
        fetch(`${API_BASE}/stats/content`, { headers }),
        fetch(`${API_BASE}/seo/status`, { headers })
      ]);

      setSearchEngines(await seRes.json());
      setLandingPages((await lpRes.json()).pages || []);
      setGeoData((await geoRes.json()).countries || []);
      setContentStats(await statsRes.json());
      setSeoStatus(await seoRes.json());
    } catch (err) {
      console.error('Error loading dashboard:', err);
    }
  };

  const regenerateSitemaps = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/seo/regenerate-sitemaps`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      if (data.success) {
        alert('Sitemaps regenerated successfully!');
        loadDashboardData();
      } else {
        alert('Error: ' + data.error);
      }
    } catch {
      alert('Error regenerating sitemaps');
    }
    setLoading(false);
  };

  const regenerateKeywords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/seo/regenerate-keywords`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      if (data.success) {
        alert('SEO keywords regenerated successfully!');
        loadDashboardData();
      } else {
        alert('Error: ' + data.error);
      }
    } catch {
      alert('Error regenerating keywords');
    }
    setLoading(false);
  };

  // Load vocabulary data
  const loadVocabulary = async () => {
    try {
      const res = await fetch(`${API_BASE}/seo/vocabulary`, {
        headers: { 'X-Admin-Token': token }
      });
      setVocabulary(await res.json());
    } catch (err) {
      console.error('Error loading vocabulary:', err);
    }
  };

  // Load SERP previews
  const loadSerpPreviews = async () => {
    try {
      const params = new URLSearchParams({
        pageType: serpPageType,
        category: serpCategory
      });
      const res = await fetch(`${API_BASE}/seo/serp-preview?${params}`, {
        headers: { 'X-Admin-Token': token }
      });
      setSerpPreviews(await res.json());
    } catch (err) {
      console.error('Error loading SERP previews:', err);
    }
  };

  // Load search terms from logs
  const loadSearchTerms = async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics/log-search-terms`, {
        headers: { 'X-Admin-Token': token }
      });
      setSearchTerms(await res.json());
    } catch (err) {
      console.error('Error loading search terms:', err);
    }
  };

  // Load SERP i18n data
  const loadSerpI18n = async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics/serp-i18n?days=${days}`, {
        headers: { 'X-Admin-Token': token }
      });
      setSerpI18n(await res.json());
    } catch (err) {
      console.error('Error loading SERP i18n:', err);
    }
  };

  const loadArchivedTerms = async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics/archived-search-terms`, {
        headers: { 'X-Admin-Token': token }
      });
      setArchivedTerms(await res.json());
    } catch (err) {
      console.error('Error loading archived terms:', err);
    }
  };

  const updateTermStatus = async (term, language, status, category = null) => {
    try {
      await fetch(`${API_BASE}/analytics/term-status`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, language, status, category })
      });
      // Update local state
      setArchivedTerms(prev => ({
        ...prev,
        term_status: {
          ...prev.term_status,
          [term]: {
            status,
            translation: prev.term_status?.[term]?.translation,
            category: category || prev.term_status?.[term]?.category
          }
        }
      }));
    } catch (err) {
      console.error('Error updating term status:', err);
    }
  };

  const translateTerm = async (term, language) => {
    try {
      const res = await fetch(`${API_BASE}/analytics/translate?term=${encodeURIComponent(term)}&from=${language}`, {
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      if (data.translation) {
        // Update local state with translation
        setArchivedTerms(prev => ({
          ...prev,
          term_status: {
            ...prev.term_status,
            [term]: { ...prev.term_status?.[term], translation: data.translation }
          }
        }));
        return data.translation;
      }
    } catch (err) {
      console.error('Translation error:', err);
    }
    return null;
  };

  const loadEntities = async () => {
    try {
      const [modelsRes, websitesRes] = await Promise.all([
        fetch(`${API_BASE}/seo/models`, { headers: { 'X-Admin-Token': token } }),
        fetch(`${API_BASE}/seo/websites-full`, { headers: { 'X-Admin-Token': token } })
      ]);
      const modelsData = await modelsRes.json();
      const websitesData = await websitesRes.json();
      setSeoModels(Array.isArray(modelsData) ? modelsData : []);
      setSeoWebsites(Array.isArray(websitesData) ? websitesData : []);
    } catch (err) {
      console.error('Error loading entities:', err);
      setSeoModels([]);
      setSeoWebsites([]);
    }
  };

  const toggleModelFeatured = async (id, featured) => {
    try {
      await fetch(`${API_BASE}/seo/models/${id}/feature`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured })
      });
      setSeoModels(prev => prev.map(m => m.id === id ? { ...m, featured } : m));
    } catch (err) {
      console.error('Error updating model:', err);
    }
  };

  const toggleWebsiteFeatured = async (id, featured) => {
    try {
      await fetch(`${API_BASE}/seo/websites/${id}/feature`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured })
      });
      setSeoWebsites(prev => prev.map(w => w.id === id ? { ...w, featured } : w));
    } catch (err) {
      console.error('Error updating website:', err);
    }
  };

  const loadI18nTerms = async () => {
    try {
      const res = await fetch(`${API_BASE}/seo/i18n-terms`, {
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      setI18nTerms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading i18n terms:', err);
      setI18nTerms([]);
    }
  };

  const translateNewKeyword = async () => {
    if (!newKeyword.trim()) return;

    // Split by comma and filter empty strings
    const keywords = newKeyword.split(',').map(k => k.trim()).filter(k => k.length > 0);
    if (keywords.length === 0) return;

    setTranslating(true);
    const results = { success: [], failed: [] };

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      setTranslationProgress({ current: i + 1, total: keywords.length, keyword });

      try {
        const res = await fetch(`${API_BASE}/seo/translate-term`, {
          method: 'POST',
          headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ term: keyword, category: 'keyword' })
        });
        const data = await res.json();
        if (data.translations && Object.keys(data.translations).length > 0) {
          results.success.push(data.term);
        } else {
          results.failed.push(keyword);
          console.error('Translation failed for:', keyword, data);
        }
      } catch (err) {
        results.failed.push(keyword);
        console.error('Error translating:', keyword, err);
      }
    }

    // Show summary
    if (results.success.length > 0 && results.failed.length === 0) {
      alert(`Successfully translated ${results.success.length} keyword(s):\n${results.success.join(', ')}`);
    } else if (results.success.length > 0 && results.failed.length > 0) {
      alert(`Translated ${results.success.length} keyword(s), ${results.failed.length} failed.\n\nSuccess: ${results.success.join(', ')}\n\nFailed: ${results.failed.join(', ')}`);
    } else {
      alert(`All ${results.failed.length} keyword(s) failed to translate. Check console for details.`);
    }

    setNewKeyword('');
    setTranslationProgress({ current: 0, total: 0, keyword: '' });
    setTranslating(false);
    loadI18nTerms();
  };

  // Delete a keyword
  const deleteKeyword = async (term) => {
    if (!confirm(`Delete "${term}" and all its translations?`)) return;
    try {
      const res = await fetch(`${API_BASE}/seo/i18n-terms/${encodeURIComponent(term)}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      if (data.success) {
        loadI18nTerms();
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error deleting keyword: ' + err.message);
    }
  };

  // Edit a keyword (update English term)
  const editKeyword = async (oldTerm, newTerm) => {
    if (!newTerm.trim() || oldTerm === newTerm) return;
    try {
      // Delete old term and create new one with translations
      await fetch(`${API_BASE}/seo/i18n-terms/${encodeURIComponent(oldTerm)}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Token': token }
      });
      // Translate the new term
      await fetch(`${API_BASE}/seo/translate-term`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: newTerm.trim(), category: 'keyword' })
      });
      loadI18nTerms();
    } catch (err) {
      alert('Error updating keyword: ' + err.message);
    }
  };

  // Make keyword safe by prefixing with "18+ " or "adult "
  const makeSafe = async (term) => {
    const safePrefix = '18+ ';
    if (term.startsWith('18+') || term.startsWith('adult')) {
      alert('Term already has safety prefix');
      return;
    }
    const safeTerm = safePrefix + term;
    if (confirm(`Change "${term}" to "${safeTerm}"?`)) {
      setTranslating(true);
      try {
        // Delete old term
        await fetch(`${API_BASE}/seo/i18n-terms/${encodeURIComponent(term)}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Token': token }
        });
        // Create new safe term with translations
        const res = await fetch(`${API_BASE}/seo/translate-term`, {
          method: 'POST',
          headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ term: safeTerm, category: 'keyword' })
        });
        const data = await res.json();
        if (data.translations) {
          alert(`Updated to "${safeTerm}" with ${Object.keys(data.translations).length} translations`);
        }
        loadI18nTerms();
      } catch (err) {
        alert('Error: ' + err.message);
      }
      setTranslating(false);
    }
  };

  // Retranslate missing languages for a term
  const retranslateKeyword = async (term, category) => {
    setTranslating(true);
    try {
      const res = await fetch(`${API_BASE}/seo/i18n-terms/${encodeURIComponent(term)}/retranslate`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      const data = await res.json();
      if (data.added > 0) {
        alert(`Added ${data.added} new translations for "${term}"`);
        loadI18nTerms();
      } else {
        alert('No new translations added (all languages already covered or translation failed)');
      }
    } catch (err) {
      alert('Error retranslating: ' + err.message);
    }
    setTranslating(false);
  };

  // Load extra data when tab changes
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    if (activeTab === 'vocabulary') loadVocabulary();
    if (activeTab === 'serp') loadSerpPreviews();
    if (activeTab === 'search-terms') loadSearchTerms();
    if (activeTab === 'serp-i18n') loadSerpI18n();
    if (activeTab === 'i18n') loadI18nTerms();
    if (activeTab === 'entities') loadEntities();
  }, [activeTab, isAuthenticated, token, serpPageType, serpCategory, days]);

  // Integration functions
  const submitSitemapsToGoogle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/integrations/google/submit-all-sitemaps`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      alert(data.message || 'Sitemaps submitted!');
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setLoading(false);
  };

  const purgeCloudflareSitemaps = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/integrations/cloudflare/purge-sitemaps`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        alert('Cloudflare cache purged for sitemaps!');
      } else {
        alert('Error: ' + (data.error || 'Failed to purge'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setLoading(false);
  };

  const testCloudflare = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrations/cloudflare/test`, {
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      alert(data.success ? 'Cloudflare connected!' : 'Connection failed: ' + data.error);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginBox}>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dashboard}>
      <header style={styles.header}>
        <h1>BoyVue Admin Dashboard</h1>
        <div>
          <select value={days} onChange={(e) => { setDays(e.target.value); }} style={styles.select}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button onClick={loadDashboardData} style={styles.buttonSmall}>Refresh</button>
          <button onClick={handleLogout} style={styles.buttonSmall}>Logout</button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div style={styles.tabs}>
        {['overview', 'search-terms', 'serp-i18n', 'i18n', 'entities', 'vocabulary', 'serp'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              background: activeTab === tab ? '#f60' : '#333',
              color: activeTab === tab ? '#fff' : '#888'
            }}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'search-terms' && 'Search Terms'}
            {tab === 'serp-i18n' && 'SERP by Region'}
            {tab === 'i18n' && 'i18n Keywords'}
            {tab === 'entities' && 'Models & Sites'}
            {tab === 'vocabulary' && 'Vocabulary'}
            {tab === 'serp' && 'SERP Preview'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
      <div style={styles.grid}>
        {/* Content Stats */}
        <div style={styles.card}>
          <h3>Content Statistics</h3>
          <div style={styles.statGrid}>
            <div style={styles.stat}>
              <span style={styles.statValue}>{contentStats.photos?.toLocaleString() || 0}</span>
              <span style={styles.statLabel}>Photos</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>{contentStats.videos?.toLocaleString() || 0}</span>
              <span style={styles.statLabel}>Videos</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>{contentStats.categories?.toLocaleString() || 0}</span>
              <span style={styles.statLabel}>Categories</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>{contentStats.totalViews?.toLocaleString() || 0}</span>
              <span style={styles.statLabel}>Total Views</span>
            </div>
          </div>
        </div>

        {/* Search Engine Traffic */}
        <div style={styles.card}>
          <h3>Search Engine Traffic (Last {days} days)</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Search Engine</th>
                <th>Hits</th>
                <th>Unique IPs</th>
              </tr>
            </thead>
            <tbody>
              {searchEngines.summary?.map((se, i) => (
                <tr key={i}>
                  <td>{se.search_engine}</td>
                  <td>{parseInt(se.hits).toLocaleString()}</td>
                  <td>{parseInt(se.unique_visitors).toLocaleString()}</td>
                </tr>
              ))}
              {(!searchEngines.summary || searchEngines.summary.length === 0) && (
                <tr><td colSpan="3" style={{ textAlign: 'center', color: '#888' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Top Landing Pages */}
        <div style={styles.card}>
          <h3>Top Landing Pages (from Search)</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Page</th>
                <th>Hits</th>
              </tr>
            </thead>
            <tbody>
              {landingPages.slice(0, 10).map((p, i) => (
                <tr key={i}>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.path}
                  </td>
                  <td>{parseInt(p.hits).toLocaleString()}</td>
                </tr>
              ))}
              {landingPages.length === 0 && (
                <tr><td colSpan="2" style={{ textAlign: 'center', color: '#888' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Geographic Distribution */}
        <div style={styles.card}>
          <h3>Geographic Distribution</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Country</th>
                <th>Hits</th>
              </tr>
            </thead>
            <tbody>
              {geoData.slice(0, 10).map((c, i) => (
                <tr key={i}>
                  <td>{c.country}</td>
                  <td>{parseInt(c.hits).toLocaleString()}</td>
                </tr>
              ))}
              {geoData.length === 0 && (
                <tr><td colSpan="2" style={{ textAlign: 'center', color: '#888' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* SEO Status */}
        <div style={{ ...styles.card, gridColumn: 'span 2' }}>
          <h3>SEO Status</h3>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
            <button onClick={regenerateSitemaps} disabled={loading} style={styles.actionButton}>
              Regenerate Sitemaps
            </button>
            <button onClick={regenerateKeywords} disabled={loading} style={styles.actionButton}>
              Regenerate Keywords
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h4>Sitemaps</h4>
              <table style={styles.table}>
                <thead>
                  <tr><th>File</th><th>Size</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {seoStatus.sitemaps?.map((s, i) => (
                    <tr key={i}>
                      <td>{s.file}</td>
                      <td>{s.exists ? `${(s.size / 1024).toFixed(1)} KB` : '-'}</td>
                      <td style={{ color: s.exists ? '#4f4' : '#f44' }}>
                        {s.exists ? 'OK' : 'Missing'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h4>Vocabulary Files</h4>
              <table style={styles.table}>
                <thead>
                  <tr><th>File</th><th>Size</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {seoStatus.vocabularies?.map((v, i) => (
                    <tr key={i}>
                      <td>{v.file}</td>
                      <td>{v.exists ? `${(v.size / 1024).toFixed(1)} KB` : '-'}</td>
                      <td style={{ color: v.exists ? '#4f4' : '#f44' }}>
                        {v.exists ? 'OK' : 'Missing'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: '15px' }}>
            <strong>Supported Languages:</strong> {seoStatus.languages?.join(', ')}
          </div>
        </div>

        {/* Integrations Panel */}
        <div style={{ ...styles.card, gridColumn: 'span 2' }}>
          <h3>API Integrations</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Google Search Console */}
            <div style={{ background: '#222', padding: '20px', borderRadius: '8px' }}>
              <h4 style={{ color: '#4285f4', marginTop: 0 }}>Google & Bing</h4>
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '15px' }}>
                Submit sitemaps to Google and Bing for indexing
              </p>
              <button
                onClick={submitSitemapsToGoogle}
                disabled={loading}
                style={{ ...styles.actionButton, background: '#4285f4' }}
              >
                Submit All Sitemaps
              </button>
            </div>

            {/* Cloudflare */}
            <div style={{ background: '#222', padding: '20px', borderRadius: '8px' }}>
              <h4 style={{ color: '#f38020', marginTop: 0 }}>Cloudflare</h4>
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '15px' }}>
                Manage cache and firewall rules
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={testCloudflare}
                  disabled={loading}
                  style={{ ...styles.actionButton, background: '#333' }}
                >
                  Test Connection
                </button>
                <button
                  onClick={purgeCloudflareSitemaps}
                  disabled={loading}
                  style={{ ...styles.actionButton, background: '#f38020' }}
                >
                  Purge Sitemap Cache
                </button>
              </div>
            </div>
          </div>

          {/* Regional Search Engines */}
          <h4 style={{ color: '#fff', marginBottom: '15px' }}>Regional Search Engines</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
            {/* Yandex - Russia */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🇷🇺</div>
              <h5 style={{ color: '#ff0000', margin: '0 0 8px' }}>Yandex</h5>
              <p style={{ color: '#666', fontSize: '11px', margin: '0 0 10px' }}>Russia</p>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_BASE}/integrations/yandex/submit-all`, {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token }
                    });
                    const data = await res.json();
                    alert(data.message || 'Submitted to Yandex!');
                  } catch (e) { alert('Error: ' + e.message); }
                  setLoading(false);
                }}
                disabled={loading}
                style={{ ...styles.actionButton, background: '#ff0000', padding: '8px 12px', fontSize: '12px' }}
              >
                Submit
              </button>
            </div>

            {/* Baidu - China */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🇨🇳</div>
              <h5 style={{ color: '#2319dc', margin: '0 0 8px' }}>Baidu</h5>
              <p style={{ color: '#666', fontSize: '11px', margin: '0 0 10px' }}>China #1</p>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_BASE}/integrations/baidu/submit-all`, {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token }
                    });
                    const data = await res.json();
                    alert(data.message + (data.note ? '\n\n' + data.note : ''));
                  } catch (e) { alert('Error: ' + e.message); }
                  setLoading(false);
                }}
                disabled={loading}
                style={{ ...styles.actionButton, background: '#2319dc', padding: '8px 12px', fontSize: '12px' }}
              >
                Submit
              </button>
            </div>

            {/* Sogou - China */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🇨🇳</div>
              <h5 style={{ color: '#fb6622', margin: '0 0 8px' }}>Sogou</h5>
              <p style={{ color: '#666', fontSize: '11px', margin: '0 0 10px' }}>China #2</p>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_BASE}/integrations/sogou/submit-all`, {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token }
                    });
                    const data = await res.json();
                    alert(data.message + (data.note ? '\n\n' + data.note : ''));
                  } catch (e) { alert('Error: ' + e.message); }
                  setLoading(false);
                }}
                disabled={loading}
                style={{ ...styles.actionButton, background: '#fb6622', padding: '8px 12px', fontSize: '12px' }}
              >
                Submit
              </button>
            </div>

            {/* 360 Search - China */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🇨🇳</div>
              <h5 style={{ color: '#00b050', margin: '0 0 8px' }}>360 Search</h5>
              <p style={{ color: '#666', fontSize: '11px', margin: '0 0 10px' }}>China #3</p>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_BASE}/integrations/360search/submit-all`, {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token }
                    });
                    const data = await res.json();
                    alert(data.message + (data.note ? '\n\n' + data.note : ''));
                  } catch (e) { alert('Error: ' + e.message); }
                  setLoading(false);
                }}
                disabled={loading}
                style={{ ...styles.actionButton, background: '#00b050', padding: '8px 12px', fontSize: '12px' }}
              >
                Submit
              </button>
            </div>

            {/* Naver - Korea */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🇰🇷</div>
              <h5 style={{ color: '#03c75a', margin: '0 0 8px' }}>Naver</h5>
              <p style={{ color: '#666', fontSize: '11px', margin: '0 0 10px' }}>Korea</p>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_BASE}/integrations/naver/submit-all`, {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token }
                    });
                    const data = await res.json();
                    alert(data.message + (data.note ? '\n\n' + data.note : ''));
                  } catch (e) { alert('Error: ' + e.message); }
                  setLoading(false);
                }}
                disabled={loading}
                style={{ ...styles.actionButton, background: '#03c75a', padding: '8px 12px', fontSize: '12px' }}
              >
                Submit
              </button>
            </div>

            {/* Seznam - Czech */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🇨🇿</div>
              <h5 style={{ color: '#c00', margin: '0 0 8px' }}>Seznam</h5>
              <p style={{ color: '#666', fontSize: '11px', margin: '0 0 10px' }}>Czech</p>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_BASE}/integrations/seznam/submit-all`, {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token }
                    });
                    const data = await res.json();
                    alert(data.message + (data.note ? '\n\n' + data.note : ''));
                  } catch (e) { alert('Error: ' + e.message); }
                  setLoading(false);
                }}
                disabled={loading}
                style={{ ...styles.actionButton, background: '#c00', padding: '8px 12px', fontSize: '12px' }}
              >
                Submit
              </button>
            </div>

            {/* Qwant - EU */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🇪🇺</div>
              <h5 style={{ color: '#5c36a6', margin: '0 0 8px' }}>Qwant</h5>
              <p style={{ color: '#666', fontSize: '11px', margin: '0 0 10px' }}>France/EU</p>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_BASE}/integrations/qwant/submit-all`, {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token }
                    });
                    const data = await res.json();
                    alert(data.message + (data.note ? '\n\n' + data.note : ''));
                  } catch (e) { alert('Error: ' + e.message); }
                  setLoading(false);
                }}
                disabled={loading}
                style={{ ...styles.actionButton, background: '#5c36a6', padding: '8px 12px', fontSize: '12px' }}
              >
                Submit
              </button>
            </div>

            {/* Brave - Global */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🦁</div>
              <h5 style={{ color: '#fb542b', margin: '0 0 8px' }}>Brave</h5>
              <p style={{ color: '#666', fontSize: '11px', margin: '0 0 10px' }}>Global</p>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_BASE}/integrations/brave/submit-all`, {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token }
                    });
                    const data = await res.json();
                    alert(data.message + (data.note ? '\n\n' + data.note : ''));
                  } catch (e) { alert('Error: ' + e.message); }
                  setLoading(false);
                }}
                disabled={loading}
                style={{ ...styles.actionButton, background: '#fb542b', padding: '8px 12px', fontSize: '12px' }}
              >
                Submit
              </button>
            </div>
          </div>

          {/* IndexNow - Instant Indexing */}
          <h4 style={{ color: '#fff', marginTop: '25px', marginBottom: '15px' }}>IndexNow - Instant Indexing</h4>
          <div style={{ background: '#222', padding: '20px', borderRadius: '8px' }}>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '15px' }}>
              IndexNow instantly notifies Bing, Yandex, Seznam & Naver when content changes. Much faster than traditional sitemap pinging.
            </p>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetch(`${API_BASE}/integrations/indexnow/submit-sitemaps`, {
                    method: 'POST',
                    headers: { 'X-Admin-Token': token }
                  });
                  const data = await res.json();
                  let msg = data.message + '\n\n';
                  Object.entries(data.results || {}).forEach(([engine, info]) => {
                    msg += `${engine}: ${info.success ? '✓' : '✗'} ${info.status || ''}\n`;
                  });
                  alert(msg);
                } catch (e) { alert('Error: ' + e.message); }
                setLoading(false);
              }}
              disabled={loading}
              style={{ ...styles.actionButton, background: '#00a4ef', padding: '10px 20px' }}
            >
              Instant Index All Languages
            </button>
          </div>

          {/* Submit All - Master Button */}
          <div style={{ marginTop: '25px', textAlign: 'center', background: 'linear-gradient(135deg, #f60 0%, #c00 100%)', padding: '20px', borderRadius: '8px' }}>
            <h4 style={{ color: '#fff', margin: '0 0 10px' }}>Submit to ALL Search Engines</h4>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginBottom: '15px' }}>
              Google (20 regional TLDs) + Bing + Yandex + Baidu + Sogou + 360 + Naver + Seznam + IndexNow
            </p>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetch(`${API_BASE}/integrations/all/submit-sitemaps`, {
                    method: 'POST',
                    headers: { 'X-Admin-Token': token }
                  });
                  const data = await res.json();
                  let msg = data.message + '\n\n';
                  Object.entries(data.engines || {}).forEach(([engine, info]) => {
                    if (typeof info === 'object') {
                      msg += `${engine}: ${info.submitted !== undefined ? (info.submitted + ' submitted') : (info.success ? '✓' : '✗')}\n`;
                    }
                  });
                  alert(msg);
                } catch (e) { alert('Error: ' + e.message); }
                setLoading(false);
              }}
              disabled={loading}
              style={{ ...styles.actionButton, background: '#fff', color: '#c00', padding: '15px 40px', fontSize: '16px', fontWeight: 'bold' }}
            >
              SUBMIT TO ALL SEARCH ENGINES
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Search Terms Tab */}
      {activeTab === 'search-terms' && (
        <div style={styles.card}>
          <h3>Search Terms from Logs (All Sites)</h3>
          <p style={{ color: '#888', marginBottom: '20px' }}>
            Search queries from visitors coming from Google, Bing, Yahoo, Yandex, and Baidu.
            Covers boyvue.com, boysreview.com, and boyreview.com.
          </p>

          {Object.keys(searchTerms.engines || {}).map(engine => {
            const terms = searchTerms.engines[engine] || [];
            if (terms.length === 0) return null;
            return (
              <div key={engine} style={{ marginBottom: '25px' }}>
                <h4 style={{ color: engine === 'Google' ? '#4285f4' : engine === 'Bing' ? '#008373' : '#f60' }}>
                  {engine} ({terms.length} terms)
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {terms.slice(0, 30).map((t, i) => (
                    <span key={i} style={{
                      background: '#222',
                      padding: '6px 12px',
                      borderRadius: '15px',
                      fontSize: '13px'
                    }}>
                      {t.term} <span style={{ color: '#f60' }}>({t.hits})</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {/* By Site breakdown */}
          <h4 style={{ marginTop: '30px' }}>Search Terms by Site</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {Object.entries(searchTerms.bySite || {}).map(([site, terms]) => (
              <div key={site} style={{ background: '#222', padding: '15px', borderRadius: '8px' }}>
                <h5 style={{ margin: '0 0 10px', color: '#f60' }}>{site}</h5>
                {Object.keys(terms).length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>No search terms found</p>
                ) : (
                  <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: '13px' }}>
                    {Object.entries(terms).slice(0, 10).map(([term, count], i) => (
                      <li key={i}>{term} ({count})</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SERP by Region Tab */}
      {activeTab === 'serp-i18n' && (
        <div style={styles.card}>
          <h3>Search Engine Traffic by Language & Region</h3>
          <p style={{ color: '#888', marginBottom: '20px' }}>
            Tracks which Google TLD/region visitors come from and their language preferences.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            {/* Traffic by Language */}
            <div style={{ background: '#222', padding: '20px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 15px', color: '#f60' }}>Traffic by Language</h4>
              <table style={styles.table}>
                <thead>
                  <tr><th>Language</th><th>Hits</th><th>Unique</th></tr>
                </thead>
                <tbody>
                  {serpI18n.byLanguage?.slice(0, 15).map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 'bold' }}>{row.language?.toUpperCase() || 'Unknown'}</td>
                      <td>{parseInt(row.hits).toLocaleString()}</td>
                      <td>{parseInt(row.unique_visitors).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!serpI18n.byLanguage || serpI18n.byLanguage.length === 0) && (
                    <tr><td colSpan="3" style={{ textAlign: 'center', color: '#666' }}>No data yet - tracking started</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Traffic by Search Engine Region */}
            <div style={{ background: '#222', padding: '20px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 15px', color: '#f60' }}>Traffic by Search Region</h4>
              <table style={styles.table}>
                <thead>
                  <tr><th>Engine</th><th>Region</th><th>Hits</th></tr>
                </thead>
                <tbody>
                  {serpI18n.byRegion?.slice(0, 15).map((row, i) => (
                    <tr key={i}>
                      <td>{row.engine}</td>
                      <td style={{ fontWeight: 'bold' }}>{row.region}</td>
                      <td>{parseInt(row.hits).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!serpI18n.byRegion || serpI18n.byRegion.length === 0) && (
                    <tr><td colSpan="3" style={{ textAlign: 'center', color: '#666' }}>No regional data yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Search Queries by Region */}
          <h4 style={{ color: '#fff', marginBottom: '15px' }}>Search Queries by Region</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
            {Object.entries(serpI18n.queriesByRegion || {}).slice(0, 8).map(([region, queries]) => (
              <div key={region} style={{ background: '#222', padding: '15px', borderRadius: '8px' }}>
                <h5 style={{ margin: '0 0 10px', color: '#f60' }}>{region}</h5>
                <ul style={{ margin: 0, padding: '0 0 0 15px', fontSize: '12px', color: '#ccc' }}>
                  {queries.slice(0, 5).map((q, i) => (
                    <li key={i}>{q.query} ({q.hits})</li>
                  ))}
                </ul>
              </div>
            ))}
            {Object.keys(serpI18n.queriesByRegion || {}).length === 0 && (
              <div style={{ gridColumn: 'span 4', textAlign: 'center', color: '#666', padding: '30px' }}>
                No search queries captured yet. This data will populate as visitors arrive from search engines.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vocabulary/Ontology Tab */}
      {activeTab === 'vocabulary' && (
        <div style={styles.card}>
          <h3>SEO Vocabulary / Ontology (SKOS)</h3>
          <p style={{ color: '#888', marginBottom: '20px' }}>
            Multi-language SKOS vocabulary for semantic SEO. View concepts and their translations.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            {/* Concept List */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', maxHeight: '500px', overflowY: 'auto' }}>
              <h4 style={{ margin: '0 0 15px' }}>Concepts ({vocabulary.concepts?.length || 0})</h4>
              {vocabulary.concepts?.map((concept, i) => (
                <div key={i} style={{
                  padding: '8px',
                  borderBottom: '1px solid #333',
                  cursor: 'pointer'
                }}>
                  <strong style={{ color: '#f60' }}>{concept.id}</strong>
                  {concept.broader && <span style={{ color: '#666', fontSize: '12px' }}> (under {concept.broader})</span>}
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {Object.entries(concept.labels || {}).slice(0, 3).map(([lang, label]) => (
                      <span key={lang} style={{ marginRight: '10px' }}>{lang}: {label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Raw TTL View */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 15px' }}>TTL Source (seo-vocabulary.ttl)</h4>
              <pre style={{
                background: '#111',
                padding: '15px',
                borderRadius: '6px',
                fontSize: '11px',
                maxHeight: '450px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {vocabulary.raw || 'Loading...'}
              </pre>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <strong>Supported Languages:</strong> {vocabulary.languages?.join(', ')}
          </div>
        </div>
      )}

      {/* i18n Keywords Tab */}
      {activeTab === 'i18n' && (
        <div style={styles.card}>
          <h3>i18n SEO Keywords</h3>
          <p style={{ color: '#888', marginBottom: '20px' }}>
            Core English SEO keywords translated to all supported languages for international SEO targeting.
          </p>

          {/* Add New Keyword */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', background: '#222', padding: '15px', borderRadius: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Enter keywords (comma-separated for batch)..."
              style={{ flex: 1, padding: '10px', background: '#333', border: '1px solid #444', borderRadius: '6px', color: '#fff', minWidth: '200px' }}
              onKeyPress={(e) => e.key === 'Enter' && translateNewKeyword()}
              disabled={translating}
            />
            <button
              onClick={translateNewKeyword}
              disabled={translating || !newKeyword.trim()}
              style={{
                padding: '10px 20px', background: translating ? '#666' : '#f60', color: '#fff',
                border: 'none', borderRadius: '6px', cursor: translating ? 'wait' : 'pointer',
                minWidth: '160px'
              }}
            >
              {translating
                ? (translationProgress.total > 1
                    ? `${translationProgress.current}/${translationProgress.total}: ${translationProgress.keyword.slice(0, 15)}${translationProgress.keyword.length > 15 ? '...' : ''}`
                    : 'Translating...')
                : 'Add & Translate'}
            </button>
          </div>

          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f60' }}>{i18nTerms.length}</div>
              <div style={{ color: '#888', fontSize: '12px' }}>English Keywords</div>
            </div>
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                {i18nTerms.reduce((sum, t) => sum + Object.keys(t.translations || {}).length, 0)}
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>Total Translations</div>
            </div>
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>19</div>
              <div style={{ color: '#888', fontSize: '12px' }}>Target Languages</div>
            </div>
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: i18nTerms.filter(t => Object.keys(t.translations || {}).length < 19).length > 0 ? '#f44336' : '#4caf50' }}>
                {i18nTerms.filter(t => Object.keys(t.translations || {}).length < 19).length}
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>Incomplete</div>
            </div>
          </div>

          {/* Keywords Table */}
          <div style={{ background: '#222', padding: '15px', borderRadius: '8px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #444' }}>
                  <th style={{ padding: '10px', textAlign: 'left', color: '#f60' }}>English</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>DE</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>ES</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>FR</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>PT</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>RU</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>JA</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>ZH</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {i18nTerms.map((item, i) => {
                  const transCount = Object.keys(item.translations || {}).length;
                  const isComplete = transCount >= 19;
                  const isRisky = /\b(boy|teen|young|nude|naked|child)\b/i.test(item.term) && !item.term.startsWith('18+');
                  return (
                  <tr key={i} style={{ borderBottom: '1px solid #333', background: isRisky ? 'rgba(244,67,54,0.1)' : 'transparent' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#fff' }}>
                      <span
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => editKeyword(item.term, e.target.textContent)}
                        style={{
                          cursor: 'text',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          display: 'inline-block',
                          minWidth: '100px'
                        }}
                        onFocus={(e) => e.target.style.background = '#333'}
                        onBlurCapture={(e) => e.target.style.background = 'transparent'}
                      >
                        {item.term}
                      </span>
                      {isRisky && <span style={{ color: '#f44336', marginLeft: '5px', fontSize: '10px' }}>⚠</span>}
                    </td>
                    <td style={{ padding: '10px', color: item.translations?.de ? '#4caf50' : '#666' }}>
                      {item.translations?.de || '-'}
                    </td>
                    <td style={{ padding: '10px', color: item.translations?.es ? '#4caf50' : '#666' }}>
                      {item.translations?.es || '-'}
                    </td>
                    <td style={{ padding: '10px', color: item.translations?.fr ? '#4caf50' : '#666' }}>
                      {item.translations?.fr || '-'}
                    </td>
                    <td style={{ padding: '10px', color: item.translations?.pt ? '#4caf50' : '#666' }}>
                      {item.translations?.pt || '-'}
                    </td>
                    <td style={{ padding: '10px', color: item.translations?.ru ? '#4caf50' : '#666' }}>
                      {item.translations?.ru || '-'}
                    </td>
                    <td style={{ padding: '10px', color: item.translations?.ja ? '#4caf50' : '#666' }}>
                      {item.translations?.ja || '-'}
                    </td>
                    <td style={{ padding: '10px', color: item.translations?.zh ? '#4caf50' : '#666' }}>
                      {item.translations?.zh || '-'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        background: isComplete ? '#1b5e20' : '#b71c1c',
                        color: '#fff'
                      }}>
                        {transCount}/19
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {isRisky && (
                        <button
                          onClick={() => makeSafe(item.term)}
                          disabled={translating}
                          title="Add 18+ prefix for legal compliance"
                          style={{
                            background: '#ff9800',
                            border: 'none',
                            color: '#000',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginRight: '5px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          18+
                        </button>
                      )}
                      {!isComplete && (
                        <button
                          onClick={() => retranslateKeyword(item.term, item.category)}
                          disabled={translating}
                          title="Translate missing languages"
                          style={{
                            background: '#1976d2',
                            border: 'none',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginRight: '5px',
                            fontSize: '12px'
                          }}
                        >
                          ↻
                        </button>
                      )}
                      <button
                        onClick={() => deleteKeyword(item.term)}
                        title="Delete keyword"
                        style={{
                          background: '#c62828',
                          border: 'none',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                  );
                })}
                {i18nTerms.length === 0 && (
                  <tr>
                    <td colSpan="10" style={{ padding: '30px', textAlign: 'center', color: '#666' }}>
                      No keywords yet. Add your first keyword above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Language Legend */}
          <div style={{ marginTop: '20px', color: '#888', fontSize: '12px' }}>
            <strong>Supported Languages:</strong> DE (German), ES (Spanish), FR (French), IT (Italian), NL (Dutch), PL (Polish), PT (Portuguese), RU (Russian), JA (Japanese), KO (Korean), ZH (Chinese), TR (Turkish), TH (Thai), VI (Vietnamese), ID (Indonesian), EL (Greek), CS (Czech), HU (Hungarian), AR (Arabic)
          </div>
        </div>
      )}

      {/* Entities Tab - Models & Websites */}
      {activeTab === 'entities' && (
        <div style={styles.card}>
          <h3>Models & Websites Management</h3>
          <p style={{ color: '#888', marginBottom: '20px' }}>
            Toggle the star to feature models/websites in SEO content. Featured items appear in meta tags and structured data.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Models */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                Models ({seoModels.length})
                <span style={{ color: '#4caf50', marginLeft: '10px', fontSize: '12px' }}>
                  {seoModels.filter(m => m.featured).length} featured
                </span>
              </h4>
              <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                {seoModels.map(model => (
                  <div key={model.id} style={{
                    display: 'grid', gridTemplateColumns: '30px 1fr 100px 60px', gap: '10px',
                    padding: '8px 0', borderBottom: '1px solid #333', alignItems: 'center'
                  }}>
                    <button
                      onClick={() => toggleModelFeatured(model.id, !model.featured)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px',
                        color: model.featured ? '#ffd700' : '#444'
                      }}
                      title={model.featured ? 'Remove from featured' : 'Add to featured'}
                    >★</button>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>
                        {model.first_name} {model.last_name || ''}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888' }}>
                        @ {model.websites?.join(', ') || 'unknown'}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: '#888' }}>{model.search_count} searches</span>
                    <span style={{
                      fontSize: '10px', padding: '2px 6px', borderRadius: '3px',
                      background: model.featured ? '#4caf50' : '#333',
                      color: '#fff', textAlign: 'center'
                    }}>{model.featured ? 'Featured' : 'Hidden'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Websites */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                Websites ({seoWebsites.length})
                <span style={{ color: '#2196f3', marginLeft: '10px', fontSize: '12px' }}>
                  {seoWebsites.filter(w => w.featured).length} featured
                </span>
                <span style={{ color: '#4caf50', marginLeft: '10px', fontSize: '12px' }}>
                  {seoWebsites.filter(w => w.keywords?.length > 0).length} with keywords
                </span>
              </h4>
              <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                {seoWebsites.map(website => (
                  <div key={website.id} style={{
                    background: '#1a1a2e', borderRadius: '8px', marginBottom: '12px', padding: '12px',
                    border: website.featured ? '1px solid #2196f3' : '1px solid #333'
                  }}>
                    {/* Website Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <button
                        onClick={() => toggleWebsiteFeatured(website.id, !website.featured)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px',
                          color: website.featured ? '#ffd700' : '#444'
                        }}
                        title={website.featured ? 'Remove from featured' : 'Add to featured'}
                      >★</button>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{website.name}</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          <a href={website.url} target="_blank" rel="noopener noreferrer" style={{ color: '#888' }}>{website.url}</a>
                        </div>
                        {/* Affiliate Quick Links */}
                        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {(() => {
                            const domain = (website.url || website.name || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
                            const base = `https://${domain}`;
                            return (
                              <>
                                <a href={`${base}/affiliates`} target="_blank" rel="noopener noreferrer"
                                   style={{ background: '#f60', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', textDecoration: 'none', fontWeight: 'bold' }}>
                                  Affiliates
                                </a>
                                <a href={`${base}/webmasters`} target="_blank" rel="noopener noreferrer"
                                   style={{ background: '#e91e63', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', textDecoration: 'none', fontWeight: 'bold' }}>
                                  Webmasters
                                </a>
                                <a href={`${base}/partners`} target="_blank" rel="noopener noreferrer"
                                   style={{ background: '#9c27b0', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', textDecoration: 'none', fontWeight: 'bold' }}>
                                  Partners
                                </a>
                                <a href={`${base}/affiliate`} target="_blank" rel="noopener noreferrer"
                                   style={{ background: '#333', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', textDecoration: 'none' }}>
                                  /affiliate
                                </a>
                                <a href={`${base}/webmaster`} target="_blank" rel="noopener noreferrer"
                                   style={{ background: '#333', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', textDecoration: 'none' }}>
                                  /webmaster
                                </a>
                                <a href={`https://www.google.com/search?q=${encodeURIComponent(domain + ' affiliate program')}`} target="_blank" rel="noopener noreferrer"
                                   style={{ background: '#4285f4', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', textDecoration: 'none' }}>
                                  Google
                                </a>
                                <button
                                  onClick={() => {
                                    document.getElementById('bwSite').value = domain;
                                    document.getElementById('bwSite').scrollIntoView({ behavior: 'smooth' });
                                  }}
                                  style={{ background: '#175ddc', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                  title="Quick-fill Bitwarden form with this site"
                                >
                                  + Bitwarden
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '11px' }}>
                        <div style={{ color: '#888' }}>{website.search_count || 0} searches</div>
                        {website.domain_rank && <div style={{ color: '#4caf50' }}>Rank: {website.domain_rank}</div>}
                        {website.last_fetched && <div style={{ color: '#666' }}>Updated: {new Date(website.last_fetched).toLocaleDateString()}</div>}
                      </div>
                    </div>

                    {/* Keywords Section */}
                    {website.keywords && website.keywords.length > 0 && (
                      <div style={{ marginBottom: '10px', padding: '10px', background: '#222', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#00d4ff', marginBottom: '8px', fontWeight: 'bold' }}>
                          TOP KEYWORDS ({website.total_keywords?.toLocaleString() || website.keywords.length} total)
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {website.keywords.slice(0, 5).map((kw, i) => (
                            <div key={i} style={{
                              background: '#333', padding: '4px 10px', borderRadius: '12px', fontSize: '11px',
                              display: 'flex', alignItems: 'center', gap: '6px'
                            }}>
                              <span style={{ color: '#4caf50' }}>{kw.keyword}</span>
                              {kw.position && <span style={{ color: kw.position <= 10 ? '#ffd700' : '#888' }}>#{kw.position}</span>}
                              {kw.search_volume && <span style={{ color: '#888' }}>{kw.search_volume.toLocaleString()}/mo</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Backlinks Section */}
                    {website.backlinks && website.backlinks.length > 0 && (
                      <div style={{ padding: '10px', background: '#222', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#e91e63', marginBottom: '8px', fontWeight: 'bold' }}>
                          TOP BACKLINKS ({website.total_backlinks?.toLocaleString() || website.backlinks.length} total)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {website.backlinks.slice(0, 5).map((bl, i) => (
                            <div key={i} style={{
                              fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '4px 0', borderBottom: '1px solid #333'
                            }}>
                              <span style={{
                                background: bl.is_dofollow ? '#4caf50' : '#666',
                                color: '#fff', padding: '1px 4px', borderRadius: '3px', fontSize: '9px'
                              }}>
                                {bl.is_dofollow ? 'DoFollow' : 'NoFollow'}
                              </span>
                              <span style={{ color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {bl.source_domain || new URL(bl.source_url || 'http://unknown').hostname}
                              </span>
                              {bl.domain_rank && <span style={{ color: '#ffd700' }}>DR:{bl.domain_rank}</span>}
                              <span style={{ color: '#666' }}>"{bl.anchor?.substring(0, 20) || 'no anchor'}"</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No data message */}
                    {(!website.keywords || website.keywords.length === 0) && (!website.backlinks || website.backlinks.length === 0) && (
                      <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', padding: '8px' }}>
                        No keyword/backlink data yet. Click "Fetch & Store All" to populate.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DataForSEO - Competitor Keyword Research */}
          <div style={{ marginTop: '25px', background: '#1a1a2e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#00d4ff' }}>
              DataForSEO - Keywords & Backlinks
              {dataForSeoBalance !== null && (
                <span style={{ float: 'right', fontSize: '12px', color: '#4caf50' }}>
                  Balance: ${dataForSeoBalance?.toFixed(2)}
                </span>
              )}
            </h4>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '15px' }}>
              Fetch top 5 keywords and top 10 backlinks for each competitor. Cost: ~$0.004 per site (keywords + backlinks).
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE}/integrations/dataforseo/test`, {
                      headers: { 'X-Admin-Token': token }
                    });
                    const data = await res.json();
                    if (data.success) {
                      setDataForSeoBalance(data.balance);
                      alert(`Connected! Balance: $${data.balance?.toFixed(2)}`);
                    } else {
                      alert('Connection failed: ' + (data.error || 'Check credentials'));
                    }
                  } catch (e) { alert('Error: ' + e.message); }
                }}
                style={{ ...styles.actionButton, background: '#00d4ff', padding: '8px 15px', fontSize: '12px' }}
              >
                Test Connection
              </button>

              <button
                onClick={async () => {
                  if (seoWebsites.length === 0) {
                    alert('No websites to analyze.');
                    return;
                  }
                  if (!confirm(`Fetch keywords + backlinks for ${seoWebsites.length} websites?\nEstimated cost: ~$${(seoWebsites.length * 0.004).toFixed(3)}`)) return;

                  setFetchingKeywords(true);
                  let totalCost = 0;
                  let processed = 0;

                  for (const website of seoWebsites) {
                    try {
                      const domain = website.url || website.name;
                      const res = await fetch(`${API_BASE}/integrations/dataforseo/full-analysis`, {
                        method: 'POST',
                        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ domain, keywordLimit: 5, backlinkLimit: 10 })
                      });
                      const data = await res.json();

                      if (data.success) {
                        // Store keywords
                        if (data.keywords?.length) {
                          await fetch(`${API_BASE}/seo/websites/${website.id}/keywords`, {
                            method: 'POST',
                            headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ keywords: data.keywords })
                          });
                        }
                        // Store backlinks
                        if (data.backlinks?.length) {
                          await fetch(`${API_BASE}/seo/websites/${website.id}/backlinks`, {
                            method: 'POST',
                            headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ backlinks: data.backlinks, totalBacklinks: data.totalBacklinks })
                          });
                        }
                        totalCost += data.cost || 0;
                        processed++;
                      }
                    } catch (e) {
                      console.error('Error fetching:', website.name, e);
                    }
                  }

                  setFetchingKeywords(false);
                  loadEntities(); // Reload to show new data
                  alert(`Done! Processed ${processed}/${seoWebsites.length} websites.\nTotal cost: $${totalCost.toFixed(4)}`);
                }}
                disabled={fetchingKeywords}
                style={{ ...styles.actionButton, background: fetchingKeywords ? '#666' : '#e91e63', padding: '8px 15px', fontSize: '12px' }}
              >
                {fetchingKeywords ? 'Fetching...' : 'Fetch & Store All (5 Keywords + 10 Backlinks)'}
              </button>

              <button
                onClick={async () => {
                  if (seoWebsites.length === 0) {
                    alert('No websites to analyze. Add competitor websites first.');
                    return;
                  }
                  setFetchingKeywords(true);
                  try {
                    const domains = seoWebsites.slice(0, 10).map(w => w.url || w.name);
                    const res = await fetch(`${API_BASE}/integrations/dataforseo/competitor-keywords`, {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ domains, limit: 5 })
                    });
                    const data = await res.json();
                    if (data.success) {
                      setCompetitorKeywords(data.results);
                      alert(`Fetched keywords for ${data.domainsProcessed} domains. Cost: $${data.totalCost?.toFixed(4)}`);
                    } else {
                      alert('Failed: ' + (data.error || 'Unknown error'));
                    }
                  } catch (e) { alert('Error: ' + e.message); }
                  setFetchingKeywords(false);
                }}
                disabled={fetchingKeywords}
                style={{ ...styles.actionButton, background: fetchingKeywords ? '#666' : '#f60', padding: '8px 15px', fontSize: '12px' }}
              >
                {fetchingKeywords ? 'Fetching...' : 'Fetch Top 5 Keywords (All Sites)'}
              </button>

              <input
                type="text"
                placeholder="Or enter domain manually..."
                id="manualDomain"
                style={{ flex: 1, padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
              />
              <button
                onClick={async () => {
                  const domain = document.getElementById('manualDomain').value;
                  if (!domain) { alert('Enter a domain'); return; }
                  setFetchingKeywords(true);
                  try {
                    const res = await fetch(`${API_BASE}/integrations/dataforseo/domain-keywords`, {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ domain, limit: 10 })
                    });
                    const data = await res.json();
                    if (data.success) {
                      setCompetitorKeywords([{ domain: data.domain, keywords: data.keywords, totalKeywords: data.totalCount }]);
                      alert(`Found ${data.totalCount} total keywords. Cost: $${data.cost?.toFixed(4)}`);
                    } else {
                      alert('Failed: ' + (data.error || 'Unknown error'));
                    }
                  } catch (e) { alert('Error: ' + e.message); }
                  setFetchingKeywords(false);
                }}
                disabled={fetchingKeywords}
                style={{ ...styles.actionButton, background: '#4caf50', padding: '8px 15px', fontSize: '12px' }}
              >
                Lookup
              </button>
            </div>

            {/* Competitor Keywords Results */}
            {competitorKeywords.length > 0 && (
              <div style={{ background: '#222', padding: '15px', borderRadius: '8px', maxHeight: '400px', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #444' }}>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#00d4ff' }}>Domain</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Keyword</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Position</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Volume</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>CPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitorKeywords.map((site, i) => (
                      site.keywords ? site.keywords.map((kw, j) => (
                        <tr key={`${i}-${j}`} style={{ borderBottom: '1px solid #333' }}>
                          {j === 0 && (
                            <td rowSpan={site.keywords.length} style={{ padding: '8px', fontWeight: 'bold', color: '#fff', verticalAlign: 'top' }}>
                              {site.domain}
                              <div style={{ fontSize: '10px', color: '#888' }}>{site.totalKeywords?.toLocaleString()} total</div>
                            </td>
                          )}
                          <td style={{ padding: '8px', color: '#4caf50' }}>{kw.keyword}</td>
                          <td style={{ padding: '8px', textAlign: 'right', color: kw.position <= 10 ? '#4caf50' : '#888' }}>#{kw.position}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{kw.searchVolume?.toLocaleString()}</td>
                          <td style={{ padding: '8px', textAlign: 'right', color: '#f60' }}>${kw.cpc?.toFixed(2)}</td>
                        </tr>
                      )) : (
                        <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{site.domain}</td>
                          <td colSpan="4" style={{ padding: '8px', color: '#e91e63' }}>{site.error || 'No data'}</td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* DataForSEO Config */}
            <details style={{ marginTop: '15px' }}>
              <summary style={{ cursor: 'pointer', color: '#888', fontSize: '12px' }}>Configure DataForSEO Credentials</summary>
              <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                <input type="text" id="dfsLogin" placeholder="Login (email)" style={{ flex: 1, padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                <input type="password" id="dfsPassword" placeholder="Password" style={{ flex: 1, padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                <button
                  onClick={async () => {
                    const login = document.getElementById('dfsLogin').value;
                    const password = document.getElementById('dfsPassword').value;
                    if (!login || !password) { alert('Enter both login and password'); return; }
                    try {
                      const res = await fetch(`${API_BASE}/integrations/config/dataforseo`, {
                        method: 'POST',
                        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ login, password })
                      });
                      const data = await res.json();
                      alert(data.success ? 'Credentials saved!' : 'Failed to save');
                    } catch (e) { alert('Error: ' + e.message); }
                  }}
                  style={{ ...styles.actionButton, background: '#333', padding: '8px 15px', fontSize: '12px' }}
                >
                  Save
                </button>
              </div>
              <p style={{ color: '#666', fontSize: '11px', marginTop: '8px' }}>
                Sign up at <a href="https://dataforseo.com" target="_blank" rel="noopener" style={{ color: '#00d4ff' }}>dataforseo.com</a> - $1 minimum deposit, pay-per-use pricing.
              </p>
            </details>
          </div>

          {/* Bitwarden - Password Management */}
          <div style={{ marginTop: '25px', background: '#1a1a2e', padding: '20px', borderRadius: '8px', border: '1px solid #175ddc' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#175ddc' }}>
              Bitwarden - Affiliate Login Storage
            </h4>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '15px' }}>
              Save affiliate program logins securely to Bitwarden vault. Include content feed URLs for automatic updates.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE}/integrations/bitwarden/test`, {
                      headers: { 'X-Admin-Token': token }
                    });
                    const data = await res.json();
                    alert(data.success ? `Bitwarden connected! Token expires in ${Math.round(data.expiresIn/60)} min` : 'Failed: ' + data.error);
                  } catch (e) { alert('Error: ' + e.message); }
                }}
                style={{ ...styles.actionButton, background: '#175ddc', padding: '8px 15px', fontSize: '12px' }}
              >
                Test Connection
              </button>

              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE}/integrations/bitwarden/folders`, {
                      headers: { 'X-Admin-Token': token }
                    });
                    const data = await res.json();
                    if (data.success) {
                      alert('Folders:\n' + (data.folders?.map(f => `- ${f.name} (${f.id})`).join('\n') || 'No folders'));
                    } else {
                      alert('Error: ' + data.error);
                    }
                  } catch (e) { alert('Error: ' + e.message); }
                }}
                style={{ ...styles.actionButton, background: '#333', padding: '8px 15px', fontSize: '12px' }}
              >
                List Folders
              </button>

              <button
                onClick={async () => {
                  const name = prompt('Enter folder name:', 'Affiliates');
                  if (!name) return;
                  try {
                    const res = await fetch(`${API_BASE}/integrations/bitwarden/folders`, {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name })
                    });
                    const data = await res.json();
                    alert(data.success ? `Folder created: ${data.folder?.name}` : 'Error: ' + data.error);
                  } catch (e) { alert('Error: ' + e.message); }
                }}
                style={{ ...styles.actionButton, background: '#333', padding: '8px 15px', fontSize: '12px' }}
              >
                Create Folder
              </button>
            </div>

            {/* Save Single Affiliate Login */}
            <div style={{ background: '#222', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
              <h5 style={{ margin: '0 0 10px', color: '#fff' }}>Save Affiliate Login</h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
                <input type="text" id="bwSite" placeholder="Site name (e.g. helixstudios.com)" style={{ padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                <input type="text" id="bwUsername" placeholder="Username/Email" style={{ padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                <input type="password" id="bwPassword" placeholder="Password" style={{ padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
                <input type="text" id="bwAffUrl" placeholder="Affiliate URL" style={{ padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                <input type="text" id="bwFeedUrl" placeholder="Content Feed URL (RSS/API)" style={{ padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                <select id="bwFeedType" style={{ padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }}>
                  <option value="">Feed Type...</option>
                  <option value="rss">RSS Feed</option>
                  <option value="json">JSON API</option>
                  <option value="xml">XML Feed</option>
                  <option value="ftp">FTP</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" id="bwApiKey" placeholder="API Key (if any)" style={{ flex: 1, padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                <button
                  onClick={async () => {
                    const site = document.getElementById('bwSite').value;
                    const username = document.getElementById('bwUsername').value;
                    const password = document.getElementById('bwPassword').value;
                    const affiliateUrl = document.getElementById('bwAffUrl').value;
                    const feedUrl = document.getElementById('bwFeedUrl').value;
                    const feedType = document.getElementById('bwFeedType').value;
                    const apiKey = document.getElementById('bwApiKey').value;

                    if (!site || !username || !password) { alert('Site, username, and password required'); return; }

                    try {
                      const res = await fetch(`${API_BASE}/integrations/bitwarden/save-affiliate`, {
                        method: 'POST',
                        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ site, username, password, affiliateUrl, feedUrl, feedType, apiKey })
                      });
                      const data = await res.json();
                      if (data.success) {
                        alert('Saved to Bitwarden: ' + data.name);
                        // Clear form
                        ['bwSite', 'bwUsername', 'bwPassword', 'bwAffUrl', 'bwFeedUrl', 'bwApiKey'].forEach(id => document.getElementById(id).value = '');
                      } else {
                        alert('Error: ' + data.error);
                      }
                    } catch (e) { alert('Error: ' + e.message); }
                  }}
                  style={{ ...styles.actionButton, background: '#175ddc', padding: '8px 20px', fontSize: '12px' }}
                >
                  Save to Bitwarden
                </button>
              </div>
            </div>

            {/* Bitwarden Config */}
            <details>
              <summary style={{ cursor: 'pointer', color: '#888', fontSize: '12px' }}>Configure Bitwarden API</summary>
              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input type="text" id="bwClientId" placeholder="Client ID (from API Key)" style={{ padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                <input type="password" id="bwClientSecret" placeholder="Client Secret" style={{ padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                <input type="text" id="bwFolderId" placeholder="Default Folder ID (optional)" style={{ padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                <button
                  onClick={async () => {
                    const clientId = document.getElementById('bwClientId').value;
                    const clientSecret = document.getElementById('bwClientSecret').value;
                    const defaultFolderId = document.getElementById('bwFolderId').value;
                    if (!clientId || !clientSecret) { alert('Client ID and Secret required'); return; }
                    try {
                      const res = await fetch(`${API_BASE}/integrations/config/bitwarden`, {
                        method: 'POST',
                        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clientId, clientSecret, defaultFolderId, affiliateFolderId: defaultFolderId })
                      });
                      const data = await res.json();
                      alert(data.success ? 'Bitwarden credentials saved!' : 'Failed');
                    } catch (e) { alert('Error: ' + e.message); }
                  }}
                  style={{ ...styles.actionButton, background: '#175ddc', padding: '8px 15px', fontSize: '12px' }}
                >
                  Save Config
                </button>
              </div>
              <p style={{ color: '#666', fontSize: '11px', marginTop: '8px' }}>
                Get API credentials: Bitwarden Web Vault → Settings → Security → Keys → API Key.
                Use the client_id and client_secret.
              </p>
            </details>
          </div>
        </div>
      )}

      {/* SERP Preview Tab */}
      {activeTab === 'serp' && (
        <div style={styles.card}>
          <h3>SERP Preview Generator</h3>
          <p style={{ color: '#888', marginBottom: '20px' }}>
            Preview how pages appear in search engine results across all languages.
          </p>

          {/* Controls */}
          <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Page Type</label>
              <select
                value={serpPageType}
                onChange={(e) => setSerpPageType(e.target.value)}
                style={styles.select}
              >
                <option value="home">Home Page</option>
                <option value="category">Category Page</option>
                <option value="photo">Photo/Video Page</option>
              </select>
            </div>
            {serpPageType === 'category' && (
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Category Name</label>
                <input
                  type="text"
                  value={serpCategory}
                  onChange={(e) => setSerpCategory(e.target.value)}
                  style={{ ...styles.select, width: '200px' }}
                  placeholder="e.g. Twink"
                />
              </div>
            )}
            <div style={{ alignSelf: 'flex-end' }}>
              <button onClick={loadSerpPreviews} style={styles.actionButton}>
                Generate Previews
              </button>
            </div>
          </div>

          {/* SERP Previews */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {serpPreviews.previews?.map((preview, i) => (
              <div key={i} style={{
                background: '#fff',
                padding: '15px',
                borderRadius: '8px',
                color: '#000'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{
                    background: preview.language === 'en' ? '#4285f4' : '#f60',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    {preview.language.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '11px', color: '#666' }}>
                    Title: {preview.titleLength}/60 {preview.titleOk ? '✓' : '⚠️'} |
                    Desc: {preview.descLength}/160 {preview.descOk ? '✓' : '⚠️'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#006621', marginBottom: '5px' }}>
                  {preview.url}
                </div>
                <div style={{ fontSize: '18px', color: '#1a0dab', marginBottom: '5px' }}>
                  {preview.title}
                </div>
                <div style={{ fontSize: '13px', color: '#545454', lineHeight: '1.4' }}>
                  {preview.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  loginContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#111'
  },
  loginBox: {
    background: '#1a1a1a',
    padding: '40px',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '400px'
  },
  title: {
    color: '#f60',
    marginBottom: '30px',
    textAlign: 'center'
  },
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '15px',
    borderRadius: '6px',
    border: '1px solid #333',
    background: '#222',
    color: '#fff',
    fontSize: '16px',
    boxSizing: 'border-box'
  },
  button: {
    width: '100%',
    padding: '12px',
    background: '#f60',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer'
  },
  buttonSmall: {
    padding: '8px 16px',
    background: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginLeft: '10px'
  },
  actionButton: {
    padding: '10px 20px',
    background: '#f60',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  error: {
    color: '#f44',
    marginBottom: '15px',
    textAlign: 'center'
  },
  dashboard: {
    background: '#111',
    minHeight: '100vh',
    color: '#fff',
    padding: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    borderBottom: '1px solid #333',
    paddingBottom: '20px'
  },
  select: {
    padding: '8px 12px',
    background: '#222',
    color: '#fff',
    border: '1px solid #333',
    borderRadius: '6px'
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '25px',
    borderBottom: '1px solid #333',
    paddingBottom: '15px'
  },
  tab: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px'
  },
  card: {
    background: '#1a1a1a',
    padding: '20px',
    borderRadius: '12px'
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '15px'
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '15px',
    background: '#222',
    borderRadius: '8px'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#f60'
  },
  statLabel: {
    fontSize: '12px',
    color: '#888',
    marginTop: '5px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  }
};

// Add table styles
const tableStyles = `
  .admin-table th, .admin-table td {
    padding: 8px 12px;
    border-bottom: 1px solid #333;
    text-align: left;
  }
  .admin-table th { color: #888; font-weight: normal; }
  .admin-table tr:hover { background: #222; }
`;
