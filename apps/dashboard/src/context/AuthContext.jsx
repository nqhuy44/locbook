import React, { createContext, useContext, useState, useEffect } from "react";
import { googleLogout, useGoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

import { API_URL } from "../utils/config";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("auth_token"));
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem("refresh_token"),
  );
  const [loading, setLoading] = useState(true);
  const [loginResponse, setLoginResponse] = useState(null);

  const codeExchanged = React.useRef(false);

  useEffect(() => {
    // 1. Initial Profile Fetch
    if (token) {
      fetchUserProfile(token);
    } else if (refreshToken) {
      refreshAccessToken();
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // 2. Handle Google Redirect Callback (Auth Code Flow)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code && !codeExchanged.current) {
      codeExchanged.current = true;
      handleGoogleCallback(code);
    }
  }, []);

  const handleGoogleCallback = async (code) => {
    setLoading(true);
    try {
      // Clean up URL parameters immediately to prevent re-triggers
      const url = new URL(window.location.href);
      ["code", "scope", "authuser", "prompt"].forEach((p) =>
        url.searchParams.delete(p),
      );
      window.history.replaceState({}, "", url.pathname + url.search);

      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code,
          redirect_uri: window.location.origin,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        setRefreshToken(data.refresh_token);
        localStorage.setItem("auth_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        setLoginResponse(data);
        await fetchUserProfile(data.access_token);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Backend redirect login failed", errData);
      }
    } catch (error) {
      console.error("Redirect Login Error", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshAccessToken = async () => {
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        localStorage.setItem("auth_token", data.access_token);
        return data.access_token;
      } else {
        logout();
        return null;
      }
    } catch (error) {
      console.error("Refresh token error", error);
      logout();
      return null;
    }
  };

  const fetchUserProfile = async (authToken) => {
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem("auth_token", authToken);
      } else if (res.status === 401 && refreshToken) {
        // Try refresh once
        const newToken = await refreshAccessToken();
        if (newToken) {
          return fetchUserProfile(newToken);
        }
      } else {
        logout();
      }
    } catch (error) {
      console.error("Failed to fetch user profile", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    flow: "auth-code",
    ux_mode: "redirect",
    redirect_uri: window.location.origin,
    onError: (error) => console.error("Google Login Failed", error),
  });

  const updateProfile = async (updates) => {
    // Simple wrapper to handle 401
    const apiCall = async (authToken) => {
      return fetch(`${API_URL}/api/users/me/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updates),
      });
    };

    try {
      let res = await apiCall(token);
      if (res.status === 401 && refreshToken) {
        const newToken = await refreshAccessToken();
        if (newToken) res = await apiCall(newToken);
      }

      if (res.ok) {
        const updatedProfile = await res.json();
        setUser((prev) => ({ ...prev, ...updatedProfile }));
        return updatedProfile;
      } else {
        const errBody = await res
          .json()
          .catch(() => ({ detail: "Update failed" }));
        throw new Error(errBody.detail || "Update failed");
      }
    } catch (error) {
      console.error("Update profile error", error);
      throw error;
    }
  };

  // Generic Fetch Wrapper with Auto-Refresh
  const fetchWithAuth = async (url, options = {}) => {
    let currentToken = localStorage.getItem("auth_token");

    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    };

    try {
      let res = await fetch(url, { ...options, headers });

      if (res.status === 401 && refreshToken) {
        console.log("Token expired, refreshing...");
        const newToken = await refreshAccessToken();
        if (newToken) {
          headers.Authorization = `Bearer ${newToken}`;
          res = await fetch(url, { ...options, headers });
        }
      }
      return res;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    googleLogout();
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setLoginResponse(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        loginWithGoogle,
        logout,
        updateProfile,
        loginResponse,
        fetchWithAuth, // Export this
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
