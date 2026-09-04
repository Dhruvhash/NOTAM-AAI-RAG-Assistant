import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext();

const DEFAULT_USER = {
  _id: 'demo_user_dhruv',
  name: 'Dhruv',
  email: 'dhruv@aai.aero',
  role: 'Flight Operations Officer',
  createdAt: '2026-07-01',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(DEFAULT_USER);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await authApi.getMe();
      if (res.data && res.data.user) {
        setUser(res.data.user);
      } else {
        setUser(DEFAULT_USER);
      }
    } catch (err) {
      setUser(DEFAULT_USER);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const res = await authApi.login({ email, password });
      if (res.data && res.data.user) {
        setUser(res.data.user);
        if (res.data.token) {
          localStorage.setItem('token', res.data.token);
        }
      }
      return res.data;
    } catch (err) {
      // Fallback to default user even if backend auth call fails
      setUser(DEFAULT_USER);
      return { user: DEFAULT_USER };
    }
  };

  const signup = async (name, email, password, role) => {
    try {
      const res = await authApi.signup({ name, email, password, role });
      if (res.data && res.data.user) {
        setUser(res.data.user);
        if (res.data.token) {
          localStorage.setItem('token', res.data.token);
        }
      }
      return res.data;
    } catch (err) {
      const newUser = { _id: 'demo_user_1', name, email, role: role || 'Pilot' };
      setUser(newUser);
      return { user: newUser };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      setUser(DEFAULT_USER);
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        checkAuth,
        updateUser,
        isAuthenticated: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

