import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const TABS = ['overview', 'platforms', 'performers', 'themes', 'spider', 'links', 'analytics'];

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTabData();
    }
  }, [isAuthenticated, activeTab]);

  async function verifyToken() {
    try {
      const res = await fetch('/api/admin/verify', {
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
    const form = new FormData(e.target);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.get('username'),
          password: form.get('password')
        })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('adminToken', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (err) {
      alert('Login error: ' + err.message);
    }
  }

  async function fetchTabData() {
    setLoading(true);
    const headers = { 'X-Admin-Token': token };

    try {
      switch (activeTab) {
        case 'overview':
          const [statsRes, jobsRes] = await Promise.all([
            fetch('/api/creatives/admin/analytics/overview', { headers }),
            fetch('/api/creatives/admin/spider/jobs?limit=5', { headers })
          ]);
          setData({
            stats: (await statsRes.json()).stats,
            recentJobs: (await jobsRes.json()).jobs
          });
          break;

        case 'platforms':
          const platformsRes = await fetch('/api/creatives/admin/platforms', { headers });
          setData({ platforms: (await platformsRes.json()).platforms });
          break;

        case 'performers':
          const performersRes = await fetch('/api/creatives/admin/performers?limit=50', { headers });
          setData({ performers: (await performersRes.json()).performers });
          break;

        case 'themes':
          const themesRes = await fetch('/api/creatives/admin/themes', { headers });
          setData({ themes: (await themesRes.json()).themes });
          break;

        case 'spider':
          const spiderRes = await fetch('/api/creatives/admin/spider/jobs?limit=20', { headers });
          setData({ jobs: (await spiderRes.json()).jobs });
          break;

        case 'links':
          const linksRes = await fetch('/api/creatives/admin/links?limit=50', { headers });
          setData({ links: (await linksRes.json()).links });
          break;

        case 'analytics':
          const [analyticsRes, topRes, byPlatformRes] = await Promise.all([
            fetch('/api/creatives/admin/analytics/overview', { headers }),
            fetch('/api/creatives/admin/analytics/top-performers?limit=10', { headers }),
            fetch('/api/creatives/admin/analytics/by-platform', { headers })
          ]);
          setData({
            stats: (await analyticsRes.json()).stats,
            topPerformers: (await topRes.json()).performers,
            byPlatform: (await byPlatformRes.json()).platforms
          });
          break;
      }
    } catch (err) {
      console.error('Error fetching data:', err);
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
      fetchTabData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  if (loading && !isAuthenticated) return <div className="admin-loading">Loading...</div>;

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <h1>Admin Login</h1>
        <form onSubmit={handleLogin}>
          <input name="username" type="text" placeholder="Username" required />
          <input name="password" type="password" placeholder="Password" required />
          <button type="submit">Login</button>
        </form>
        <Link to="/" className="back-link">Back to site</Link>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Creatives Admin</h1>
        <div className="admin-nav">
          {TABS.map(tab => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <Link to="/" className="back-link">View Site</Link>
      </header>

      <main className="admin-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="overview-tab">
                <h2>Dashboard Overview</h2>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span className="stat-value">{data.stats?.total_clicks || 0}</span>
                    <span className="stat-label">Clicks (30d)</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{data.stats?.unique_clicks || 0}</span>
                    <span className="stat-label">Unique Clicks</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{data.stats?.promoted_performers || 0}</span>
                    <span className="stat-label">Promoted</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{data.stats?.online_now || 0}</span>
                    <span className="stat-label">Online Now</span>
                  </div>
                </div>

                <h3>Recent Spider Jobs</h3>
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
                    {(data.recentJobs || []).map(job => (
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

            {activeTab === 'platforms' && (
              <div className="platforms-tab">
                <h2>Affiliate Platforms</h2>
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
                    {(data.platforms || []).map(p => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.platform_type}</td>
                        <td>{p.account_count}</td>
                        <td>{p.performer_count}</td>
                        <td>
                          <button onClick={() => runSpider(p.slug)}>Run Spider</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'performers' && (
              <div className="performers-tab">
                <h2>Performers</h2>
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
                    {(data.performers || []).map(p => (
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

            {activeTab === 'themes' && (
              <div className="themes-tab">
                <h2>Themes</h2>
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
                    {(data.themes || []).map(t => (
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

            {activeTab === 'spider' && (
              <div className="spider-tab">
                <h2>Spider Jobs</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Platform</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Processed</th>
                      <th>Added</th>
                      <th>Errors</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.jobs || []).map(job => (
                      <tr key={job.id}>
                        <td>{job.id}</td>
                        <td>{job.platform_name}</td>
                        <td>{job.job_type}</td>
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

            {activeTab === 'links' && (
              <div className="links-tab">
                <h2>Affiliate Links</h2>
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
                    {(data.links || []).map(link => (
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

            {activeTab === 'analytics' && (
              <div className="analytics-tab">
                <h2>Analytics</h2>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span className="stat-value">{data.stats?.total_clicks || 0}</span>
                    <span className="stat-label">Total Clicks</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{data.stats?.conversions || 0}</span>
                    <span className="stat-label">Conversions</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">${data.stats?.revenue || 0}</span>
                    <span className="stat-label">Revenue</span>
                  </div>
                </div>

                <h3>Clicks by Platform</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Clicks</th>
                      <th>Unique</th>
                      <th>Conversions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.byPlatform || []).map(p => (
                      <tr key={p.platform_slug}>
                        <td>{p.platform_name}</td>
                        <td>{p.clicks}</td>
                        <td>{p.unique_clicks}</td>
                        <td>{p.conversions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3>Top Performers</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Performer</th>
                      <th>Platform</th>
                      <th>Clicks</th>
                      <th>Unique</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.topPerformers || []).map(p => (
                      <tr key={p.id}>
                        <td>{p.username}</td>
                        <td>{p.platform_name}</td>
                        <td>{p.clicks}</td>
                        <td>{p.unique_clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
