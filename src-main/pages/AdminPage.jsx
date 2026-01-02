import React, { useState, useEffect } from 'react';
import SeoAdmin from '../../shared/components/SeoAdmin';

const API_BASE = '/api/admin';

// Site definitions - 5 properties
const SITES = [
  { id: 'blog', name: 'BoyVue Blog', url: 'https://boyvue.com', color: '#f60', icon: '📝' },
  { id: 'pics', name: 'Pics', url: 'https://boyvue.com/pics', color: '#4caf50', icon: '📷' },
  { id: 'fans', name: 'Fans', url: 'https://fans.boyvue.com', color: '#9c27b0', icon: '💜' },
  { id: 'videos', name: 'Videos', url: 'https://videos.boyvue.com', color: '#00d4ff', icon: '🎬' },
  { id: 'adult', name: 'Adult', url: 'https://adult.boyvue.com', color: '#ff1493', icon: '🔞' },
];

// Fans-specific tabs
const FANS_TABS = ['overview', 'seo', 'sitemaps', 'platforms', 'performers', 'themes', 'spider', 'links', 'analytics'];

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Site selection - check URL param on load
  const [activeSite, setActiveSite] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const siteParam = params.get('site');
    if (siteParam && SITES.find(s => s.id === siteParam)) {
      return siteParam;
    }
    return 'blog';
  });
  const currentSite = SITES.find(s => s.id === activeSite);

  // Fans admin state
  const [fansTab, setFansTab] = useState('overview');
  const [fansData, setFansData] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  // Fans SEO state
  const [gscPerformance, setGscPerformance] = useState(null);
  const [topQueries, setTopQueries] = useState([]);
  const [topPages, setTopPages] = useState([]);
  const [sitemaps, setSitemaps] = useState([]);

  // Platform settings modal
  const [settingsModal, setSettingsModal] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [bitwardenSearch, setBitwardenSearch] = useState('');
  const [bitwardenResults, setBitwardenResults] = useState([]);
  const [bitwardenItem, setBitwardenItem] = useState(null);
  const [platformNotes, setPlatformNotes] = useState('');

  // Global settings modal
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('cloudflare');
  const [globalSettings, setGlobalSettings] = useState({
    cloudflare: { zoneId: '', apiToken: '', email: '' },
    gsc: { clientEmail: '', privateKey: '', projectId: '' },
    dataforseo: { login: '', password: '' },
    openai: { apiKey: '' },
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [apiStatus, setApiStatus] = useState({
    cloudflare: { connected: false, features: [] },
    gsc: { connected: false, sites: [] },
    dataforseo: { connected: false, balance: 0 },
  });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadGlobalSettings();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && activeSite === 'fans') {
      fetchFansData();
    }
  }, [isAuthenticated, activeSite, fansTab]);

  // Load global settings (Cloudflare, GSC, DataForSEO credentials)
  async function loadGlobalSettings() {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        headers: { 'X-Admin-Token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalSettings(data.settings || {
          cloudflare: { zoneId: '', apiToken: '', email: '' },
          gsc: { clientEmail: '', privateKey: '', projectId: '' },
          dataforseo: { login: '', password: '' },
          openai: { apiKey: '' },
        });
        if (data.apiStatus) {
          setApiStatus(data.apiStatus);
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }

  // Test API connection
  async function testApiConnection(api) {
    try {
      const res = await fetch(`${API_BASE}/settings/test/${api}`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: globalSettings[api] })
      });
      const data = await res.json();
      if (data.success) {
        setApiStatus(prev => ({ ...prev, [api]: data.status }));
        alert(`${api} connection successful!`);
      } else {
        alert(`${api} connection failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Error testing ${api}: ${err.message}`);
    }
  }

  // Export data to Excel/CSV
  async function exportData(format, dataType) {
    try {
      const res = await fetch(`${API_BASE}/export/${dataType}?format=${format}`, {
        headers: { 'X-Admin-Token': token }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dataType}-export.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Export failed');
      }
    } catch (err) {
      alert('Export error: ' + err.message);
    }
  }

  // Save global settings
  async function saveGlobalSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: globalSettings })
      });
      const data = await res.json();
      if (data.success) {
        alert('Settings saved successfully!');
        setShowGlobalSettings(false);
      } else {
        alert('Error: ' + (data.error || 'Failed to save'));
      }
    } catch (err) {
      alert('Error saving settings: ' + err.message);
    }
    setSavingSettings(false);
  }

  async function checkAdminAccess() {
    try {
      const checkRes = await fetch(`${API_BASE}/check-admin`, { credentials: 'include' });
      const checkData = await checkRes.json();
      if (checkData.isAdmin) {
        const loginRes = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: checkData.email })
        });
        const loginData = await loginRes.json();
        if (loginData.success && loginData.token) {
          localStorage.setItem('adminToken', loginData.token);
          setToken(loginData.token);
          setIsAuthenticated(true);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Admin check failed:', err);
    }
    if (token) {
      verifyToken();
    } else {
      setLoading(false);
    }
  }

  async function verifyToken() {
    try {
      const res = await fetch(`${API_BASE}/status`, {
        headers: { 'X-Admin-Token': token }
      });
      if (res.ok) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('adminToken');
        setToken('');
      }
    } catch (err) {
      console.error('Token verification failed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
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
      if (data.success && data.token) {
        localStorage.setItem('adminToken', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
    }
    setLoading(false);
  }

  function handleLogout() {
    localStorage.removeItem('adminToken');
    setToken('');
    setIsAuthenticated(false);
  }

  // Fans data fetching
  async function fetchFansData() {
    setLoading(true);
    const headers = { 'X-Admin-Token': token };

    try {
      switch (fansTab) {
        case 'overview':
          const [statsRes, jobsRes] = await Promise.all([
            fetch('/api/creatives/admin/analytics/overview', { headers }),
            fetch('/api/creatives/admin/spider/jobs?limit=5', { headers })
          ]);
          setFansData({
            stats: (await statsRes.json()).stats,
            recentJobs: (await jobsRes.json()).jobs
          });
          break;

        case 'seo':
          const [perfRes, queriesRes, pagesRes] = await Promise.all([
            fetch('/api/admin/integrations/gsc/performance?site=https://fans.boyvue.com', { headers }),
            fetch('/api/admin/integrations/gsc/top-queries?site=https://fans.boyvue.com', { headers }),
            fetch('/api/admin/integrations/gsc/top-pages?site=https://fans.boyvue.com', { headers })
          ]);
          setGscPerformance(await perfRes.json());
          setTopQueries((await queriesRes.json()).queries || []);
          setTopPages((await pagesRes.json()).pages || []);
          break;

        case 'sitemaps':
          const sitemapsRes = await fetch('/api/admin/integrations/gsc/sitemaps?site=https://fans.boyvue.com', { headers });
          setSitemaps((await sitemapsRes.json()).sitemaps || []);
          break;

        case 'platforms':
          const platformsRes = await fetch('/api/creatives/admin/platforms', { headers });
          setFansData({ platforms: (await platformsRes.json()).platforms });
          break;

        case 'performers':
          const performersRes = await fetch('/api/creatives/admin/performers?limit=50', { headers });
          setFansData({ performers: (await performersRes.json()).performers });
          break;

        case 'themes':
          const themesRes = await fetch('/api/creatives/admin/themes', { headers });
          setFansData({ themes: (await themesRes.json()).themes });
          break;

        case 'spider':
          const spiderRes = await fetch('/api/creatives/admin/spider/jobs?limit=20', { headers });
          setFansData({ jobs: (await spiderRes.json()).jobs });
          break;

        case 'links':
          const linksRes = await fetch('/api/creatives/admin/links?limit=50', { headers });
          setFansData({ links: (await linksRes.json()).links });
          break;

        case 'analytics':
          const [analyticsRes, topRes, byPlatformRes] = await Promise.all([
            fetch('/api/creatives/admin/analytics/overview', { headers }),
            fetch('/api/creatives/admin/analytics/top-performers?limit=10', { headers }),
            fetch('/api/creatives/admin/analytics/by-platform', { headers })
          ]);
          setFansData({
            stats: (await analyticsRes.json()).stats,
            topPerformers: (await topRes.json()).performers,
            byPlatform: (await byPlatformRes.json()).platforms
          });
          break;
      }
    } catch (err) {
      console.error('Error fetching fans data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runSpider(platform) {
    if (!confirm(`Run spider for ${platform}?`)) return;
    try {
      const res = await fetch(`/api/creatives/admin/spider/run/${platform}`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      alert(data.message || 'Spider job created');
      fetchFansData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // Platform settings functions
  async function openSettings(platform) {
    setSettingsModal(platform);
    setPlatformNotes(platform.notes || '');
    setBitwardenItem(null);
    setBitwardenSearch('');
    setBitwardenResults([]);

    if (platform.bitwarden_item_id) {
      setSettingsLoading(true);
      try {
        const res = await fetch(`/api/admin/integrations/bitwarden/item/${platform.bitwarden_item_id}`, {
          headers: { 'X-Admin-Token': token }
        });
        const data = await res.json();
        if (data.success) setBitwardenItem(data.item);
      } catch (err) {
        console.error('Error fetching Bitwarden item:', err);
      }
      setSettingsLoading(false);
    }
  }

  async function searchBitwarden() {
    if (!bitwardenSearch.trim()) return;
    setSettingsLoading(true);
    try {
      const res = await fetch(`/api/admin/integrations/bitwarden/search?q=${encodeURIComponent(bitwardenSearch)}`, {
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      if (data.success) setBitwardenResults(data.items || []);
    } catch (err) {
      console.error('Error searching Bitwarden:', err);
    }
    setSettingsLoading(false);
  }

  async function selectBitwardenItem(item) {
    setBitwardenResults([]);
    setBitwardenSearch('');
    setSettingsLoading(true);
    try {
      const res = await fetch(`/api/admin/integrations/bitwarden/item/${item.id}`, {
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      if (data.success) setBitwardenItem(data.item);
    } catch (err) {
      console.error('Error fetching Bitwarden item:', err);
    }
    setSettingsLoading(false);
  }

  async function saveSettings() {
    if (!settingsModal) return;
    setSettingsLoading(true);
    try {
      const res = await fetch(`/api/creatives/admin/platforms/${settingsModal.id}`, {
        method: 'PUT',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: platformNotes,
          bitwarden_item_id: bitwardenItem?.id || null
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Settings saved!');
        setSettingsModal(null);
        fetchFansData();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setSettingsLoading(false);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('Copied!');
  }

  // Fans SEO Actions
  async function submitFansSitemaps() {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/integrations/fans/submit-sitemaps', {
        method: 'POST',
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      alert(data.success ? 'Sitemaps submitted to search engines!' : 'Error: ' + data.error);
      fetchFansData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setActionLoading(false);
  }

  async function purgeFansCache() {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/integrations/fans/purge-cache', {
        method: 'POST',
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      alert(data.success ? 'Cache purged from Cloudflare!' : 'Error: ' + data.error);
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setActionLoading(false);
  }

  if (loading && !isAuthenticated) {
    return <div className="admin-loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="unified-admin-login">
        <div className="login-box">
          <h1>BoyVue Central Admin</h1>
          <p className="subtitle">Manage all sites from one place</p>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <a href="/" className="back-link">Back to site</a>
        </div>
        <style>{loginStyles}</style>
      </div>
    );
  }

  return (
    <div className="unified-admin">
      <header className="admin-header">
        <div className="header-left">
          <h1>BoyVue Central Admin</h1>
        </div>
        <div className="site-selector">
          {SITES.map(site => (
            <button
              key={site.id}
              className={`site-btn ${activeSite === site.id ? 'active' : ''}`}
              onClick={() => setActiveSite(site.id)}
              style={{ '--site-color': site.color }}
              title={site.url}
            >
              <span className="site-icon">{site.icon}</span>
              <span className="site-name">{site.name}</span>
            </button>
          ))}
        </div>
        <div className="header-right">
          <button onClick={() => setShowGlobalSettings(true)} className="settings-btn-header">
            ⚙️ Settings
          </button>
          <a href={currentSite.url} target="_blank" rel="noopener noreferrer" className="view-site-btn">
            View {currentSite.name}
          </a>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <main className="admin-content">
        {/* Blog (Main Domain) */}
        {activeSite === 'blog' && (
          <div className="site-panel">
            <div className="site-header-row">
              <h2>{currentSite.icon} BoyVue Blog</h2>
              <a href="/admin/full" className="secondary-btn">Full SEO Dashboard</a>
            </div>
            <p className="site-description">Main domain blog - coming soon</p>
            <SeoAdmin
              siteName="BoyVue Blog"
              siteUrl="https://boyvue.com"
              token={token}
            />
          </div>
        )}

        {/* Pics (Gallery) */}
        {activeSite === 'pics' && (
          <div className="site-panel">
            <div className="site-header-row">
              <h2>{currentSite.icon} Pics Gallery</h2>
              <a href="/admin/full" className="secondary-btn">Full SEO Dashboard</a>
            </div>
            <p className="site-description">Photo gallery with categories, ratings, and comments</p>
            <SeoAdmin
              siteName="Pics"
              siteUrl="https://boyvue.com/pics"
              token={token}
            />
          </div>
        )}

        {/* Adult Site */}
        {activeSite === 'adult' && (
          <div className="site-panel">
            <div className="site-header-row">
              <h2>{currentSite.icon} Adult Site</h2>
            </div>
            <p className="site-description">Adult content subdomain</p>
            <SeoAdmin
              siteName="Adult"
              siteUrl="https://adult.boyvue.com"
              token={token}
            />
          </div>
        )}

        {/* Videos Site */}
        {activeSite === 'videos' && (
          <div className="site-panel">
            <div className="site-header-row">
              <h2>{currentSite.icon} Videos Site</h2>
            </div>
            <p className="site-description">Video content with studios and categories</p>
            <SeoAdmin
              siteName="Videos"
              siteUrl="https://videos.boyvue.com"
              token={token}
            />
          </div>
        )}

        {/* Fans/Creatives Site - Full inline admin */}
        {activeSite === 'fans' && (
          <div className="site-panel fans-panel">
            <div className="fans-nav">
              {FANS_TABS.map(tab => (
                <button
                  key={tab}
                  className={fansTab === tab ? 'active' : ''}
                  onClick={() => setFansTab(tab)}
                >
                  {tab === 'seo' ? 'SEO' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="fans-content">
              {loading ? (
                <div className="loading">Loading...</div>
              ) : (
                <>
                  {/* Overview Tab */}
                  {fansTab === 'overview' && (
                    <div className="tab-content">
                      <h3>Dashboard Overview</h3>
                      <div className="stats-grid">
                        <div className="stat-card">
                          <span className="value">{fansData.stats?.total_clicks || 0}</span>
                          <span className="label">Clicks (30d)</span>
                        </div>
                        <div className="stat-card">
                          <span className="value">{fansData.stats?.unique_clicks || 0}</span>
                          <span className="label">Unique Clicks</span>
                        </div>
                        <div className="stat-card">
                          <span className="value">{fansData.stats?.promoted_performers || 0}</span>
                          <span className="label">Promoted</span>
                        </div>
                        <div className="stat-card">
                          <span className="value">{fansData.stats?.online_now || 0}</span>
                          <span className="label">Online Now</span>
                        </div>
                      </div>

                      <h4>Recent Spider Jobs</h4>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Platform</th>
                            <th>Status</th>
                            <th>Processed</th>
                            <th>Added</th>
                            <th>Errors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(fansData.recentJobs || []).map(job => (
                            <tr key={job.id}>
                              <td>{job.platform_name}</td>
                              <td><span className={`status-${job.status}`}>{job.status}</span></td>
                              <td>{job.items_processed}</td>
                              <td>{job.items_added}</td>
                              <td>{job.errors_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* SEO Tab */}
                  {fansTab === 'seo' && (
                    <div className="tab-content">
                      <h3>SEO Performance - fans.boyvue.com</h3>

                      <div className="action-buttons">
                        <button onClick={submitFansSitemaps} disabled={actionLoading} className="primary-btn">
                          Submit Sitemaps
                        </button>
                        <button onClick={purgeFansCache} disabled={actionLoading} className="secondary-btn">
                          Purge Cache
                        </button>
                      </div>

                      {gscPerformance && (
                        <div className="stats-grid">
                          <div className="stat-card">
                            <span className="value">{gscPerformance.totals?.clicks?.toLocaleString() || 0}</span>
                            <span className="label">Clicks</span>
                          </div>
                          <div className="stat-card">
                            <span className="value">{gscPerformance.totals?.impressions?.toLocaleString() || 0}</span>
                            <span className="label">Impressions</span>
                          </div>
                          <div className="stat-card">
                            <span className="value">{((gscPerformance.totals?.ctr || 0) * 100).toFixed(2)}%</span>
                            <span className="label">CTR</span>
                          </div>
                          <div className="stat-card">
                            <span className="value">{gscPerformance.totals?.position?.toFixed(1) || 0}</span>
                            <span className="label">Avg Position</span>
                          </div>
                        </div>
                      )}

                      <div className="two-columns">
                        <div>
                          <h4>Top Search Queries</h4>
                          <table className="data-table">
                            <thead>
                              <tr><th>Query</th><th>Clicks</th><th>Position</th></tr>
                            </thead>
                            <tbody>
                              {topQueries.slice(0, 10).map((q, i) => (
                                <tr key={i}>
                                  <td>{q.query}</td>
                                  <td>{q.clicks}</td>
                                  <td>{q.position?.toFixed(1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <h4>Top Pages</h4>
                          <table className="data-table">
                            <thead>
                              <tr><th>Page</th><th>Clicks</th><th>Position</th></tr>
                            </thead>
                            <tbody>
                              {topPages.slice(0, 10).map((p, i) => (
                                <tr key={i}>
                                  <td>{p.page?.replace('https://fans.boyvue.com', '')}</td>
                                  <td>{p.clicks}</td>
                                  <td>{p.position?.toFixed(1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sitemaps Tab */}
                  {fansTab === 'sitemaps' && (
                    <div className="tab-content">
                      <h3>Sitemap Management</h3>
                      <div className="action-buttons">
                        <button onClick={submitFansSitemaps} disabled={actionLoading} className="primary-btn">
                          Submit All Sitemaps
                        </button>
                        <button onClick={purgeFansCache} disabled={actionLoading} className="secondary-btn">
                          Purge Cache
                        </button>
                      </div>

                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Sitemap URL</th>
                            <th>Status</th>
                            <th>Last Submitted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sitemaps.map((s, i) => (
                            <tr key={i}>
                              <td><a href={s.path} target="_blank" rel="noopener noreferrer">{s.path}</a></td>
                              <td><span className={`status-${s.status}`}>{s.status}</span></td>
                              <td>{s.lastSubmitted ? new Date(s.lastSubmitted).toLocaleString() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Platforms Tab */}
                  {fansTab === 'platforms' && (
                    <div className="tab-content">
                      <h3>Affiliate Platforms</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Platform</th>
                            <th>Type</th>
                            <th>Accounts</th>
                            <th>Performers</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(fansData.platforms || []).map(p => (
                            <tr key={p.id}>
                              <td>
                                <button className="settings-btn" onClick={() => openSettings(p)} title="Settings">
                                  ⚙️
                                </button>
                                {p.name}
                                {p.bitwarden_item_id && <span className="linked-badge" title="Bitwarden linked">🔐</span>}
                              </td>
                              <td>{p.platform_type}</td>
                              <td>{p.account_count}</td>
                              <td>{p.performer_count}</td>
                              <td>
                                <button className="action-btn" onClick={() => runSpider(p.slug)}>Run Spider</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Performers Tab */}
                  {fansTab === 'performers' && (
                    <div className="tab-content">
                      <h3>Performers</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Username</th>
                            <th>Platform</th>
                            <th>Promoted</th>
                            <th>Featured</th>
                            <th>Online</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(fansData.performers || []).map(p => (
                            <tr key={p.id}>
                              <td>{p.username}</td>
                              <td>{p.platform_name}</td>
                              <td>{p.is_promoted ? 'Yes' : 'No'}</td>
                              <td>{p.is_featured ? 'Yes' : 'No'}</td>
                              <td>{p.is_online ? 'Live' : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Themes Tab */}
                  {fansTab === 'themes' && (
                    <div className="tab-content">
                      <h3>Themes / Categories</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Slug</th>
                            <th>Performers</th>
                            <th>Featured</th>
                            <th>Active</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(fansData.themes || []).map(t => (
                            <tr key={t.id}>
                              <td>{t.icon} {t.name}</td>
                              <td>{t.slug}</td>
                              <td>{t.actual_performer_count || t.performer_count}</td>
                              <td>{t.is_featured ? 'Yes' : 'No'}</td>
                              <td>{t.is_active ? 'Yes' : 'No'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Spider Tab */}
                  {fansTab === 'spider' && (
                    <div className="tab-content">
                      <h3>Spider Jobs</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Platform</th>
                            <th>Status</th>
                            <th>Processed</th>
                            <th>Added</th>
                            <th>Errors</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(fansData.jobs || []).map(job => (
                            <tr key={job.id}>
                              <td>{job.id}</td>
                              <td>{job.platform_name}</td>
                              <td><span className={`status-${job.status}`}>{job.status}</span></td>
                              <td>{job.items_processed}</td>
                              <td>{job.items_added}</td>
                              <td>{job.errors_count}</td>
                              <td>{new Date(job.created_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Links Tab */}
                  {fansTab === 'links' && (
                    <div className="tab-content">
                      <h3>Affiliate Links</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Short Code</th>
                            <th>Performer</th>
                            <th>Platform</th>
                            <th>Clicks</th>
                            <th>Unique</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(fansData.links || []).map(link => (
                            <tr key={link.id}>
                              <td><code>/go/{link.short_code}</code></td>
                              <td>{link.username || '-'}</td>
                              <td>{link.platform_name}</td>
                              <td>{link.click_count}</td>
                              <td>{link.unique_click_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Analytics Tab */}
                  {fansTab === 'analytics' && (
                    <div className="tab-content">
                      <h3>Analytics</h3>
                      <div className="stats-grid">
                        <div className="stat-card">
                          <span className="value">{fansData.stats?.total_clicks || 0}</span>
                          <span className="label">Total Clicks</span>
                        </div>
                        <div className="stat-card">
                          <span className="value">{fansData.stats?.conversions || 0}</span>
                          <span className="label">Conversions</span>
                        </div>
                        <div className="stat-card">
                          <span className="value">${fansData.stats?.revenue || 0}</span>
                          <span className="label">Revenue</span>
                        </div>
                      </div>

                      <div className="two-columns">
                        <div>
                          <h4>Clicks by Platform</h4>
                          <table className="data-table">
                            <thead>
                              <tr><th>Platform</th><th>Clicks</th><th>Unique</th></tr>
                            </thead>
                            <tbody>
                              {(fansData.byPlatform || []).map(p => (
                                <tr key={p.platform_slug}>
                                  <td>{p.platform_name}</td>
                                  <td>{p.clicks}</td>
                                  <td>{p.unique_clicks}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <h4>Top Performers</h4>
                          <table className="data-table">
                            <thead>
                              <tr><th>Performer</th><th>Platform</th><th>Clicks</th></tr>
                            </thead>
                            <tbody>
                              {(fansData.topPerformers || []).map(p => (
                                <tr key={p.id}>
                                  <td>{p.username}</td>
                                  <td>{p.platform_name}</td>
                                  <td>{p.clicks}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Platform Settings Modal */}
      {settingsModal && (
        <div className="modal-overlay" onClick={() => setSettingsModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙️ {settingsModal.name} Settings</h2>
              <button className="modal-close" onClick={() => setSettingsModal(null)}>×</button>
            </div>

            <div className="modal-body">
              <div className="settings-section">
                <h3>🔐 Bitwarden Credentials</h3>

                {bitwardenItem ? (
                  <div className="bitwarden-item">
                    <div className="bw-field">
                      <label>Name:</label>
                      <span>{bitwardenItem.name}</span>
                    </div>
                    <div className="bw-field">
                      <label>Username:</label>
                      <span>{bitwardenItem.username || '-'}</span>
                      {bitwardenItem.username && (
                        <button className="copy-btn" onClick={() => copyToClipboard(bitwardenItem.username)}>📋</button>
                      )}
                    </div>
                    <div className="bw-field">
                      <label>Password:</label>
                      <span>{bitwardenItem.hasPassword ? '••••••••' : '-'}</span>
                      {bitwardenItem.password && (
                        <button className="copy-btn" onClick={() => copyToClipboard(bitwardenItem.password)}>📋</button>
                      )}
                    </div>
                    <button className="btn-small danger" onClick={() => setBitwardenItem(null)}>Unlink</button>
                  </div>
                ) : (
                  <div className="bitwarden-search">
                    <div className="search-row">
                      <input
                        type="text"
                        placeholder="Search Bitwarden..."
                        value={bitwardenSearch}
                        onChange={e => setBitwardenSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && searchBitwarden()}
                      />
                      <button onClick={searchBitwarden} disabled={settingsLoading}>Search</button>
                    </div>
                    {bitwardenResults.length > 0 && (
                      <ul className="bw-results">
                        {bitwardenResults.map(item => (
                          <li key={item.id} onClick={() => selectBitwardenItem(item)}>
                            <strong>{item.name}</strong>
                            <span>{item.username}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="settings-section">
                <h3>📝 Site Notes</h3>
                <textarea
                  value={platformNotes}
                  onChange={e => setPlatformNotes(e.target.value)}
                  placeholder="Add notes about this platform..."
                  rows={5}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setSettingsModal(null)}>Cancel</button>
              <button className="btn-save" onClick={saveSettings} disabled={settingsLoading}>
                {settingsLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Settings Modal */}
      {showGlobalSettings && (
        <div className="modal-overlay" onClick={() => setShowGlobalSettings(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙️ Global Settings</h2>
              <button className="modal-close" onClick={() => setShowGlobalSettings(false)}>×</button>
            </div>

            {/* Settings Tabs */}
            <div className="settings-tabs">
              {[
                { id: 'cloudflare', label: '☁️ Cloudflare' },
                { id: 'gsc', label: '🔍 Search Console' },
                { id: 'dataforseo', label: '📊 DataForSEO' },
                { id: 'openai', label: '🤖 OpenAI' },
                { id: 'sites', label: '🌐 Sites' },
                { id: 'export', label: '📥 Export' },
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`settings-tab ${settingsTab === tab.id ? 'active' : ''}`}
                  onClick={() => setSettingsTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="modal-body">
              {/* Cloudflare Settings */}
              {settingsTab === 'cloudflare' && (
                <div className="settings-section">
                  <h3>☁️ Cloudflare API</h3>
                  <p className="settings-description">Configure Cloudflare API credentials for cache purging, DNS management, and WAF rules.</p>

                  <div className="settings-form">
                    <div className="form-group">
                      <label>Zone ID</label>
                      <input
                        type="text"
                        value={globalSettings.cloudflare?.zoneId || ''}
                        onChange={e => setGlobalSettings(prev => ({
                          ...prev,
                          cloudflare: { ...prev.cloudflare, zoneId: e.target.value }
                        }))}
                        placeholder="e.g., 1fce7632151a0095ddba753d9b024645"
                      />
                    </div>
                    <div className="form-group">
                      <label>API Token</label>
                      <input
                        type="password"
                        value={globalSettings.cloudflare?.apiToken || ''}
                        onChange={e => setGlobalSettings(prev => ({
                          ...prev,
                          cloudflare: { ...prev.cloudflare, apiToken: e.target.value }
                        }))}
                        placeholder="API Token with Zone permissions"
                      />
                    </div>
                    <div className="form-group">
                      <label>Email (optional)</label>
                      <input
                        type="email"
                        value={globalSettings.cloudflare?.email || ''}
                        onChange={e => setGlobalSettings(prev => ({
                          ...prev,
                          cloudflare: { ...prev.cloudflare, email: e.target.value }
                        }))}
                        placeholder="Account email"
                      />
                    </div>
                    <button className="secondary-btn" onClick={() => testApiConnection('cloudflare')}>
                      Test Connection
                    </button>
                  </div>

                  <h4 style={{ marginTop: '20px', color: '#fff' }}>Available API Features</h4>
                  <div className="api-features-grid">
                    {[
                      { name: 'Cache Purge', available: true },
                      { name: 'DNS Records', available: true },
                      { name: 'Firewall Rules', available: true },
                      { name: 'Page Rules', available: true },
                      { name: 'Analytics', available: true },
                      { name: 'SSL/TLS Settings', available: true },
                      { name: 'WAF Rules', available: true },
                      { name: 'Rate Limiting', available: true },
                      { name: 'Bot Management', available: true },
                      { name: 'Workers', available: true },
                    ].map(f => (
                      <div key={f.name} className={`api-feature-item ${f.available ? 'available' : 'unavailable'}`}>
                        {f.available ? '✓' : '✗'} {f.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Google Search Console Settings */}
              {settingsTab === 'gsc' && (
                <div className="settings-section">
                  <h3>🔍 Google Search Console API</h3>
                  <p className="settings-description">Service account credentials for GSC API access.</p>

                  <div className="settings-form">
                    <div className="form-group">
                      <label>Project ID</label>
                      <input
                        type="text"
                        value={globalSettings.gsc?.projectId || ''}
                        onChange={e => setGlobalSettings(prev => ({
                          ...prev,
                          gsc: { ...prev.gsc, projectId: e.target.value }
                        }))}
                        placeholder="e.g., boyvue-seo"
                      />
                    </div>
                    <div className="form-group">
                      <label>Client Email</label>
                      <input
                        type="email"
                        value={globalSettings.gsc?.clientEmail || ''}
                        onChange={e => setGlobalSettings(prev => ({
                          ...prev,
                          gsc: { ...prev.gsc, clientEmail: e.target.value }
                        }))}
                        placeholder="service-account@project.iam.gserviceaccount.com"
                      />
                    </div>
                    <div className="form-group">
                      <label>Private Key (JSON)</label>
                      <textarea
                        value={globalSettings.gsc?.privateKey || ''}
                        onChange={e => setGlobalSettings(prev => ({
                          ...prev,
                          gsc: { ...prev.gsc, privateKey: e.target.value }
                        }))}
                        placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                        rows={4}
                      />
                    </div>
                    <button className="secondary-btn" onClick={() => testApiConnection('gsc')}>
                      Test Connection
                    </button>
                  </div>

                  <h4 style={{ marginTop: '20px', color: '#fff' }}>Available API Features</h4>
                  <div className="api-features-grid">
                    {[
                      { name: 'Search Analytics', available: true },
                      { name: 'URL Inspection', available: true },
                      { name: 'Sitemap Submit', available: true },
                      { name: 'Sitemap Status', available: true },
                      { name: 'Index Coverage', available: true },
                      { name: 'Mobile Usability', available: true },
                      { name: 'Core Web Vitals', available: true },
                      { name: 'Links Report', available: true },
                      { name: 'Rich Results', available: true },
                      { name: 'Manual Actions', available: true },
                    ].map(f => (
                      <div key={f.name} className={`api-feature-item ${f.available ? 'available' : 'unavailable'}`}>
                        {f.available ? '✓' : '✗'} {f.name}
                      </div>
                    ))}
                  </div>

                  {apiStatus.gsc?.sites?.length > 0 && (
                    <>
                      <h4 style={{ marginTop: '20px', color: '#fff' }}>Connected Sites</h4>
                      <div className="site-url-list">
                        {apiStatus.gsc.sites.map((site, i) => (
                          <div key={i} className="site-url-item">
                            <span className="site-url-value">{site}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* DataForSEO Settings */}
              {settingsTab === 'dataforseo' && (
                <div className="settings-section">
                  <h3>📊 DataForSEO API</h3>
                  <p className="settings-description">Comprehensive SEO data API for keyword research, SERP tracking, and competitor analysis.</p>

                  <div className="settings-form">
                    <div className="form-group">
                      <label>Login (Email)</label>
                      <input
                        type="email"
                        value={globalSettings.dataforseo?.login || ''}
                        onChange={e => setGlobalSettings(prev => ({
                          ...prev,
                          dataforseo: { ...prev.dataforseo, login: e.target.value }
                        }))}
                        placeholder="your@email.com"
                      />
                    </div>
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        value={globalSettings.dataforseo?.password || ''}
                        onChange={e => setGlobalSettings(prev => ({
                          ...prev,
                          dataforseo: { ...prev.dataforseo, password: e.target.value }
                        }))}
                        placeholder="API Password"
                      />
                    </div>
                    <button className="secondary-btn" onClick={() => testApiConnection('dataforseo')}>
                      Test Connection
                    </button>
                    {apiStatus.dataforseo?.balance > 0 && (
                      <p style={{ color: '#4caf50', marginTop: '10px' }}>
                        Balance: ${apiStatus.dataforseo.balance.toFixed(2)}
                      </p>
                    )}
                  </div>

                  <h4 style={{ marginTop: '20px', color: '#fff' }}>Available API Features</h4>
                  <div className="api-features-grid">
                    {[
                      { name: 'SERP Tracking', available: true },
                      { name: 'Keyword Research', available: true },
                      { name: 'Competitor Keywords', available: true },
                      { name: 'Backlink Analysis', available: true },
                      { name: 'Domain Analytics', available: true },
                      { name: 'On-Page SEO', available: true },
                      { name: 'Content Analysis', available: true },
                      { name: 'Keyword Suggestions', available: true },
                      { name: 'Search Volume', available: true },
                      { name: 'Rank Tracking', available: true },
                      { name: 'Local SEO', available: true },
                      { name: 'Business Data', available: true },
                    ].map(f => (
                      <div key={f.name} className={`api-feature-item ${f.available ? 'available' : 'unavailable'}`}>
                        {f.available ? '✓' : '✗'} {f.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OpenAI Settings */}
              {settingsTab === 'openai' && (
                <div className="settings-section">
                  <h3>🤖 OpenAI API</h3>
                  <p className="settings-description">For AI-powered content generation and translation.</p>

                  <div className="settings-form">
                    <div className="form-group">
                      <label>API Key</label>
                      <input
                        type="password"
                        value={globalSettings.openai?.apiKey || ''}
                        onChange={e => setGlobalSettings(prev => ({
                          ...prev,
                          openai: { ...prev.openai, apiKey: e.target.value }
                        }))}
                        placeholder="sk-..."
                      />
                    </div>
                    <button className="secondary-btn" onClick={() => testApiConnection('openai')}>
                      Test Connection
                    </button>
                  </div>

                  <h4 style={{ marginTop: '20px', color: '#fff' }}>Used For</h4>
                  <div className="api-features-grid">
                    {[
                      { name: 'i18n Translations', available: true },
                      { name: 'Meta Descriptions', available: true },
                      { name: 'Content Generation', available: true },
                      { name: 'Keyword Extraction', available: true },
                    ].map(f => (
                      <div key={f.name} className={`api-feature-item ${f.available ? 'available' : 'unavailable'}`}>
                        {f.available ? '✓' : '✗'} {f.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Site URLs */}
              {settingsTab === 'sites' && (
                <div className="settings-section">
                  <h3>🌐 Site Configuration</h3>
                  <p className="settings-description">All managed sites and their URLs.</p>
                  <div className="site-url-list">
                    {SITES.map(site => (
                      <div key={site.id} className="site-url-item">
                        <span className="site-icon-small">{site.icon}</span>
                        <span className="site-name-label">{site.name}</span>
                        <span className="site-url-value">{site.url}</span>
                        <span style={{ marginLeft: 'auto', color: site.color }}>●</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Export Options */}
              {settingsTab === 'export' && (
                <div className="settings-section">
                  <h3>📥 Data Export</h3>
                  <p className="settings-description">Export analytics and SEO data in various formats.</p>

                  <div style={{ display: 'grid', gap: '20px' }}>
                    <div className="export-card" style={{ background: '#1a1a2e', padding: '15px', borderRadius: '8px' }}>
                      <h4 style={{ color: '#fff', margin: '0 0 10px' }}>Search Analytics</h4>
                      <p style={{ color: '#888', fontSize: '13px', margin: '0 0 15px' }}>Keywords, clicks, impressions, CTR, and positions</p>
                      <div className="export-buttons">
                        <button className="export-btn excel" onClick={() => exportData('xlsx', 'analytics')}>
                          📊 Excel
                        </button>
                        <button className="export-btn" onClick={() => exportData('csv', 'analytics')}>
                          📄 CSV
                        </button>
                        <button className="export-btn pdf" onClick={() => exportData('pdf', 'analytics')}>
                          📑 PDF
                        </button>
                      </div>
                    </div>

                    <div className="export-card" style={{ background: '#1a1a2e', padding: '15px', borderRadius: '8px' }}>
                      <h4 style={{ color: '#fff', margin: '0 0 10px' }}>Keyword Rankings</h4>
                      <p style={{ color: '#888', fontSize: '13px', margin: '0 0 15px' }}>Historical ranking data for tracked keywords</p>
                      <div className="export-buttons">
                        <button className="export-btn excel" onClick={() => exportData('xlsx', 'rankings')}>
                          📊 Excel
                        </button>
                        <button className="export-btn" onClick={() => exportData('csv', 'rankings')}>
                          📄 CSV
                        </button>
                      </div>
                    </div>

                    <div className="export-card" style={{ background: '#1a1a2e', padding: '15px', borderRadius: '8px' }}>
                      <h4 style={{ color: '#fff', margin: '0 0 10px' }}>Competitor Analysis</h4>
                      <p style={{ color: '#888', fontSize: '13px', margin: '0 0 15px' }}>Competitor keywords, backlinks, and rankings</p>
                      <div className="export-buttons">
                        <button className="export-btn excel" onClick={() => exportData('xlsx', 'competitors')}>
                          📊 Excel
                        </button>
                        <button className="export-btn" onClick={() => exportData('csv', 'competitors')}>
                          📄 CSV
                        </button>
                      </div>
                    </div>

                    <div className="export-card" style={{ background: '#1a1a2e', padding: '15px', borderRadius: '8px' }}>
                      <h4 style={{ color: '#fff', margin: '0 0 10px' }}>Traffic Report</h4>
                      <p style={{ color: '#888', fontSize: '13px', margin: '0 0 15px' }}>Site traffic, sources, and visitor analytics</p>
                      <div className="export-buttons">
                        <button className="export-btn excel" onClick={() => exportData('xlsx', 'traffic')}>
                          📊 Excel
                        </button>
                        <button className="export-btn pdf" onClick={() => exportData('pdf', 'traffic')}>
                          📑 PDF Report
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', padding: '15px', background: '#252', borderRadius: '8px', border: '1px solid #4caf50' }}>
                    <h4 style={{ color: '#4caf50', margin: '0 0 8px' }}>📈 Charts & Visualization</h4>
                    <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
                      Using Recharts for interactive data visualization. Charts are available in the full SEO dashboard.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowGlobalSettings(false)}>Cancel</button>
              <button className="btn-save" onClick={saveGlobalSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{adminStyles}</style>
    </div>
  );
}

const loginStyles = `
  .unified-admin-login {
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .login-box {
    background: #252540;
    padding: 40px;
    border-radius: 12px;
    width: 400px;
    text-align: center;
  }
  .login-box h1 {
    color: #fff;
    margin: 0 0 8px;
  }
  .login-box .subtitle {
    color: #888;
    margin: 0 0 30px;
    font-size: 14px;
  }
  .login-box form {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  .login-box input {
    padding: 12px 16px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 6px;
    color: #fff;
    font-size: 14px;
  }
  .login-box button {
    padding: 12px;
    background: linear-gradient(135deg, #f60 0%, #c00 100%);
    border: none;
    border-radius: 6px;
    color: #fff;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
  }
  .login-box button:disabled {
    opacity: 0.5;
  }
  .login-box .error {
    color: #f44;
    margin: 0;
    font-size: 13px;
  }
  .login-box .back-link {
    display: block;
    margin-top: 20px;
    color: #888;
    text-decoration: none;
  }
`;

const adminStyles = `
  .unified-admin {
    min-height: 100vh;
    background: #1a1a2e;
    color: #fff;
  }
  .admin-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 15px 25px;
    background: #252540;
    border-bottom: 1px solid #333;
  }
  .header-left h1 {
    margin: 0;
    font-size: 20px;
  }
  .site-selector {
    display: flex;
    gap: 8px;
  }
  .site-btn {
    padding: 8px 16px;
    background: #333;
    border: none;
    border-radius: 6px;
    color: #888;
    cursor: pointer;
    transition: all 0.2s;
  }
  .site-btn:hover {
    background: #444;
    color: #fff;
  }
  .site-btn.active {
    background: var(--site-color);
    color: #fff;
  }
  .header-right {
    display: flex;
    gap: 10px;
  }
  .view-site-btn, .logout-btn {
    padding: 8px 16px;
    background: #333;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    text-decoration: none;
  }
  .view-site-btn:hover, .logout-btn:hover {
    background: #444;
  }

  .admin-content {
    padding: 25px;
  }
  .site-panel {
    background: #252540;
    border-radius: 12px;
    padding: 25px;
  }
  .site-panel h2 {
    margin: 0 0 20px;
    color: #fff;
  }
  .info-card {
    background: #1a1a2e;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  .info-card h2 {
    margin: 0 0 10px;
  }
  .info-card p {
    color: #888;
    margin: 0 0 15px;
  }
  .primary-btn {
    display: inline-block;
    padding: 10px 20px;
    background: linear-gradient(135deg, #f60 0%, #c00 100%);
    border: none;
    border-radius: 6px;
    color: #fff;
    font-weight: bold;
    cursor: pointer;
    text-decoration: none;
  }
  .secondary-btn {
    padding: 10px 20px;
    background: #333;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
  }
  .action-buttons {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }

  /* Fans Panel */
  .fans-panel {
    padding: 0;
  }
  .fans-nav {
    display: flex;
    gap: 5px;
    padding: 15px 20px;
    background: #1a1a2e;
    border-radius: 12px 12px 0 0;
    overflow-x: auto;
  }
  .fans-nav button {
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #888;
    cursor: pointer;
    white-space: nowrap;
  }
  .fans-nav button:hover {
    background: #333;
    color: #fff;
  }
  .fans-nav button.active {
    background: #9c27b0;
    color: #fff;
  }
  .fans-content {
    padding: 25px;
  }
  .tab-content h3 {
    margin: 0 0 20px;
    color: #fff;
  }
  .tab-content h4 {
    margin: 25px 0 15px;
    color: #9c27b0;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    margin-bottom: 25px;
  }
  .stat-card {
    background: #1a1a2e;
    padding: 20px;
    border-radius: 8px;
    text-align: center;
  }
  .stat-card .value {
    display: block;
    font-size: 28px;
    font-weight: bold;
    color: #fff;
  }
  .stat-card .label {
    display: block;
    font-size: 13px;
    color: #888;
    margin-top: 5px;
  }

  /* Data Tables */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .data-table th {
    text-align: left;
    padding: 10px;
    border-bottom: 1px solid #333;
    color: #888;
  }
  .data-table td {
    padding: 10px;
    border-bottom: 1px solid #222;
  }
  .data-table a {
    color: #9c27b0;
  }
  .data-table code {
    background: #1a1a2e;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
  }
  .status-completed, .status-ok { color: #4caf50; }
  .status-running, .status-pending { color: #ff9800; }
  .status-failed, .status-error { color: #f44336; }

  .two-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
  }
  @media (max-width: 900px) {
    .two-columns {
      grid-template-columns: 1fr;
    }
  }

  /* Action button in table */
  .action-btn {
    padding: 5px 10px;
    background: #333;
    border: none;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    font-size: 12px;
  }
  .action-btn:hover {
    background: #444;
  }

  .settings-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    margin-right: 6px;
    opacity: 0.7;
  }
  .settings-btn:hover {
    opacity: 1;
  }
  .linked-badge {
    font-size: 12px;
    margin-left: 6px;
  }

  /* Loading */
  .loading, .admin-loading {
    text-align: center;
    padding: 40px;
    color: #888;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal-content {
    background: #252540;
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #333;
  }
  .modal-header h2 {
    margin: 0;
    font-size: 18px;
  }
  .modal-close {
    background: none;
    border: none;
    color: #888;
    font-size: 24px;
    cursor: pointer;
  }
  .modal-body {
    padding: 20px;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid #333;
  }

  .settings-section {
    margin-bottom: 24px;
  }
  .settings-section h3 {
    margin: 0 0 12px;
    font-size: 14px;
    color: #888;
  }
  .settings-section textarea {
    width: 100%;
    padding: 10px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 6px;
    color: #fff;
    resize: vertical;
    font-family: inherit;
    box-sizing: border-box;
  }

  .bitwarden-item {
    background: #1a1a2e;
    padding: 15px;
    border-radius: 8px;
  }
  .bw-field {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .bw-field label {
    color: #888;
    min-width: 80px;
    font-size: 13px;
  }
  .bw-field span {
    color: #fff;
  }
  .copy-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
  }
  .btn-small {
    padding: 5px 10px;
    background: #333;
    border: none;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    font-size: 12px;
  }
  .btn-small.danger {
    background: #c62828;
    margin-top: 10px;
  }

  .bitwarden-search .search-row {
    display: flex;
    gap: 8px;
  }
  .bitwarden-search input {
    flex: 1;
    padding: 8px 12px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 4px;
    color: #fff;
  }
  .bitwarden-search button {
    padding: 8px 16px;
    background: #9c27b0;
    border: none;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
  }
  .bw-results {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    background: #1a1a2e;
    border-radius: 4px;
    max-height: 200px;
    overflow-y: auto;
  }
  .bw-results li {
    padding: 10px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid #333;
  }
  .bw-results li:last-child {
    border-bottom: none;
  }
  .bw-results li:hover {
    background: #333;
  }
  .bw-results li strong {
    color: #fff;
  }
  .bw-results li span {
    color: #888;
    font-size: 12px;
  }

  .btn-cancel {
    padding: 10px 20px;
    background: #333;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
  }
  .btn-save {
    padding: 10px 20px;
    background: #9c27b0;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
  }
  .btn-save:disabled {
    opacity: 0.5;
  }

  /* New styles for enhanced settings */
  .site-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .site-header-row h2 {
    margin: 0;
  }
  .site-description {
    color: #888;
    margin: 0 0 20px;
    font-size: 14px;
  }
  .site-icon {
    margin-right: 6px;
  }
  .site-name {
    font-size: 13px;
  }
  .settings-btn-header {
    padding: 8px 16px;
    background: #444;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
  }
  .settings-btn-header:hover {
    background: #555;
  }
  .modal-large {
    max-width: 800px;
  }
  .settings-description {
    color: #666;
    font-size: 13px;
    margin: 0 0 15px;
  }
  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .form-group label {
    color: #888;
    font-size: 12px;
    font-weight: 500;
  }
  .form-group input,
  .form-group textarea {
    padding: 10px 12px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 6px;
    color: #fff;
    font-size: 13px;
  }
  .form-group input:focus,
  .form-group textarea:focus {
    border-color: #f60;
    outline: none;
  }
  .site-url-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .site-url-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: #1a1a2e;
    border-radius: 6px;
  }
  .site-icon-small {
    font-size: 18px;
  }
  .site-name-label {
    font-weight: 500;
    min-width: 100px;
  }
  .site-url-value {
    color: #888;
    font-size: 13px;
  }
  .api-features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-top: 12px;
  }
  .api-feature-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #1a1a2e;
    border-radius: 6px;
    font-size: 12px;
  }
  .api-feature-item.available {
    color: #4caf50;
  }
  .api-feature-item.unavailable {
    color: #666;
  }
  .export-buttons {
    display: flex;
    gap: 10px;
    margin-top: 15px;
  }
  .export-btn {
    padding: 8px 16px;
    background: #333;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .export-btn:hover {
    background: #444;
  }
  .export-btn.excel {
    background: #1d6f42;
  }
  .export-btn.pdf {
    background: #c00;
  }
  .settings-tabs {
    display: flex;
    gap: 5px;
    margin-bottom: 20px;
    border-bottom: 1px solid #333;
    padding-bottom: 10px;
  }
  .settings-tab {
    padding: 8px 16px;
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 13px;
    border-radius: 6px 6px 0 0;
  }
  .settings-tab:hover {
    color: #fff;
  }
  .settings-tab.active {
    background: #333;
    color: #fff;
  }
`;
