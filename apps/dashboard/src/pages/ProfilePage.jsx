import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Save, Sparkles, Check, RefreshCw, Plus, LogIn } from 'lucide-react';
import LoginButton from '../components/auth/LoginButton';

const DICEBEAR_STYLES = ['thumbs', 'adventurer', 'avataaars', 'bottts', 'fun-emoji', 'lorelei', 'notionists', 'open-peeps', 'pixel-art', 'shapes'];

function getDiceBearUrl(style, seed) {
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed || 'default')}`;
}

const AVAILABLE_VIBES = [
    'Chill', 'Cozy', 'Quiet', 'Lively', 'Romantic', 'Creative',
    'Sophisticated', 'Friendly', 'Adventurous', 'Energetic',
    'Artsy', 'Vintage', 'Modern', 'Hipster', 'Luxurious',
    'Laid-back', 'Vibrant', 'Intimate', 'Trendy', 'Rustic'
].sort();

const PERSONALITY_TAGS = [
    'Introvert', 'Extrovert', 'Foodie', 'Night Owl',
    'Early Bird', 'Bookworm', 'Music Lover', 'Photo Addict',
    'Coffee Addict', 'Wine Enthusiast', 'Explorer', 'Homebody'
].sort();

export default function ProfilePage({ onBack }) {
    const { user, updateProfile, loginWithGoogle } = useAuth();

    // Hooks must be at top level
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        display_name: user?.display_name || '',
        username: user?.username || '',
        bio: user?.bio || ''
    });
    const [selectedVibes, setSelectedVibes] = useState(user?.preferences?.vibes || []);
    const [selectedPersonality, setSelectedPersonality] = useState(user?.preferences?.personality || []);
    const [avatarStyle, setAvatarStyle] = useState(user?.preferences?.avatar_style || 'thumbs');
    const [avatarSeed, setAvatarSeed] = useState(user?.preferences?.avatar_seed || user?.display_name || user?.email || 'default');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Custom Tag State
    const [customTag, setCustomTag] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);

    // Sync state when entering edit mode or user updates
    React.useEffect(() => {
        if (!isEditing && user) {
            setFormData({
                display_name: user.display_name || '',
                username: user.username || '',
                bio: user.bio || ''
            });
            setSelectedVibes(user.preferences?.vibes || []);
            setSelectedPersonality(user.preferences?.personality || []);
            setAvatarStyle(user.preferences?.avatar_style || 'thumbs');
            setAvatarSeed(user.preferences?.avatar_seed || user.display_name || user.email || 'default');
        }
    }, [isEditing, user]);


    const avatarUrl = useMemo(() => getDiceBearUrl(avatarStyle, avatarSeed), [avatarStyle, avatarSeed]);
    const userAvatarUrl = user?.avatar_url || getDiceBearUrl(user?.preferences?.avatar_style || 'thumbs', user?.preferences?.avatar_seed || user?.display_name || 'default');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const toggleVibe = (vibe) => {
        setSelectedVibes(prev =>
            prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]
        );
    };

    const addCustomTag = () => {
        const tag = customTag.trim();
        if (tag && !selectedVibes.includes(tag)) {
            setSelectedVibes(prev => [...prev, tag]);
            setCustomTag('');
            setIsAddingTag(false);
        }
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
            // Generate final avatar URL
            const finalAvatarUrl = getDiceBearUrl(avatarStyle, avatarSeed);
            console.log("Submitting Profile Update:", { finalAvatarUrl, avatarStyle, avatarSeed });

            await updateProfile({
                display_name: formData.display_name,
                username: formData.username,
                bio: formData.bio,
                avatar_url: finalAvatarUrl, // Send top-level avatar_url
                preferences: {
                    vibes: selectedVibes,
                    personality: selectedPersonality,
                    avatar_style: avatarStyle,
                    avatar_seed: avatarSeed
                }
            });
            setMessage({ text: 'Đã lưu thành công!', type: 'success' });
            setTimeout(() => {
                setMessage({ text: '', type: '' });
                setIsEditing(false); // Exit edit mode
            }, 1000);
        } catch (error) {
            console.error("Update profile failed:", error);
            const errorMsg = error.response?.data?.detail || 'Có lỗi xảy ra, vui lòng thử lại.';
            setMessage({ text: errorMsg, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const { logout } = useAuth(); // Destructure logout

    if (!user) {
        return (
            <div className="profile-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{
                        width: '80px', height: '80px', background: 'var(--accent-gradient)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1.5rem auto', color: 'white', boxShadow: '0 10px 25px rgba(217, 70, 239, 0.4)'
                    }}>
                        <LogIn size={40} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Đăng nhập vào LocBook</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                        Đăng nhập để lưu hồ sơ, tạo danh sách yêu thích và chat với Marin!
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <LoginButton />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-wrapper">


            <div className="profile-layout">
                {/* Header Section: Avatar + Name (Visible in both modes, but editable only in edit mode) */}
                <div className="profile-header">
                    <div className="avatar-section">
                        <div className="avatar-container">
                            <div className="avatar-main">
                                <img src={isEditing ? avatarUrl : (userAvatarUrl)} alt="Avatar" />
                            </div>
                        </div>
                        {isEditing && (
                            <button className="avatar-randomize" onClick={randomizeSeed} title="Randomize Avatar">
                                <RefreshCw size={18} />
                            </button>
                        )}
                    </div>

                    <div className="user-info-header">
                        <div className="display-name">
                            {isEditing ? (formData.display_name || 'Chưa đặt tên') : (user.display_name || 'Chưa đặt tên')}
                        </div>
                        <div className="username">
                            @{isEditing ? (formData.username || 'username') : (user.username || 'username')}
                        </div>

                        {isEditing && (
                            <div className="avatar-styles-section">
                                <div className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Chọn kiểu avatar</div>
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
                        )}
                    </div>
                </div>

                {!isEditing ? (
                    /* ================= READ ONLY MODE ================= */
                    <div className="content-area">
                        <div className="section-card">
                            <div className="section-title"><Sparkles size={18} /> Thông tin cá nhân</div>
                            {user.bio ? (
                                <p style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>{user.bio}</p>
                            ) : (
                                <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Chưa có mô tả.</p>
                            )}
                        </div>

                        <div className="section-card">
                            <div className="section-title">
                                <Sparkles size={18} color="#d946ef" /> Vibes yêu thích
                            </div>
                            <div className="chip-grid">
                                {user.preferences?.vibes?.length > 0 ? (
                                    user.preferences.vibes.map(vibe => (
                                        <div key={vibe} className="chip active" style={{ cursor: 'default' }}>
                                            {vibe}
                                        </div>
                                    ))
                                ) : (
                                    <span style={{ color: 'var(--text-tertiary)' }}>Chưa chọn vibe nào.</span>
                                )}
                            </div>
                        </div>

                        <div className="section-card">
                            <div className="section-title">🎭 Tính cách</div>
                            <div className="chip-grid">
                                {user.preferences?.personality?.length > 0 ? (
                                    user.preferences.personality.map(tag => (
                                        <div key={tag} className="chip active" style={{ cursor: 'default' }}>
                                            {tag}
                                        </div>
                                    ))
                                ) : (
                                    <span style={{ color: 'var(--text-tertiary)' }}>Chưa chọn tính cách.</span>
                                )}
                            </div>
                        </div>

                        <div className="action-btn-group">
                            <button className="edit-mode-btn" onClick={() => setIsEditing(true)}>
                                <Sparkles size={18} /> Chỉnh sửa hồ sơ
                            </button>

                            <button className="logout-btn" onClick={logout}>
                                <LogIn size={18} style={{ transform: 'rotate(180deg)' }} /> Đăng xuất
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ================= EDIT MODE ================= */
                    <div className="content-area">
                        <form onSubmit={handleSubmit}>
                            <div className="section-card">
                                <div className="section-title"><Sparkles size={18} /> Thông tin cá nhân</div>

                                <div className="form-group">
                                    <label className="form-label">Tên người dùng (Unique ID)</label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        placeholder="tên_duy_nhất"
                                        className="form-input"
                                        style={{ fontFamily: 'monospace' }}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Tên hiển thị</label>
                                    <input
                                        type="text"
                                        name="display_name"
                                        value={formData.display_name}
                                        onChange={handleChange}
                                        placeholder="VD: Marin Explorer"
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Mô tả về bạn</label>
                                    <textarea
                                        name="bio"
                                        value={formData.bio}
                                        onChange={handleChange}
                                        placeholder="Chia sẻ đôi điều về bản thân..."
                                        className="form-input form-textarea"
                                    />
                                </div>
                            </div>

                            {/* Vibes */}
                            <div className="section-card">
                                <div className="section-title">
                                    <Sparkles size={18} color="#d946ef" /> Vibes yêu thích
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
                                    Chọn những vibes phù hợp với bạn nhất
                                </p>
                                <div className="vibe-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {[...AVAILABLE_VIBES]
                                        .sort((a, b) => {
                                            const aSelected = selectedVibes.includes(a);
                                            const bSelected = selectedVibes.includes(b);
                                            if (aSelected === bSelected) return a.localeCompare(b);
                                            return aSelected ? -1 : 1;
                                        })
                                        .map(vibe => (
                                            <button
                                                key={vibe}
                                                type="button"
                                                onClick={() => toggleVibe(vibe)}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    borderRadius: '20px',
                                                    border: selectedVibes.includes(vibe) ? 'none' : '1px solid var(--border-color)',
                                                    background: selectedVibes.includes(vibe) ? 'var(--accent-gradient)' : 'var(--card-bg)',
                                                    color: selectedVibes.includes(vibe) ? 'white' : 'var(--text-secondary)',
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    boxShadow: selectedVibes.includes(vibe) ? '0 4px 12px rgba(217, 70, 239, 0.3)' : 'none'
                                                }}
                                            >
                                                {vibe}
                                            </button>
                                        ))}
                                </div>     {isAddingTag ? (
                                    <input
                                        autoFocus
                                        className="add-tag-input"
                                        value={customTag}
                                        onChange={e => setCustomTag(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                                        onBlur={() => { if (!customTag) setIsAddingTag(false); else addCustomTag(); }}
                                        placeholder="Tag..."
                                    />
                                ) : (
                                    <button type="button" className="add-tag-btn" onClick={() => setIsAddingTag(true)}>
                                        <Plus size={14} /> Thêm tag
                                    </button>
                                )}
                            </div>

                            {/* Personality */}
                            <div className="section-card">
                                <div className="section-title">
                                    🎭 Tính cách
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
                                    Bạn là kiểu người...?
                                </p>
                                <div className="chip-grid">
                                    {[...PERSONALITY_TAGS]
                                        .sort((a, b) => {
                                            const aSelected = selectedPersonality.includes(a);
                                            const bSelected = selectedPersonality.includes(b);
                                            if (aSelected === bSelected) return a.localeCompare(b);
                                            return aSelected ? -1 : 1;
                                        })
                                        .map(tag => (
                                            <button
                                                key={tag}
                                                type="button"
                                                className={`chip ${selectedPersonality.includes(tag) ? 'active' : ''}`}
                                                onClick={() => togglePersonality(tag)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    padding: '0.4rem 0.8rem',
                                                    borderRadius: '20px',
                                                    border: selectedPersonality.includes(tag) ? 'none' : '1px solid var(--border-color)',
                                                    background: selectedPersonality.includes(tag) ? 'var(--accent-gradient)' : 'var(--card-bg)',
                                                    color: selectedPersonality.includes(tag) ? 'white' : 'var(--text-secondary)',
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {selectedPersonality.includes(tag) && <Check size={12} />}
                                                {tag}
                                            </button>
                                        ))}
                                </div>
                            </div>

                            {/* Save/Cancel Bar */}
                            <div className="save-bar">
                                <div>
                                    {message.text && <div className={`msg ${message.type}`}>{message.text}</div>}
                                </div>

                                <button type="button" className="cancel-btn" onClick={() => setIsEditing(false)} disabled={loading}>
                                    Hủy
                                </button>

                                <button type="submit" className="save-btn" disabled={loading}>
                                    <Save size={18} />
                                    {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
