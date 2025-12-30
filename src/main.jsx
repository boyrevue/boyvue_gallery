import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

// Simple path-based routing
const path = window.location.pathname;
const isAdmin = path === '/seo-dashboard' || path.startsWith('/seo-dashboard/');

ReactDOM.createRoot(document.getElementById('root')).render(
  isAdmin ? <AdminDashboard /> : <App />
);
