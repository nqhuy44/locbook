import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function LoginButton({ onLogin }) {
    // We access login function from AuthContext to keep state unified
    const { loginWithGoogle } = useAuth();

    const handleLogin = async () => {
        const result = await loginWithGoogle();
        if (onLogin) onLogin(result);
    };

    return (
        <button
            onClick={handleLogin}
            className="btn-primary"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem'
            }}
        >
            <LogIn size={16} />
            <span className="desktop-only">Sign In</span>
        </button>
    );
}
