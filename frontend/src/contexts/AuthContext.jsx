// src/contexts/AuthContext.jsx
import { createContext } from 'react';

const AuthContext = createContext({
  user: null,
  token: null,
  ready: false,
  login: () => false,
  logout: () => {},
  refreshAccessToken: async () => false,
  refreshAllTokens: async () => false,
});

export default AuthContext;
