import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios'; // assuming you centralized your axios instance

function Signup() {
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole]               = useState('user');  // default role
  const navigate = useNavigate();

  const handleSignup = async () => {
    try {
      // send only the fields your backend expects
      await axios.post('http://localhost:3000/users/signup', {
        userName:    username,
        password,
        phoneNumber,
        role,
      });
      alert('Signup successful! Please login.');
      navigate('/login');
    } catch (error) {
      // improved error handling
      if (error.response) {
        alert(`Signup failed: ${error.response.data.message || 'Unknown error'}`);
      } else {
        alert(`Signup failed: ${error.message}`);
      }
      console.error(error);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-6 rounded shadow-md w-96">
        <h2 className="text-2xl mb-4">Signup</h2>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />

        <input
          type="text"
          placeholder="Phone Number"
          value={phoneNumber}
          onChange={e => setPhoneNumber(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />

        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
          {/* add any other roles your backend supports */}
        </select>

        <button
          onClick={handleSignup}
          className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Signup
        </button>

        <p className="mt-2 text-center">
          Already have an account? <Link to="/login" className="text-blue-500">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
