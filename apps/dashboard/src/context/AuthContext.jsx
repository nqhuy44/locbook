"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { googleLogout, useGoogleLogin } from "@react-oauth/google";
import { API_URL } from "@/lib/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [refreshToken, setRefreshToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loginResponse, setLoginResponse] = useState(null);

    const codeExchanged = React.useRef(false);

    // Hydrate tokens from localStorage on mount
    useEffect(() => {
        const savedToken = localStorage.getItem("auth_token");
        const savedRefresh = localStorage.getItem("refresh_token");
        setToken(savedToken);
        setRefreshToken(savedRefresh);

        if (savedToken) {
            fetchUserProfile(savedToken);
        } else if (savedRefresh) {
            refreshAccessToken(savedRefresh);
        } else {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Handle Google Redirect Callback (Auth Code Flow)
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

    const refreshAccessToken = async (rt) => {
        const currentRefresh = rt || refreshToken;
        if (!currentRefresh) return null;
        try {
            const res = await fetch(`${API_URL}/api/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: currentRefresh }),
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
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
                localStorage.setItem("auth_token", authToken);
            } else if (res.status === 401) {
                const savedRefresh = localStorage.getItem("refresh_token");
                if (savedRefresh) {
                    const newToken = await refreshAccessToken(savedRefresh);
                    if (newToken) return fetchUserProfile(newToken);
                }
                logout();
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
        redirect_uri: typeof window !== "undefined" ? window.location.origin : "",
        onError: (error) => console.error("Google Login Failed", error),
    });

    const updateProfile = async (updates) => {
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
            let currentToken = localStorage.getItem("auth_token");
            let res = await apiCall(currentToken);
            if (res.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) res = await apiCall(newToken);
            }

            if (res.ok) {
                const updatedProfile = await res.json();
                setUser((prev) => ({ ...prev, ...updatedProfile }));
                return updatedProfile;
            } else {
                const errBody = await res.json().catch(() => ({ detail: "Update failed" }));
                throw new Error(errBody.detail || "Update failed");
            }
        } catch (error) {
            console.error("Update profile error", error);
            throw error;
        }
    };

    const fetchWithAuth = async (url, options = {}) => {
        let currentToken = localStorage.getItem("auth_token");
        const headers = {
            "Content-Type": "application/json",
            ...options.headers,
            ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        };

        try {
            let res = await fetch(url, { ...options, headers });
            if (res.status === 401) {
                const savedRefresh = localStorage.getItem("refresh_token");
                if (savedRefresh) {
                    console.log("Token expired, refreshing...");
                    const newToken = await refreshAccessToken(savedRefresh);
                    if (newToken) {
                        headers.Authorization = `Bearer ${newToken}`;
                        res = await fetch(url, { ...options, headers });
                    }
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
                fetchWithAuth,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
