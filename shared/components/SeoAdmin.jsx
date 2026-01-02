import React, { useState, useEffect } from 'react';

const API_BASE = '/api/admin';

export default function SeoAdmin({ siteName, siteUrl, token }) {
  const [activeTab, setActiveTab] = useState('sitemaps');
  const [loading, setLoading] = useState(false);
  const [seoStatus, setSeoStatus] = useState({ sitemaps: [], languages: [] });
  const [cloudflareStatus, setCloudflareStatus] = useState(null);
  const [gscData, setGscData] = useState({ sitemaps: [] });

  useEffect(() => {
    if (token) {
      loadSeoStatus();
    }
  }, [token]);

  const loadSeoStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/seo/status`, {
        headers: { 'X-Admin-Token': token }
      });
      if (res.ok) {
        setSeoStatus(await res.json());
      }
    } catch (err) {
      console.error('Error loading SEO status:', err);
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
      alert(data.success ? 'Sitemaps regenerated!' : 'Error: ' + data.error);
      loadSeoStatus();
    } catch {
      alert('Error regenerating sitemaps');
    }
    setLoading(false);
  };

  const testCloudflare = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrations/cloudflare/test`, {
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      setCloudflareStatus(data.success ? 'connected' : 'error');
      alert(data.success ? 'Cloudflare connected!' : 'Connection failed: ' + data.error);
    } catch {
      setCloudflareStatus('error');
      alert('Error testing Cloudflare');
    }
  };

  const purgeCloudflareSitemaps = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/integrations/cloudflare/purge-sitemaps`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      alert(data.success ? 'Cloudflare cache purged for sitemaps!' : 'Error: ' + data.error);
    } catch {
      alert('Error purging Cloudflare cache');
    }
    setLoading(false);
  };

  const purgeCloudflareAll = async () => {
    if (!confirm('Purge entire Cloudflare cache? This may increase load on your server.')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/integrations/cloudflare/purge-all`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      alert(data.success ? 'Cloudflare cache purged!' : 'Error: ' + data.error);
    } catch {
      alert('Error purging Cloudflare cache');
    }
    setLoading(false);
  };

  const loadGscSitemaps = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrations/gsc/sitemaps?site=${encodeURIComponent(siteUrl)}`, {
        headers: { 'X-Admin-Token': token }
      });
      if (res.ok) {
        setGscData(await res.json());
      }
    } catch (err) {
      console.error('Error loading GSC data:', err);
    }
  };

  const submitToGsc = async (sitemapUrl) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/integrations/gsc/submit-sitemap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ site: siteUrl, sitemap: sitemapUrl })
      });
      const data = await res.json();
      alert(data.success ? 'Sitemap submitted to GSC!' : 'Error: ' + data.error);
      loadGscSitemaps();
    } catch {
      alert('Error submitting to GSC');
    }
    setLoading(false);
  };

  const styles = {
    container: { background: '#1a1a2e', borderRadius: '8px', padding: '20px', marginTop: '20px' },
    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #333' },
    tab: { padding: '10px 20px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' },
    tabActive: { padding: '10px 20px', background: 'transparent', border: 'none', color: '#00d4ff', cursor: 'pointer', borderBottom: '2px solid #00d4ff' },
    section: { background: '#16213e', padding: '15px', borderRadius: '6px', marginBottom: '15px' },
    sectionTitle: { color: '#00d4ff', margin: '0 0 10px', fontSize: '14px', fontWeight: 'bold' },
    btn: { padding: '8px 16px', background: '#00d4ff', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' },
    btnSecondary: { padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' },
    btnDanger: { padding: '8px 16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
    th: { textAlign: 'left', padding: '8px', borderBottom: '1px solid #333', color: '#888' },
    td: { padding: '8px', borderBottom: '1px solid #222' },
    statusOk: { color: '#4caf50' },
    statusErr: { color: '#f44336' },
    statusWarn: { color: '#ff9800' },
    tag: { display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', marginRight: '4px' },
  };

  return (
    <div style={styles.container}>
      <h2 style={{ color: '#fff', margin: '0 0 20px' }}>SEO Admin - {siteName}</h2>

      <div style={styles.tabs}>
        {['sitemaps', 'cloudflare', 'gsc', 'i18n'].map(tab => (
          <button
            key={tab}
            style={activeTab === tab ? styles.tabActive : styles.tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'gsc') loadGscSitemaps();
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'sitemaps' && (
        <div>
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Sitemap Status</h4>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Sitemap</th>
                  <th style={styles.th}>URLs</th>
                  <th style={styles.th}>Last Modified</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(seoStatus.sitemaps || []).map((s, i) => (
                  <tr key={i}>
                    <td style={styles.td}><a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff' }}>{s.name || s.url}</a></td>
                    <td style={styles.td}>{s.urlCount || '-'}</td>
                    <td style={styles.td}>{s.lastmod ? new Date(s.lastmod).toLocaleDateString() : '-'}</td>
                    <td style={styles.td}>
                      <span style={s.status === 'ok' ? styles.statusOk : styles.statusErr}>
                        {s.status || 'unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '15px' }}>
              <button style={styles.btn} onClick={regenerateSitemaps} disabled={loading}>
                {loading ? 'Working...' : 'Regenerate Sitemaps'}
              </button>
            </div>
          </div>

          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Supported Languages</h4>
            <div>
              {(seoStatus.languages || ['en']).map(lang => (
                <span key={lang} style={{ ...styles.tag, background: '#333' }}>{lang}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cloudflare' && (
        <div>
          <div style={styles.section}>
            <h4 style={{ ...styles.sectionTitle, color: '#f38020' }}>Cloudflare Integration</h4>
            <p style={{ color: '#888', margin: '0 0 15px' }}>
              Manage Cloudflare cache for {siteName}
            </p>
            <div>
              <button style={styles.btn} onClick={testCloudflare}>Test Connection</button>
              <button style={styles.btnSecondary} onClick={purgeCloudflareSitemaps} disabled={loading}>
                Purge Sitemap Cache
              </button>
              <button style={styles.btnDanger} onClick={purgeCloudflareAll} disabled={loading}>
                Purge All Cache
              </button>
            </div>
            {cloudflareStatus && (
              <p style={{ marginTop: '10px', color: cloudflareStatus === 'connected' ? '#4caf50' : '#f44336' }}>
                Status: {cloudflareStatus}
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'gsc' && (
        <div>
          <div style={styles.section}>
            <h4 style={{ ...styles.sectionTitle, color: '#4285f4' }}>Google Search Console</h4>
            <p style={{ color: '#888', margin: '0 0 15px' }}>
              Site: {siteUrl}
            </p>
            <button style={styles.btn} onClick={loadGscSitemaps}>Refresh</button>
          </div>

          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Sitemaps in GSC</h4>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Path</th>
                  <th style={styles.th}>Submitted</th>
                  <th style={styles.th}>Indexed</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(gscData.sitemaps || []).map((sm, i) => (
                  <tr key={i}>
                    <td style={styles.td}>{sm.path}</td>
                    <td style={styles.td}>{sm.submitted || 0}</td>
                    <td style={styles.td}>{sm.indexed || 0}</td>
                    <td style={styles.td}>
                      <span style={sm.errors > 0 ? styles.statusErr : sm.warnings > 0 ? styles.statusWarn : styles.statusOk}>
                        {sm.errors > 0 ? 'ERROR' : sm.warnings > 0 ? 'WARN' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Submit Sitemaps</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {(seoStatus.sitemaps || []).map((s, i) => (
                <button
                  key={i}
                  style={styles.btnSecondary}
                  onClick={() => submitToGsc(s.url)}
                  disabled={loading}
                >
                  Submit {s.name || `Sitemap ${i + 1}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'i18n' && (
        <div>
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>i18n SEO Status</h4>
            <p style={{ color: '#888', margin: '0 0 15px' }}>
              International SEO configuration for {siteName}
            </p>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Language</th>
                  <th style={styles.th}>hreflang</th>
                  <th style={styles.th}>Pages</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(seoStatus.languages || ['en']).map(lang => (
                  <tr key={lang}>
                    <td style={styles.td}>{lang}</td>
                    <td style={styles.td}><code>{lang}</code></td>
                    <td style={styles.td}>-</td>
                    <td style={styles.td}><span style={styles.statusOk}>Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
