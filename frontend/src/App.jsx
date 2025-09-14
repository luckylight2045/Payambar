// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import ChatPage from './pages/ChatPage';
import Profile from './components/Profile';
import useAuth from './hooks/useAuth';

export default function App() {
  const { token, ready } = useAuth();

  if (!ready) {
    return <div style={{height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#071019', color:'#e6eef6'}}>Loading…</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/chat" element={token ? <ChatPage /> : <Navigate to="/login" replace />} />
      <Route path="/profile" element={token ? <Profile /> : <Navigate to="/login" replace />} />
      <Route path="/" element={<Navigate to={token ? '/chat' : '/login'} replace />} />
    </Routes>
  );
}
