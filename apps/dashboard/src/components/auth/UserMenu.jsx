import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';

function getDiceBearAvatar(seed) {
    return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed || 'default')}`;
}

export default function UserMenu({ onProfileClick }) {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    if (!user) return null;

    const avatarUrl = user.avatar_url || getDiceBearAvatar(user.display_name || user.email);

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
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}
            >
                <img
                    src={avatarUrl}
                    alt={user.display_name}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2d1b4e' }}
                />
                <span className="user-name desktop-only" style={{ fontSize: '0.9rem', fontWeight: 500, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                        background: '#1e1b4b',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '8px',
                        zIndex: 100,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }}>
                        <div className="dropdown-header" style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Signed in as</div>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{user.email}</div>
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
                                color: 'white',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                fontSize: '0.9rem',
                                transition: 'background 0.2s',
                                marginBottom: '4px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <UserIcon size={16} /> Profile
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
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
