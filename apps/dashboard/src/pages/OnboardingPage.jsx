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
        <div className="onboarding-container">
            <div className="onboarding-card">
                <h1 className="onboarding-title">
                    Welcome to Spotary!
                </h1>
                <p className="onboarding-subtitle">
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
                            className="onboarding-input"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="onboarding-btn"
                    >
                        {loading ? 'Setting up...' : 'Get Started'}
                    </button>
                </form>
            </div>
        </div>
    );
}
