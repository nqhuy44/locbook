import React, { createContext, useContext, useState, useEffect } from 'react';
import { googleLogout, useGoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('auth_token'));
    const [loading, setLoading] = useState(true);

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
                    setToken(data.access_token);
                    // data.is_new is now available from backend
                    if (data.is_new) {
                        return { isNew: true };
                    }
                } else {
                    console.error("Backend login failed");
                }
            } catch (error) {
                console.error("Login Error", error);
            }
        },
        onError: error => console.error("Google Login Failed", error)
    });

    const updateProfile = async (updates) => {
        try {
            const res = await fetch(`${API_URL}/api/users/me/profile`, {
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
                    ...updatedProfile, // Flattened profile fields from backend
                    // If backend returns only profile object, we might need to be careful. 
                    // But users_router.py update_my_profile returns the profile object.
                    // And our local user object is flattened. 
                    // Let's ensure consistency.
                    display_name: updatedProfile.display_name,
                    bio: updatedProfile.bio,
                    preferences: updatedProfile.preferences,
                    avatar_url: updatedProfile.avatar_url
                }));
                return updatedProfile;
            } else {
                throw new Error("Failed to update profile");
            }
        } catch (error) {
            console.error("Update Profile Error", error);
            throw error;
        }
    };

    const logout = () => {
        googleLogout();
        setToken(null);
        setUser(null);
        localStorage.removeItem('auth_token');
        setLoading(false);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, loginWithGoogle, logout, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
