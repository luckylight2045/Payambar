import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Signup from './components/Signup'
import ChatPage from './pages/ChatPage'
import Profile from './components/Profile'
import useAuth from './hooks/useAuth'

export default function App(){
  const { token } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={<Login/>} />
      <Route path="/signup" element={<Signup/>} />
      <Route path="/chat" element={token ? <ChatPage/> : <Navigate to="/login" />} />
      <Route path="/profile" element={token ? <Profile/> : <Navigate to="/login" />} />
      <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  )
}
