import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function Login(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    try {
      const res = await axios.post('http://localhost:3000/users/login', { userName: username, password })
      const { access_token } = res.data
      login({ username, id: username }, access_token)
      navigate('/chat')
    } catch (e) {
      console.error(e)
      alert('Login failed')
    }
  }

  return (
    <div className="auth-page">
      <div className="card">
        <h2>Login</h2>
        <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button onClick={handleLogin}>Login</button>
        <p>Don't have an account? <Link to="/signup">Signup</Link></p>
      </div>
    </div>
  )
}
