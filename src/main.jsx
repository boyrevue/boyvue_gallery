import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import UnifiedAdmin from './pages/UnifiedAdmin.jsx';

// Simple path-based routing
const path = window.location.pathname;

// /admin - Unified admin (central control)
// /admin/full or /seo-dashboard - Full SEO admin dashboard
const isUnifiedAdmin = path === '/admin' || path.startsWith('/admin/') && !path.startsWith('/admin/full');
const isFullAdmin = path === '/seo-dashboard' || path.startsWith('/seo-dashboard/') || path === '/admin/full' || path.startsWith('/admin/full/');

let RootComponent = App;
if (isUnifiedAdmin) RootComponent = UnifiedAdmin;
else if (isFullAdmin) RootComponent = AdminDashboard;

ReactDOM.createRoot(document.getElementById('root')).render(
  <RootComponent />
);
