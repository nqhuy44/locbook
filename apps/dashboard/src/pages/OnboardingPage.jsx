import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function OnboardingPage({ onComplete }) {
    const { user, updateProfile } = useAuth();
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!displayName.trim()) return;

        setLoading(true);
        try {
            await updateProfile({ display_name: displayName });
            onComplete(); // Navigate to home
        } catch (error) {
            console.error("Onboarding failed", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="onboarding-container" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#0f0518',
            color: 'white',
            padding: '2rem'
        }}>
            <div className="onboarding-card" style={{
                background: '#1e1b2e',
                padding: '3rem',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
                width: '100%',
                maxWidth: '480px',
                textAlign: 'center'
            }}>
                <h1 style={{ marginBottom: '1rem', background: 'linear-gradient(to right, #fff, #fbcfe8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Welcome to LocBook!
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2rem' }}>
                    Let's get you set up. What should we call you?
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'left' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                            Display Name
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. Marin Traveler"
                            style={{
                                width: '100%',
                                padding: '1rem',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                                fontSize: '1rem'
                            }}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '1rem',
                            borderRadius: '12px',
                            background: '#d946ef',
                            color: 'white',
                            border: 'none',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Setting up...' : 'Get Started'}
                    </button>
                </form>
            </div>
        </div>
    );
}
