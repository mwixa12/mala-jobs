import React, { createContext, useContext, useState, useEffect } from 'react';
import apiFetch, { getTokens, setTokens, clearTokens } from '../services/api.js';

const AuthContext = createContext();

function saveRememberedAccount(user) {
  if (!user) return;
  try {
    const identifier = user.email || user.phoneNumber;
    if (identifier) {
      localStorage.setItem('malajobs_last_email', identifier);
      const existingRaw = localStorage.getItem('malajobs_saved_accounts');
      let accounts = existingRaw ? JSON.parse(existingRaw) : [];
      accounts = accounts.filter(a => a.identifier !== identifier && a.email !== identifier);
      const name = user.role === 'employer'
        ? (user.employer?.displayName || user.employer?.display_name || 'Employer')
        : (user.profile?.fullName || user.profile?.full_name || 'Job Seeker');

      accounts.unshift({
        identifier,
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        role: user.role,
        name,
        lastLogin: Date.now()
      });
      accounts = accounts.slice(0, 5);
      localStorage.setItem('malajobs_saved_accounts', JSON.stringify(accounts));
    }
  } catch (e) {
    // Ignore storage exceptions
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check current session on mount
  useEffect(() => {
    async function checkAuth() {
      const { accessToken } = getTokens();
      if (!accessToken) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiFetch('/auth/me');
        setUser(data.user);
        saveRememberedAccount(data.user);
      } catch (err) {
        clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Universal Login (Email or Phone + Password)
  const login = async (identifier, password, role = null) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: identifier, password, role })
    });
    setTokens(data.tokens);
    setUser(data.user);
    saveRememberedAccount(data.user);
    return data;
  };

  // Seeker Email + Password Login
  const loginSeeker = async (email, password) => {
    const data = await apiFetch('/auth/seeker/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setTokens(data.tokens);
    setUser(data.user);
    saveRememberedAccount(data.user);
    return data;
  };

  // Seeker Email + Password Register
  const registerSeeker = async ({ email, password, fullName, phoneNumber }) => {
    const data = await apiFetch('/auth/seeker/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName, phoneNumber })
    });
    setTokens(data.tokens);
    setUser(data.user);
    saveRememberedAccount(data.user);
    return data;
  };

  // Request OTP for Seeker Phone
  const requestOtp = async (phoneNumber) => {
    return await apiFetch('/auth/seeker/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber })
    });
  };

  // Verify OTP for Seeker Phone
  const verifyOtp = async (phoneNumber, otpCode, fullName) => {
    const data = await apiFetch('/auth/seeker/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, otpCode, fullName })
    });
    setTokens(data.tokens);
    setUser(data.user);
    saveRememberedAccount(data.user);
    return data;
  };

  // Send Email Code for Employer
  const sendEmployerEmailCode = async (email) => {
    return await apiFetch('/auth/employer/send-verification-code', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  };

  // Employer Register
  const registerEmployer = async (formData) => {
    const data = await apiFetch('/auth/employer/register', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    setTokens(data.tokens);
    setUser(data.user);
    saveRememberedAccount(data.user);
    return data;
  };

  // Employer Login
  const loginEmployer = async (email, password) => {
    const data = await apiFetch('/auth/employer/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setTokens(data.tokens);
    setUser(data.user);
    saveRememberedAccount(data.user);
    return data;
  };

  // Admin Login
  const loginAdmin = async (email, password) => {
    const data = await apiFetch('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setTokens(data.tokens);
    setUser(data.user);
    saveRememberedAccount(data.user);
    return data;
  };

  // Logout (preserves remembered accounts and last email for easy re-login)
  const logout = async () => {
    const { refreshToken } = getTokens();
    if (refreshToken) {
      try {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken })
        });
      } catch (err) {
        // Ignore network errors during logout
      }
    }
    clearTokens();
    setUser(null);
  };

  const refreshUserData = async () => {
    try {
      const data = await apiFetch('/auth/me');
      setUser(data.user);
      saveRememberedAccount(data.user);
    } catch (err) {
      // Ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginSeeker,
        registerSeeker,
        requestOtp,
        verifyOtp,
        sendEmployerEmailCode,
        registerEmployer,
        loginEmployer,
        loginAdmin,
        logout,
        refreshUserData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
