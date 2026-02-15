import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Home, Map, Sparkles, User, List } from 'lucide-react';

const BottomNav = ({ currentView, onViewChange, onProfileClick }) => {
    const { user } = useAuth();
    const { t } = useLanguage();

    // Helper to get avatar URL (reused logic, ideally shared utils)
    const getAvatar = () => {
        if (!user) return null;
        if (user.avatar_url) return user.avatar_url;
        const style = user.preferences?.avatar_style || 'thumbs';
        const seed = user.preferences?.avatar_seed || user.display_name || user.email;
        return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
    };

    const avatarUrl = getAvatar();

    return (
        <div className="bottom-nav">
            <div className={`nav-item ${currentView === 'list' ? 'active' : ''}`} onClick={() => onViewChange('list')}>
                <Home size={24} />
                <span>{t('nav.home')}</span>
            </div>

            <div className={`nav-item ${currentView === 'map' ? 'active' : ''}`} onClick={() => onViewChange('map')}>
                <Map size={24} />
                <span>{t('nav.map')}</span>
            </div>

            <div className={`nav-item ${currentView === 'chat' ? 'active' : ''}`} onClick={() => onViewChange('chat')}>
                <div className="marin-fab">
                    <Sparkles size={24} color="white" fill="white" />
                </div>
                <span className="marin-label-nav">Marin</span>
            </div>

            <div className={`nav-item ${currentView === 'books' ? 'active' : ''}`} onClick={() => onViewChange('books')}>
                <List size={24} />
                <span>{t('nav.books')}</span>
            </div>

            <div className={`nav-item ${currentView === 'profile' ? 'active' : ''}`} onClick={onProfileClick}>
                {user && avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt="Profile"
                        style={{
                            width: '24px', height: '24px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: currentView === 'profile' ? '2px solid var(--accent-color)' : '1px solid transparent'
                        }}
                    />
                ) : (
                    <User size={24} />
                )}
                <span>{t('nav.profile')}</span>
            </div>
        </div>
    );
};

export default BottomNav;
