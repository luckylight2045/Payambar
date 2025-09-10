import React, { useState } from 'react'
import axios from 'axios'
import useAuth from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

export default function Profile(){
  const { user, token, logout } = useAuth()
  const [newUsername, setNewUsername] = useState(user?.username || '')
  const [newPassword, setNewPassword] = useState('')
  const [newPhoneNumber, setNewPhoneNumber] = useState('')
  const navigate = useNavigate()

  const handleUpdate = async () => {
    try {
      await axios.patch('http://localhost:3000/users/update', { userName: newUsername, password: newPassword, phoneNumber: newPhoneNumber }, { headers: { Authorization: `Bearer ${token}` } })
      alert('Profile updated')
    } catch (e) {
      console.error(e)
      alert('Update failed')
    }
  }

  return (
    <div className="auth-page">
      <div className="card">
        <h2>Profile</h2>
        <input value={newUsername} onChange={e=>setNewUsername(e.target.value)} />
        <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
        <input value={newPhoneNumber} onChange={e=>setNewPhoneNumber(e.target.value)} />
        <button onClick={handleUpdate}>Update Profile</button>
        <button onClick={() => { logout(); navigate('/login') }}>Logout</button>
      </div>
    </div>
  )
}
