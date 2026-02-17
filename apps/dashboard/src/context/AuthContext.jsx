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

  useEffect(() => {
    // 1. Initial Profile Fetch
    if (token) {
      fetchUserProfile(token);
    } else if (refreshToken) {
      refreshAccessToken();
    } else {
      setLoading(false);
    }

    // 2. Handle Google Redirect Callback (Auth Code Flow)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
      handleGoogleCallback(code);
    }
  }, [token]);

  const handleGoogleCallback = async (code) => {
    setLoading(true);
    try {
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

        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("scope");
        url.searchParams.delete("authuser");
        url.searchParams.delete("prompt");
        window.history.replaceState({}, "", url.pathname + url.search);
      } else {
        console.error("Backend redirect login failed");
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
        throw new Error("Update failed");
      }
    } catch (error) {
      console.error("Update profile error", error);
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
        loading,
        loginWithGoogle,
        logout,
        updateProfile,
        loginResponse,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
