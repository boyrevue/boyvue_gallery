import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PerformersPage from './pages/PerformersPage';
import PerformerPage from './pages/PerformerPage';
import ThemesPage from './pages/ThemesPage';
import ThemePage from './pages/ThemePage';
import LiveNowPage from './pages/LiveNowPage';
import PlatformPage from './pages/PlatformPage';
import AdminDashboard from './pages/AdminDashboard';
import HotOrNotPage from './pages/HotOrNotPage';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="performers" element={<PerformersPage />} />
          <Route path="performers/:id" element={<PerformerPage />} />
          <Route path="themes" element={<ThemesPage />} />
          <Route path="themes/:slug" element={<ThemePage />} />
          <Route path="live" element={<LiveNowPage />} />
          <Route path="platforms/:slug" element={<PlatformPage />} />
          <Route path="hot-or-not" element={<HotOrNotPage />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
