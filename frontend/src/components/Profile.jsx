import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.jsx';

function Profile() {
  const { user, token, logout } = useAuth();
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const navigate = useNavigate();

  const handleUpdate = async () => {
    try {
      await axios.patch('http://localhost:3000/users/update', {
        userName: newUsername,
        password: newPassword,
        phoneNumber: newPhoneNumber,
        email: newEmail,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Profile updated!');
    } catch (error) {
      console.error('Update failed', error);
      alert('Update failed');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-6 rounded shadow-md w-96">
        <h2 className="text-2xl mb-4">Profile</h2>
        <input
          type="text"
          placeholder="New Username"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />
        <input
          type="text"
          placeholder="New Phone Number"
          value={newPhoneNumber}
          onChange={(e) => setNewPhoneNumber(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />
        <input
          type="email"
          placeholder="New Email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />
        <button
          onClick={handleUpdate}
          className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 mb-2"
        >
          Update Profile
        </button>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full p-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Profile;