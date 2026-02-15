import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LogOut, User as UserIcon } from 'lucide-react';

function getDiceBearAvatar(seed) {
    return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed || 'default')}`;
}

export default function UserMenu({ onProfileClick }) {
    const { user, logout } = useAuth();
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    if (!user) return null;

    const getAvatar = () => {
        if (user.avatar_url) return user.avatar_url;

        // Fallback: Generate from preferences if available
        const style = user.preferences?.avatar_style || 'thumbs';
        const seed = user.preferences?.avatar_seed || user.display_name || user.email;
        return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
    };

    const avatarUrl = getAvatar();

    return (
        <div className="user-menu-container" style={{ position: 'relative' }}>
            <div
                className="user-avatar"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '20px',
                    background: 'rgba(255,255,255,0.4)',
                    border: '1px solid var(--border-color)',
                    transition: 'all 0.2s'
                }}
            >
                <img
                    src={avatarUrl}
                    alt={user.display_name}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'white', objectFit: 'cover' }}
                />
                <span className="user-name desktop-only" style={{ fontSize: '0.9rem', fontWeight: 500, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                    {user.display_name}
                </span>
            </div>

            {isOpen && (
                <>
                    <div className="menu-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsOpen(false)}></div>
                    <div className="user-dropdown" style={{
                        position: 'absolute',
                        top: '120%',
                        right: 0,
                        width: '220px',
                        background: 'white',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '8px',
                        zIndex: 100,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                    }}>
                        <div className="dropdown-header" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{t('nav.signed_in_as')}</div>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', color: 'var(--text-primary)' }}>{user.email}</div>
                        </div>

                        <button
                            onClick={() => { setIsOpen(false); if (onProfileClick) onProfileClick(); }}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                fontSize: '0.9rem',
                                transition: 'background 0.2s',
                                marginBottom: '4px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <UserIcon size={16} /> {t('nav.profile')}
                        </button>

                        <button
                            onClick={logout}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                fontSize: '0.9rem',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <LogOut size={16} /> {t('nav.sign_out')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
