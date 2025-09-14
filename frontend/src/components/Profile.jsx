// src/components/Profile.jsx
import React, { useState } from 'react';
import useAuth from '../hooks/useAuth';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, token, logout } = useAuth();
  const [name, setName] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const navigate = useNavigate();

  const handleUpdate = async () => {
    try {
      await axios.patch('http://localhost:3000/users/update', { name, password, phoneNumber: phone }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Profile updated');
    } catch (err) { console.error(err); alert('Update failed'); }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Profile</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" type="password" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
      <div style={{ marginTop: 8 }}>
        <button onClick={handleUpdate}>Update</button>
        <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
      </div>
    </div>
  );
}
