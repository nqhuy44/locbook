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
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [currentView, setCurrentView] = useState('list'); // 'list' | 'map'

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [activeVibes, setActiveVibes] = useState([]);
    const [activeCats, setActiveCats] = useState([]);

    useEffect(() => {
        fetchData();

        // Handle browser back checks if needed, or stick to simple pushState
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const placeId = params.get("place");
            if (!placeId) setSelectedPlace(null);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Deep Linking: Check URL when places load
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

            // Parallel fetch
            const [placesRes, configRes] = await Promise.all([
                fetch(`${API_URL}/api/places?limit=150`),
                fetch(`${API_URL}/api/config`)
            ]);

            const placesData = await placesRes.json();
            setPlaces(placesData.data);

            // Safely handle config fetch
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

    // 1. Precise Categorization Logic using CONFIG
    const categorizedPlaces = useMemo(() => {
        const groups = {};
        config.HOME_CATEGORIES.forEach(cat => groups[cat] = []);

        // Add a default fallback if not in list
        if (!groups["Casual"]) groups["Casual"] = [];

        places.forEach(place => {
            const cats = place.categories?.join(" ").toLowerCase() || "";
            const vibes = place.vibes?.join(" ").toLowerCase() || "";
            const combined = cats + " " + vibes;
            // Dynamic checking based on CONFIG
            for (const [category, keywords] of Object.entries(config.CATEGORY_KEYWORDS)) {
                // Use regex with word boundaries to avoid partial matches (e.g., "barbecue" matching "bar")
                if (groups[category] && keywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(combined))) {
                    groups[category].push(place);
                }
            }

            // Fallback removed: Places that don't match any keywords will not be shown in homepage categories.

        });

        // Deduplicate within groups
        for (const key in groups) {
            groups[key] = [...new Set(groups[key])];
        }

        return groups;
    }, [places]);

    // 2. Filter Lists & Smart Facets
    // We want to show options that are relevant to the *other* active filters.
    // e.g. If I search "Pizza", I only want to see Vibes/Cats relevant to Pizza.
    // However, within the same group (e.g. Vibes), we shouldn't filter out options just because
    // one vibe is selected (since it's an OR filter).

    const { displayedVibes, displayedCategories } = useMemo(() => {
        // Helper to check match against Search
        const matchesSearch = (p) =>
            searchTerm === "" ||
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.vibes?.some(v => v.toLowerCase().includes(searchTerm.toLowerCase())) ||
            p.categories?.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()));

        // Helper: Available Vibes (Filter by Search + Categories, Ignore Vibes)
        const placesForVibes = places.filter(p => {
            const mSearch = matchesSearch(p);
            const mCat = activeCats.length === 0 || p.categories?.some(c => activeCats.includes(c));
            return mSearch && mCat;
        });

        // Helper: Available Cats (Filter by Search + Vibes, Ignore Categories)
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

        // Construct Final Lists: Active (sorted) + AvailableUnselected (sorted)
        const buildList = (available, active) => {
            const availableSet = new Set(available);
            // We keep ALL active items, even if they wouldn't match the current search
            // (User requirement: "won't disappear... unless I unselect")
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
        document.body.style.overflow = 'hidden';

        // Update URL
        const newUrl = `${window.location.pathname}?place=${place._id}`;
        window.history.pushState({ path: newUrl }, '', newUrl);

        if (!place.raw_ai_response) {
            try {
                const res = await fetch(`${API_URL}/api/places/${place._id}`);
                const fullPlace = await res.json();
                setSelectedPlace(fullPlace);
            } catch (e) {
                console.error("Failed to fetch details", e);
            }
        }
    };
    const closeModal = () => {
        setSelectedPlace(null);
        document.body.style.overflow = 'auto';
        // Revert URL
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

    if (loading) return <div className="loading-screen" style={{ color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sparkles className="loader-icon" /> Loading Marin's Picks...
    </div>;

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


                    </div>
                </div>

                <div className="nav-right">
                    <a href={config.LINKS.LOC_REQUEST || "#"} target="_blank" rel="noreferrer" className="nav-link desktop-only" style={{ marginRight: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <PlusCircle size={18} /> Request Place
                    </a>
                    {config.FEATURES.ENABLE_BUY_ME_COFFEE && (
                        <a href={config.LINKS.BUY_ME_COFFEE} target="_blank" rel="noreferrer" className="bmc-button">
                            <Coffee size={16} /> <span className="bmc-text desktop-only">Buy me a coffee</span>
                        </a>
                    )}
                </div>
            </nav>

            {/* Filter Bar */}
            <div className="filter-bar">
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


            {/* Main Content */}
            <main className="main-content" style={currentView === 'map' ? { padding: '0 2rem 2rem 2rem', overflow: 'hidden' } : {}}>
                {currentView === 'map' ? (
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
                        // Use config for Home Categories Order
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
            </main>

            {/* Footer */}
            {config.FEATURES.ENABLE_FOOTER && currentView !== 'map' && (
                <footer className="footer">
                    <div className="footer-content">
                        <div className="footer-brand">LocBook</div>
                        <div className="footer-links">
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

                                    <div className="modal-body">
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
    const imageUrl = place.local_image_path
        ? `${API_URL}/images/${place.local_image_path}`
        : null;

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
            </div>
            <div className="card-content">
                <h3 className="card-title" title={place.name}>{place.name}</h3>
                <div className="card-subtitle">{place.address}</div>
                <div className="card-tags">
                    {place.vibes?.slice(0, 2).map(v => (
                        <span key={v} className="tag-soft match">{v}</span>
                    ))}
                </div>
            </div>
        </div>
    )
}

function PlaceHeroImage({ place }) {
    const imageUrl = place.local_image_path
        ? `${API_URL}/images/${place.local_image_path}`
        : null;

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
