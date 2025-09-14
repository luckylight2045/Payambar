import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'

export default function Signup(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [role, setRole] = useState('user')
  const navigate = useNavigate()

  const handleSignup = async () => {
    try {
      await axios.post('http://localhost:3000/users/signup', { name: username, password, phoneNumber, role })
      alert('Signup successful! Please login.')
      navigate('/login')
    } catch (e) {
      console.error(e)
      alert('Signup failed')
    }
  }

  return (
    <div className="auth-page">
      <div className="card">
        <h2>Signup</h2>
        <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <input placeholder="Phone Number" value={phoneNumber} onChange={e=>setPhoneNumber(e.target.value)} />
        <select value={role} onChange={e=>setRole(e.target.value)}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={handleSignup}>Signup</button>
        <p>Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  )
}
