import React from 'react';
import { X, Globe, MessageSquare, Coffee, Info, Menu } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { CONFIG } from '../../config';

// Reusing popup styling from index.css
const SettingsModal = ({ onClose }) => {
    const { language, setLanguage, t } = useLanguage();

    return (
        <div className="popup-overlay" onClick={onClose}>
            <div className="popup-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="popup-header">
                    <h2 className="popup-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Menu size={24} color="var(--accent-color)" />
                        {t('settings.title')}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="popup-body">
                    {/* Language Section */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {t('settings.language')}
                        </label>
                        <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <button
                                onClick={() => setLanguage('vi')}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: language === 'vi' ? 'white' : 'transparent',
                                    color: language === 'vi' ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    fontWeight: language === 'vi' ? '700' : '500',
                                    cursor: 'pointer',
                                    boxShadow: language === 'vi' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Tiếng Việt
                            </button>
                            <button
                                onClick={() => setLanguage('en')}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: language === 'en' ? 'white' : 'transparent',
                                    color: language === 'en' ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    fontWeight: language === 'en' ? '700' : '500',
                                    cursor: 'pointer',
                                    boxShadow: language === 'en' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                English
                            </button>
                        </div>
                    </div>

                    {/* Links Section */}
                    {CONFIG.LINKS.FEEDBACK && (
                        <a
                            href={CONFIG.LINKS.FEEDBACK}
                            target="_blank"
                            rel="noreferrer"
                            className="settings-link-item"
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', background: 'var(--bg-secondary)', marginBottom: '0.8rem', textDecoration: 'none', color: 'var(--text-primary)', transition: 'background 0.2s' }}
                        >
                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '8px', color: '#3b82f6' }}>
                                <MessageSquare size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{t('settings.feedback')}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{t('settings.feedback_desc')}</div>
                            </div>
                        </a>
                    )}

                    {CONFIG.FEATURES.ENABLE_BUY_ME_COFFEE && CONFIG.LINKS.BUY_ME_COFFEE && (
                        <a
                            href={CONFIG.LINKS.BUY_ME_COFFEE}
                            target="_blank"
                            rel="noreferrer"
                            className="settings-link-item"
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', background: 'var(--bg-secondary)', marginBottom: '0.8rem', textDecoration: 'none', color: 'var(--text-primary)', transition: 'background 0.2s' }}
                        >
                            <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '8px', borderRadius: '8px', color: '#f59e0b' }}>
                                <Coffee size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{t('settings.coffee')}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{t('settings.coffee_desc')}</div>
                            </div>
                        </a>
                    )}

                    <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                        <p>{t('settings.about')} • v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};



export default SettingsModal;
