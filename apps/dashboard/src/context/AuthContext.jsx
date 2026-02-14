import React, { createContext, useContext, useState, useEffect } from 'react';
import { googleLogout, useGoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";

import { API_URL } from '../utils/config';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('auth_token'));
    const [loading, setLoading] = useState(true);
    const [loginResponse, setLoginResponse] = useState(null); // Store login response (is_new, etc)

    useEffect(() => {
        if (token) {
            fetchUserProfile(token);
        } else {
            setLoading(false);
        }
    }, [token]);

    const fetchUserProfile = async (authToken) => {
        try {
            const res = await fetch(`${API_URL}/api/users/me`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
                localStorage.setItem('auth_token', authToken);
            } else {
                logout(); // Invalid token
            }
        } catch (error) {
            console.error("Failed to fetch user profile", error);
            logout();
        } finally {
            setLoading(false);
        }
    };

    const loginWithGoogle = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                console.log("Sending login request to:", `${API_URL}/auth/google`);
                const res = await fetch(`${API_URL}/auth/google`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        access_token: tokenResponse.access_token,
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    console.log("Login successful, data:", data);

                    setToken(data.access_token);
                    localStorage.setItem('auth_token', data.access_token);
                    setLoginResponse(data); // Save response for UI to react (e.g. onboarding)

                    // Fetch profile immediately to update UI
                    await fetchUserProfile(data.access_token);
                } else {
                    console.error("Backend login failed", await res.text());
                }
            } catch (error) {
                console.error("Login Error", error);
            }
        },
        onError: error => console.error("Google Login Failed", error)
    });

    const updateProfile = async (updates) => {
        try {
            const res = await fetch(`${API_URL}/api/users/me/update`, { // Fixed endpoint: was /me/profile, confirmed /me/update in viewed files
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                const updatedProfile = await res.json();
                // Merge updates into local user state
                setUser(prev => ({
                    ...prev,
                    ...updatedProfile,
                    display_name: updatedProfile.display_name,
                    bio: updatedProfile.bio,
                    preferences: updatedProfile.preferences,
                    // username is top level in updatedProfile from backend
                    username: updatedProfile.username
                }));
                return updatedProfile;
            } else {
                const errorData = await res.json();
                throw new Error(errorData.detail || 'Update failed');
            }
        } catch (error) {
            console.error("Update profile error", error);
            throw error;
        }
    };

    const logout = () => {
        googleLogout();
        setToken(null);
        setUser(null);
        setLoginResponse(null);
        localStorage.removeItem('auth_token');
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            loginWithGoogle,
            logout,
            updateProfile,
            loginResponse // Expose this
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
