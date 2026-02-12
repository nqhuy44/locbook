import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    X,
    MapPin,
    Navigation,
    Sparkles,
    Star,
    Coffee,
    Wine,
    UtensilsCrossed,
    Beer,
    PartyPopper,
    Heart,
    ThumbsUp,
    BookOpen,
    Palette,
    TrendingUp,
    Clock,
    Lock,
    LogIn,
    Github,
    Globe,
    PlusCircle,
    MessageSquare,
    Settings,
    Share2,
    Check
} from 'lucide-react';
import { CONFIG as DEFAULT_CONFIG } from './config';
import MapView from './components/MapView';
import CategoryRow from './components/CategoryRow';
import ChatView from './components/ChatView';
import { useAuth } from './context/AuthContext';
import LoginButton from './components/auth/LoginButton';
import UserMenu from './components/auth/UserMenu';
import OnboardingPage from './pages/OnboardingPage';
import ProfilePage from './pages/ProfilePage';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: 'white', background: 'rgba(255,0,0,0.1)', borderRadius: '8px' }}>
                    <h2>Something went wrong.</h2>
                    <details style={{ whiteSpace: 'pre-wrap' }}>
                        {this.state.error && this.state.error.toString()}
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
    const { user, loading: authLoading } = useAuth();
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [currentView, setCurrentView] = useState('list');
    const [sortMode, setSortMode] = useState('popular');
    const [activeTab, setActiveTab] = useState('info');
    const [menuItems, setMenuItems] = useState([]);

    // Auth State - controlled by AuthContext now, but we might show prompts
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [activeVibes, setActiveVibes] = useState([]);
    const [activeCats, setActiveCats] = useState([]);

    useEffect(() => {
        fetchData();

        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const placeId = params.get("place");
            if (!placeId) setSelectedPlace(null);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        if (places.length > 0 && !selectedPlace) {
            const params = new URLSearchParams(window.location.search);
            const placeId = params.get("place");
            if (placeId) {
                const found = places.find(p => p._id === placeId);
                if (found) openModal(found);
            }
        }
    }, [places]);

    const fetchData = async () => {
        try {
            setLoading(true);

            const [placesRes, configRes] = await Promise.all([
                fetch(`${API_URL}/api/places?limit=150`),
                fetch(`${API_URL}/api/config`)
            ]);

            const placesData = await placesRes.json();
            setPlaces(placesData.data);

            if (configRes.ok) {
                const contentType = configRes.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const configData = await configRes.json();
                    if (configData && configData.HOME_CATEGORIES) {
                        setConfig(prev => ({ ...prev, ...configData }));
                    }
                }
            }
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    const categorizedPlaces = useMemo(() => {
        const groups = {};
        config.HOME_CATEGORIES.forEach(cat => groups[cat] = []);
        if (!groups["Casual"]) groups["Casual"] = [];

        places.forEach(place => {
            const cats = place.categories?.join(" ").toLowerCase() || "";
            const vibes = place.vibes?.join(" ").toLowerCase() || "";
            const combined = cats + " " + vibes;
            for (const [category, keywords] of Object.entries(config.CATEGORY_KEYWORDS)) {
                if (groups[category] && keywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(combined))) {
                    groups[category].push(place);
                }
            }
        });

        for (const key in groups) {
            groups[key] = [...new Set(groups[key])];
        }

        return groups;
    }, [places, config]);

    const { displayedVibes, displayedCategories } = useMemo(() => {
        const matchesSearch = (p) =>
            searchTerm === "" ||
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.vibes?.some(v => v.toLowerCase().includes(searchTerm.toLowerCase())) ||
            p.categories?.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()));

        const placesForVibes = places.filter(p => {
            const mSearch = matchesSearch(p);
            const mCat = activeCats.length === 0 || p.categories?.some(c => activeCats.includes(c));
            return mSearch && mCat;
        });

        const placesForCats = places.filter(p => {
            const mSearch = matchesSearch(p);
            const mVibe = activeVibes.length === 0 || p.vibes?.some(v => activeVibes.includes(v));
            return mSearch && mVibe;
        });

        const getUnique = (list, key) => {
            const s = new Set();
            list.forEach(p => p[key]?.forEach(x => s.add(x)));
            return Array.from(s);
        }

        const availVibes = getUnique(placesForVibes, 'vibes');
        const availCats = getUnique(placesForCats, 'categories');

        const buildList = (available, active) => {
            const activeSorted = [...active].sort();
            const remaining = available.filter(x => !active.includes(x)).sort();
            return [...activeSorted, ...remaining];
        };

        return {
            displayedVibes: buildList(availVibes, activeVibes),
            displayedCategories: buildList(availCats, activeCats)
        };
    }, [places, searchTerm, activeVibes, activeCats, config]);

    const isFiltering = searchTerm !== "" || activeVibes.length > 0 || activeCats.length > 0;

    const filteredPlaces = useMemo(() => {
        if (!isFiltering) return [];
        return places.filter(place => {
            const matchesSearch = searchTerm === "" ||
                place.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                place.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                place.vibes?.some(v => v.toLowerCase().includes(searchTerm.toLowerCase())) ||
                place.categories?.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesVibe = activeVibes.length === 0 ||
                place.vibes?.some(v => activeVibes.includes(v));

            const matchesCat = activeCats.length === 0 ||
                place.categories?.some(c => activeCats.includes(c));

            return matchesSearch && matchesVibe && matchesCat;
        });
    }, [places, searchTerm, activeVibes, activeCats, isFiltering]);


    const toggleVibe = (vibe) => {
        if (activeVibes.includes(vibe)) setActiveVibes(activeVibes.filter(v => v !== vibe));
        else setActiveVibes([...activeVibes, vibe]);
    };

    const toggleCat = (cat) => {
        if (activeCats.includes(cat)) setActiveCats(activeCats.filter(c => c !== cat));
        else setActiveCats([...activeCats, cat]);
    };

    const openModal = async (place) => {
        setSelectedPlace(place);
        setActiveTab('info');
        setMenuItems([]);
        document.body.style.overflow = 'hidden';

        const placeId = place._id || place.id;
        const newUrl = `${window.location.pathname}?place=${placeId}`;
        window.history.pushState({ path: newUrl }, '', newUrl);

        if (!place.raw_ai_response) {
            try {
                const res = await fetch(`${API_URL}/api/places/${placeId}`);
                const fullPlace = await res.json();
                setSelectedPlace(fullPlace);
            } catch (e) {
                console.error("Failed to fetch details", e);
            }
        }

        try {
            const menuRes = await fetch(`${API_URL}/api/places/${placeId}/menu`);
            if (menuRes.ok) {
                const menuData = await menuRes.json();
                setMenuItems(menuData.menu || []);
            }
        } catch (e) {
            console.error("Failed to fetch menu", e);
        }
    };
    const closeModal = () => {
        setSelectedPlace(null);
        document.body.style.overflow = 'auto';
        const baseUrl = window.location.pathname;
        window.history.pushState({ path: baseUrl }, '', baseUrl);
    };

    const getSectionIcon = (name) => {
        const lower = name.toLowerCase();
        if (lower.includes("bar")) return <Wine size={20} color="#a855f7" />;
        if (lower.includes("nhậu")) return <Beer size={20} color="#f59e0b" />;
        if (lower.includes("coffee") || lower.includes("cafe")) return <Coffee size={20} color="#f472b6" />;
        if (lower.includes("special") || lower.includes("date")) return <Sparkles size={20} color="#d946ef" />;
        return <UtensilsCrossed size={20} color="#fbbf24" />;
    };

    if (loading || authLoading) return <div className="loading-screen" style={{ color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sparkles className="loader-icon" /> Loading Marin's Picks...
    </div>;

    // Standalone pages – rendered without the main navbar/filter chrome
    if (currentView === 'onboarding') {
        return <OnboardingPage onComplete={() => setCurrentView('list')} />;
    }
    if (currentView === 'profile') {
        return <ProfilePage onBack={() => setCurrentView('list')} />;
    }

    return (
        <div className="app-container">
            {/* Navbar */}
            <nav className="navbar">
                <div className="nav-left">
                    <div className="brand" onClick={() => { setSearchTerm(''); setActiveVibes([]); setActiveCats([]); setCurrentView('list') }}>
                        LocBook <span className="brand-subtitle">by Marin</span>
                    </div>
                    <div className="nav-links">
                        {config.FEATURES.ENABLE_DISCOVER && (
                            <span
                                className={`nav-link ${currentView === 'list' && !isFiltering ? 'active' : ''}`}
                                onClick={() => { setSearchTerm(''); setActiveVibes([]); setActiveCats([]); setCurrentView('list') }}
                            >
                                Discover
                            </span>
                        )}

                        {config.FEATURES.ENABLE_MAP && (
                            <span
                                className={`nav-link ${currentView === 'map' ? 'active' : ''}`}
                                onClick={() => setCurrentView('map')}
                            >
                                Map
                            </span>
                        )}

                        {config.FEATURES.FEAT_AI_MATCHMAKE && (
                            <span
                                className={`nav-link ${currentView === 'chat' ? 'active' : ''}`}
                                onClick={() => { setSearchTerm(''); setActiveVibes([]); setActiveCats([]); setCurrentView('chat') }}
                                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                                <Sparkles size={16} /> Ask Marin
                            </span>
                        )}
                    </div>
                </div>

                <div className="nav-right">
                    <a href={config.LINKS.LOC_REQUEST || "#"} target="_blank" rel="noreferrer" className="nav-link desktop-only" style={{ marginRight: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <PlusCircle size={18} /> Request Place
                    </a>

                    {/* Auth UI */}
                    {user ? (
                        <UserMenu onProfileClick={() => setCurrentView('profile')} />
                    ) : (
                        <LoginButton onLogin={(res) => {
                            if (res?.isNew) setCurrentView('onboarding');
                        }} />
                    )}
                </div>
            </nav>

            {/* Filter Bar */}
            {currentView !== 'chat' && (
                <div className="filter-bar">
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="search-wrapper">
                            <Search size={18} color="#d8b4fe" />
                            <input
                                className="search-input"
                                type="text"
                                placeholder="Find places, vibes..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Sort Mode Selector */}
                        <div className="sort-selector">
                            {[
                                { key: 'popular', icon: <ThumbsUp size={14} />, label: 'Popular' },
                                { key: 'trending', icon: <TrendingUp size={14} />, label: 'Trending' },
                                { key: 'newest', icon: <Clock size={14} />, label: 'Newest' },
                            ].map(mode => (
                                <button
                                    key={mode.key}
                                    className={`sort-btn ${sortMode === mode.key ? 'active' : ''}`}
                                    onClick={() => setSortMode(mode.key)}
                                >
                                    {mode.icon} {mode.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="filter-group">
                        <span className="filter-label">Vibes:</span>
                        <div className="filter-scroll">
                            {displayedVibes.map(vibe => (
                                <button
                                    key={vibe}
                                    className={`filter-btn ${activeVibes.includes(vibe) ? 'active' : ''}`}
                                    onClick={() => toggleVibe(vibe)}
                                >
                                    {vibe}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="filter-group">
                        <span className="filter-label">Categories:</span>
                        <div className="filter-scroll">
                            {displayedCategories.map(cat => (
                                <button
                                    key={cat}
                                    className={`filter-btn ${activeCats.includes(cat) ? 'active' : ''}`}
                                    onClick={() => toggleCat(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}


            {/* Main Content */}
            <main className="main-content" style={
                currentView === 'map' ? { padding: '0 2rem 2rem 2rem', overflow: 'hidden' } :
                    currentView === 'chat' ? { padding: 0, overflow: 'hidden', height: 'calc(100vh - 74px)' } :
                        {}
            }>
                {currentView === 'chat' ? (
                    <div style={{ height: '100%', width: '100%' }}>
                        <ChatView onPlaceClick={openModal} config={config} />
                    </div>
                ) : currentView === 'map' ? (
                    <MapView places={isFiltering ? filteredPlaces : places} onPlaceClick={openModal} />
                ) : (
                    isFiltering ? (
                        <div className="section-wrapper">
                            <h2 className="section-title">
                                Search Results ({filteredPlaces.length})
                            </h2>
                            <div className="places-grid" style={{ marginTop: '1.5rem' }}>
                                {filteredPlaces.map(place => (
                                    <PlaceCard key={place._id} place={place} onClick={() => openModal(place)} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        config.HOME_CATEGORIES.map(category => {
                            if (!categorizedPlaces[category] || categorizedPlaces[category].length === 0) return null;
                            return (
                                <CategoryRow
                                    key={category}
                                    title={category}
                                    icon={getSectionIcon(category)}
                                    places={categorizedPlaces[category]}
                                    onPlaceClick={openModal}
                                    PlaceCardComponent={PlaceCard}
                                />
                            );
                        })
                    )
                )}

                {/* Footer */}
                {config.FEATURES.ENABLE_FOOTER && currentView !== 'map' && currentView !== 'chat' && (
                    <footer className="footer">
                        <div className="footer-content">
                            <div className="footer-brand">LocBook</div>
                            <div className="footer-links">
                                {config.FEATURES.ENABLE_BUY_ME_COFFEE && (
                                    <a href={config.LINKS.BUY_ME_COFFEE} target="_blank" rel="noreferrer" className="bmc-button-footer">
                                        <Coffee size={18} /> Buy me a coffee
                                    </a>
                                )}
                                {config.LINKS.LOC_REQUEST && (
                                    <a href={config.LINKS.LOC_REQUEST} target="_blank" rel="noreferrer"><MapPin size={18} /> Request Place</a>
                                )}
                                {config.LINKS.GITHUB && (
                                    <a href={config.LINKS.GITHUB} target="_blank" rel="noreferrer"><Github size={18} /> GitHub</a>
                                )}
                                {config.LINKS.AUTHOR_WEBSITE && (
                                    <a href={config.LINKS.AUTHOR_WEBSITE} target="_blank" rel="noreferrer"><Globe size={18} /> Website</a>
                                )}
                                {config.LINKS.FEEDBACK && (
                                    <a href={config.LINKS.FEEDBACK} target="_blank" rel="noreferrer"><MessageSquare size={18} /> Feedback</a>
                                )}
                            </div>
                            <div className="footer-text">
                                Made by nqhuy
                            </div>
                            <div className="footer-copyright">
                                © {new Date().getFullYear()} LocBook. All rights reserved. v{__APP_VERSION__}
                            </div>
                        </div>
                    </footer>
                )}
            </main>

            {/* Modal */}
            {
                selectedPlace && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-overlay" onClick={closeModal}>
                            <div className="modal-content" onClick={e => e.stopPropagation()}>
                                <ErrorBoundary>
                                    <div className="modal-close" onClick={closeModal}>
                                        <X size={24} />
                                    </div>

                                    <div className="modal-hero">
                                        <PlaceHeroImage place={selectedPlace} />
                                        <div className="hero-overlay"></div>
                                        <div className="hero-info">
                                            <h1 className="hero-title">{selectedPlace.name}</h1>
                                            <div className="card-tags" style={{ fontSize: '1rem' }}>
                                                {selectedPlace.price_level && <span className="tag-soft">{selectedPlace.price_level}</span>}
                                                {selectedPlace.rating && (
                                                    <span className="tag-soft" style={{ background: 'rgba(255,215,0,0.2)', color: '#ffd700' }}>
                                                        ⭐ {selectedPlace.rating}
                                                    </span>
                                                )}
                                                {selectedPlace.aesthetic_score && (
                                                    <span className="tag-soft" style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc' }}>
                                                        <Palette size={12} style={{ marginRight: 4 }} /> {selectedPlace.aesthetic_score}/10
                                                    </span>
                                                )}
                                            </div>

                                            {/* Stats Row */}
                                            <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.8rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <ThumbsUp size={14} /> {selectedPlace.upvote_count || 0} upvotes
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <BookOpen size={14} /> {selectedPlace.memo_count || 0} memos
                                                </span>
                                            </div>

                                            <div className="hero-actions">
                                                <ShareButton />
                                                {selectedPlace.google_maps_url ? (
                                                    <a href={selectedPlace.google_maps_url} target="_blank" rel="noreferrer" className="btn-primary">
                                                        <Navigation size={20} /> Get Directions
                                                    </a>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tab Bar: Info | Menu */}
                                    <div className="modal-tabs">
                                        <button className={`modal-tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
                                            Info
                                        </button>
                                        <button className={`modal-tab ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')}>
                                            Menu {menuItems.length > 0 && <span className="tab-badge">{menuItems.length}</span>}
                                        </button>
                                    </div>

                                    <div className="modal-body">
                                        {activeTab === 'info' ? (
                                            <>
                                                <div className="col-main" style={{ flex: 2 }}>
                                                    {selectedPlace.raw_ai_response?.marin_comment && (
                                                        <div className="marin-box">
                                                            <div className="marin-label">Marin's Take</div>
                                                            <div className="marin-text">"{selectedPlace.raw_ai_response.marin_comment}"</div>
                                                        </div>
                                                    )}

                                                    <div className="detail-row">
                                                        <div className="detail-label">Address</div>
                                                        <div className="detail-value">{selectedPlace.address}</div>
                                                    </div>

                                                    {selectedPlace.opening_hours && (
                                                        <div className="detail-row">
                                                            <div className="detail-label">Hours</div>
                                                            <div className="detail-value">{selectedPlace.opening_hours}</div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="col-side" style={{ flex: 1 }}>
                                                    <div className="detail-row">
                                                        <div className="detail-label">Vibes</div>
                                                        <div className="pill-list">
                                                            {selectedPlace.vibes?.map(v => (
                                                                <span key={v} className="pill">{v}</span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="detail-row">
                                                        <div className="detail-label">Categories</div>
                                                        <div className="pill-list">
                                                            {selectedPlace.categories?.map(c => (
                                                                <span key={c} className="pill">{c}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            /* Menu Tab */
                                            <div style={{ flex: 1 }}>
                                                {menuItems.length === 0 ? (
                                                    <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.4)' }}>
                                                        <UtensilsCrossed size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                                                        <p>No menu available yet</p>
                                                    </div>
                                                ) : (
                                                    <div className="menu-list">
                                                        {menuItems.map((item, idx) => (
                                                            <div key={idx} className="menu-item">
                                                                <div className="menu-item-info">
                                                                    <span className="menu-item-name">
                                                                        {item.is_signature && <Star size={12} fill="#ffd700" color="#ffd700" style={{ marginRight: 4 }} />}
                                                                        {item.name}
                                                                    </span>
                                                                    {item.description && <span className="menu-item-desc">{item.description}</span>}
                                                                    {item.category && <span className="menu-item-cat">{item.category}</span>}
                                                                </div>
                                                                <span className="menu-item-price">
                                                                    {item.display_price || (item.price ? `${(item.price / 1000).toFixed(0)}k` : '')}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </ErrorBoundary>
                            </div>
                        </div>
                    </div>
                )
            }


        </div >
    )
}

function PlaceCard({ place, onClick }) {
    let imageUrl = place.images?.length > 0 ? place.images[0] : place.local_image_path;

    if (imageUrl) {
        if (imageUrl.startsWith("http")) {
        } else if (imageUrl.startsWith("/images/")) {
            imageUrl = `${API_URL}${imageUrl}`;
        } else if (imageUrl.startsWith("data/images/")) {
            imageUrl = `${API_URL}/images/${imageUrl.replace("data/images/", "")}`;
        } else {
            imageUrl = `${API_URL}/images/${imageUrl}`;
        }
    }

    return (
        <div className="place-card" onClick={onClick}>
            <div className="card-media">
                {imageUrl ? (
                    <img src={imageUrl} alt={place.name} className="card-img" loading="lazy" />
                ) : (
                    <div className="card-placeholder">
                        {place.name.charAt(0)}
                    </div>
                )}
                {place.rating && (
                    <div className="card-rating-badge">
                        <Star size={10} fill="currentColor" /> {place.rating}
                    </div>
                )}
                {place.aesthetic_score && (
                    <div className="card-aesthetic-badge">
                        <Palette size={10} /> {place.aesthetic_score}
                    </div>
                )}
            </div>
            <div className="card-content">
                <h3 className="card-title" title={place.name}>{place.name}</h3>
                <div className="card-subtitle">{place.address}</div>
                <div className="card-tags">
                    {place.vibes?.slice(0, 2).map(v => (
                        <span key={v} className="tag-soft match">{v}</span>
                    ))}
                </div>
                {(place.upvote_count > 0) && (
                    <div className="card-stats">
                        <span><ThumbsUp size={11} /> {place.upvote_count}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

function PlaceHeroImage({ place }) {
    let imageUrl = place.images?.length > 0 ? place.images[0] : place.local_image_path;

    if (imageUrl) {
        if (imageUrl.startsWith("http")) {
        } else if (imageUrl.startsWith("/images/")) {
            imageUrl = `${API_URL}${imageUrl}`;
        } else if (imageUrl.startsWith("data/images/")) {
            imageUrl = `${API_URL}/images/${imageUrl.replace("data/images/", "")}`;
        } else {
            imageUrl = `${API_URL}/images/${imageUrl}`;
        }
    }

    if (imageUrl) {
        return <img src={imageUrl} alt={place.name} />
    }
    return <div style={{ width: '100%', height: '100%', background: '#2d1b4e' }}></div>
}


function ShareButton() {
    const [copied, setCopied] = useState(false);

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button className="btn-secondary" onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', transition: 'all 0.2s' }}>
            {copied ? <Check size={20} color="#4ade80" /> : <Share2 size={20} />}
            {copied ? "Copied Link!" : "Share"}
        </button>
    );
}

export default App
