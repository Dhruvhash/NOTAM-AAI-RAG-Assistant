import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { UploadProvider } from './context/UploadContext';

import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import NotamFeed from './pages/NotamFeed';
import ChatAssistant from './pages/ChatAssistant';
import Analytics from './pages/Analytics';
import Bookmarks from './pages/Bookmarks';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UploadProvider>
          <Router>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected Portal Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/feed" element={<NotamFeed />} />
              <Route path="/chat" element={<ChatAssistant />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Default Fallback Redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </UploadProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}
