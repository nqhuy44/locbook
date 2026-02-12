import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Save, Sparkles, Check, RefreshCw } from 'lucide-react';

const DICEBEAR_STYLES = ['thumbs', 'adventurer', 'avataaars', 'bottts', 'fun-emoji', 'lorelei', 'notionists', 'open-peeps', 'pixel-art', 'shapes'];

function getDiceBearUrl(style, seed) {
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed || 'default')}`;
}

const AVAILABLE_VIBES = [
    'Chill', 'Cozy', 'Quiet', 'Lively', 'Romantic', 'Creative',
    'Sophisticated', 'Friendly', 'Adventurous', 'Energetic',
    'Artsy', 'Vintage', 'Modern', 'Hipster', 'Luxurious',
    'Laid-back', 'Vibrant', 'Intimate', 'Trendy', 'Rustic'
];

const PERSONALITY_TAGS = [
    'Introvert', 'Extrovert', 'Foodie', 'Night Owl',
    'Early Bird', 'Bookworm', 'Music Lover', 'Photo Addict',
    'Coffee Addict', 'Wine Enthusiast', 'Explorer', 'Homebody'
];

export default function ProfilePage({ onBack }) {
    const { user, updateProfile } = useAuth();
    const [formData, setFormData] = useState({
        display_name: user?.display_name || '',
        bio: user?.bio || ''
    });
    const [selectedVibes, setSelectedVibes] = useState(user?.preferences?.vibes || []);
    const [selectedPersonality, setSelectedPersonality] = useState(user?.preferences?.personality || []);
    const [avatarStyle, setAvatarStyle] = useState(user?.preferences?.avatar_style || 'thumbs');
    const [avatarSeed, setAvatarSeed] = useState(user?.display_name || user?.email || 'default');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const avatarUrl = useMemo(() => getDiceBearUrl(avatarStyle, avatarSeed), [avatarStyle, avatarSeed]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const toggleVibe = (vibe) => {
        setSelectedVibes(prev =>
            prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]
        );
    };

    const togglePersonality = (tag) => {
        setSelectedPersonality(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const randomizeSeed = () => {
        setAvatarSeed(Math.random().toString(36).substring(2, 10));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });
        try {
            await updateProfile({
                display_name: formData.display_name,
                bio: formData.bio,
                preferences: {
                    vibes: selectedVibes,
                    personality: selectedPersonality,
                    avatar_style: avatarStyle,
                    avatar_seed: avatarSeed
                }
            });
            setMessage({ text: 'Đã lưu thành công!', type: 'success' });
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        } catch (error) {
            setMessage({ text: 'Có lỗi xảy ra, vui lòng thử lại.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profile-standalone">
            <style>{`
                .profile-standalone {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #0f0518 0%, #1a0b2e 50%, #16082b 100%);
                    color: white;
                    font-family: 'Inter', sans-serif;
                }
                .profile-standalone .profile-nav {
                    padding: 1.5rem 2rem;
                    display: flex;
                    align-items: center;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .profile-standalone .back-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.6);
                    cursor: pointer;
                    font-size: 0.95rem;
                    transition: color 0.2s;
                }
                .profile-standalone .back-btn:hover { color: white; }
                .profile-standalone .profile-layout {
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 2.5rem 2rem;
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    gap: 3rem;
                }
                .profile-standalone .sidebar {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }
                .profile-standalone .avatar-section {
                    position: relative;
                    margin-bottom: 1.5rem;
                }
                .profile-standalone .avatar-main {
                    width: 140px;
                    height: 140px;
                    border-radius: 50%;
                    border: 3px solid rgba(217, 70, 239, 0.5);
                    background: #2d1b4e;
                    overflow: hidden;
                    box-shadow: 0 0 40px rgba(217, 70, 239, 0.2);
                }
                .profile-standalone .avatar-main img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .profile-standalone .avatar-randomize {
                    position: absolute;
                    bottom: 4px;
                    right: 4px;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: #d946ef;
                    border: 2px solid #0f0518;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.2s;
                }
                .profile-standalone .avatar-randomize:hover { transform: scale(1.1) rotate(45deg); }
                .profile-standalone .avatar-styles {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    justify-content: center;
                    margin-top: 0.5rem;
                }
                .profile-standalone .style-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    border: 2px solid transparent;
                    cursor: pointer;
                    overflow: hidden;
                    background: rgba(255,255,255,0.05);
                    transition: all 0.2s;
                    padding: 3px;
                }
                .profile-standalone .style-btn:hover { border-color: rgba(217,70,239,0.4); }
                .profile-standalone .style-btn.active { border-color: #d946ef; box-shadow: 0 0 12px rgba(217,70,239,0.3); }
                .profile-standalone .style-btn img { width: 100%; height: 100%; border-radius: 6px; }
                .profile-standalone .content-area { display: flex; flex-direction: column; gap: 2rem; }
                .profile-standalone .section-card {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 16px;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }
                .profile-standalone .section-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: rgba(255,255,255,0.9);
                }
                .profile-standalone .form-group { margin-bottom: 1.2rem; }
                .profile-standalone .form-label {
                    display: block;
                    margin-bottom: 0.4rem;
                    font-size: 0.85rem;
                    color: rgba(255,255,255,0.6);
                    font-weight: 500;
                }
                .profile-standalone .form-input {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: white;
                    font-size: 0.95rem;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                }
                .profile-standalone .form-input:focus {
                    outline: none;
                    border-color: rgba(217,70,239,0.5);
                }
                .profile-standalone .form-textarea {
                    resize: vertical;
                    min-height: 80px;
                    font-family: inherit;
                }
                .profile-standalone .chip-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .profile-standalone .chip {
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(255,255,255,0.04);
                    color: rgba(255,255,255,0.7);
                    user-select: none;
                }
                .profile-standalone .chip:hover {
                    border-color: rgba(217,70,239,0.3);
                    background: rgba(217,70,239,0.08);
                }
                .profile-standalone .chip.active {
                    background: rgba(217,70,239,0.2);
                    border-color: #d946ef;
                    color: #f0abfc;
                }
                .profile-standalone .save-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 1rem;
                }
                .profile-standalone .save-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 2rem;
                    background: linear-gradient(135deg, #d946ef, #a855f7);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 0.95rem;
                    cursor: pointer;
                    transition: opacity 0.2s, transform 0.1s;
                }
                .profile-standalone .save-btn:hover { opacity: 0.9; }
                .profile-standalone .save-btn:active { transform: scale(0.98); }
                .profile-standalone .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .profile-standalone .msg {
                    padding: 0.6rem 1rem;
                    border-radius: 8px;
                    font-size: 0.9rem;
                }
                .profile-standalone .msg.success {
                    background: rgba(34, 197, 94, 0.1);
                    color: #4ade80;
                    border: 1px solid rgba(34, 197, 94, 0.2);
                }
                .profile-standalone .msg.error {
                    background: rgba(239, 68, 68, 0.1);
                    color: #f87171;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                }
                .profile-standalone .email-badge {
                    margin-top: 0.5rem;
                    font-size: 0.85rem;
                    color: rgba(255,255,255,0.4);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    max-width: 240px;
                }
                @media (max-width: 768px) {
                    .profile-standalone .profile-layout {
                        grid-template-columns: 1fr;
                        padding: 1.5rem 1rem;
                        gap: 2rem;
                    }
                    .profile-standalone .sidebar { flex-direction: row; gap: 1.5rem; text-align: left; }
                    .profile-standalone .avatar-main { width: 100px; height: 100px; }
                }
            `}</style>

            <nav className="profile-nav">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={20} /> Quay lại Dashboard
                </button>
            </nav>

            <div className="profile-layout">
                {/* Sidebar – Avatar */}
                <div className="sidebar">
                    <div className="avatar-section">
                        <div className="avatar-main">
                            <img src={avatarUrl} alt="Avatar" />
                        </div>
                        <button className="avatar-randomize" onClick={randomizeSeed} title="Random avatar">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: '0.25rem' }}>
                        {formData.display_name || 'Chưa đặt tên'}
                    </div>
                    <div className="email-badge">{user?.email}</div>

                    {/* Avatar Style Picker */}
                    <div style={{ marginTop: '1.5rem', width: '100%' }}>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem', textAlign: 'center' }}>
                            Chọn kiểu avatar
                        </div>
                        <div className="avatar-styles">
                            {DICEBEAR_STYLES.map(style => (
                                <button
                                    key={style}
                                    className={`style-btn ${avatarStyle === style ? 'active' : ''}`}
                                    onClick={() => setAvatarStyle(style)}
                                    title={style}
                                >
                                    <img src={getDiceBearUrl(style, avatarSeed)} alt={style} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="content-area">
                    <form onSubmit={handleSubmit}>
                        {/* Basic Info */}
                        <div className="section-card">
                            <div className="section-title">Thông tin cá nhân</div>
                            <div className="form-group">
                                <label className="form-label">Tên hiển thị</label>
                                <input
                                    type="text"
                                    name="display_name"
                                    className="form-input"
                                    value={formData.display_name}
                                    onChange={handleChange}
                                    placeholder="VD: Marin Explorer"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mô tả về bạn</label>
                                <textarea
                                    name="bio"
                                    className="form-input form-textarea"
                                    value={formData.bio}
                                    onChange={handleChange}
                                    placeholder="Chia sẻ đôi điều về bản thân..."
                                />
                            </div>
                        </div>

                        {/* Vibes */}
                        <div className="section-card">
                            <div className="section-title">
                                <Sparkles size={18} color="#d946ef" /> Vibes yêu thích
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>
                                Chọn những vibes phù hợp với bạn nhất
                            </p>
                            <div className="chip-grid">
                                {AVAILABLE_VIBES.map(vibe => (
                                    <div
                                        key={vibe}
                                        className={`chip ${selectedVibes.includes(vibe) ? 'active' : ''}`}
                                        onClick={() => toggleVibe(vibe)}
                                    >
                                        {selectedVibes.includes(vibe) && <Check size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                                        {vibe}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Personality */}
                        <div className="section-card">
                            <div className="section-title">
                                🎭 Tính cách
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>
                                Bạn là kiểu người...?
                            </p>
                            <div className="chip-grid">
                                {PERSONALITY_TAGS.map(tag => (
                                    <div
                                        key={tag}
                                        className={`chip ${selectedPersonality.includes(tag) ? 'active' : ''}`}
                                        onClick={() => togglePersonality(tag)}
                                    >
                                        {selectedPersonality.includes(tag) && <Check size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                                        {tag}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Save */}
                        <div className="save-bar">
                            <div>
                                {message.text && <div className={`msg ${message.type}`}>{message.text}</div>}
                            </div>
                            <button type="submit" className="save-btn" disabled={loading}>
                                <Save size={18} />
                                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
