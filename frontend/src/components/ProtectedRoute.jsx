import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

/**
 * Wrap pages that require authentication.
 * If user or token missing -> redirect to /login
 */
export default function ProtectedRoute({ children }) {
  const { user, token } = useAuth();

  // You can use either user or token depending on your app.
  // A token check is usually enough.
  if (!token && !user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
