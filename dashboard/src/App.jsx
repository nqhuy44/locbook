import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { CONFIG } from './config';
import MapView from './components/MapView';

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [currentView, setCurrentView] = useState('list'); // 'list' | 'map'

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [activeVibes, setActiveVibes] = useState([]);
    const [activeCats, setActiveCats] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/places?limit=150`);
            const data = await res.json();
            setPlaces(data.data);
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    // 1. Precise Categorization Logic using CONFIG
    const categorizedPlaces = useMemo(() => {
        const groups = {};
        CONFIG.HOME_CATEGORIES.forEach(cat => groups[cat] = []);

        // Add a default fallback if not in list
        if (!groups["Casual"]) groups["Casual"] = [];

        places.forEach(place => {
            const cats = place.categories?.join(" ").toLowerCase() || "";
            const vibes = place.vibes?.join(" ").toLowerCase() || "";
            const combined = cats + " " + vibes;
            // Dynamic checking based on CONFIG
            for (const [category, keywords] of Object.entries(CONFIG.CATEGORY_KEYWORDS)) {
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

    // 2. Filter Lists
    const { allVibes, allCategories } = useMemo(() => {
        const v = new Set();
        const c = new Set();
        places.forEach(p => {
            p.vibes?.forEach(x => v.add(x));
            p.categories?.forEach(x => c.add(x));
        });
        return {
            allVibes: Array.from(v).sort(),
            allCategories: Array.from(c).sort()
        };
    }, [places]);

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
    const closeModal = () => { setSelectedPlace(null); document.body.style.overflow = 'auto'; };

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
                        LOCBOOK <span className="brand-subtitle">by Marin</span>
                    </div>
                    <div className="nav-links">
                        {CONFIG.FEATURES.ENABLE_DISCOVER && (
                            <span
                                className={`nav-link ${currentView === 'list' && !isFiltering ? 'active' : ''}`}
                                onClick={() => { setSearchTerm(''); setActiveVibes([]); setActiveCats([]); setCurrentView('list') }}
                            >
                                Discover
                            </span>
                        )}

                        {CONFIG.FEATURES.ENABLE_MAP && (
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
                    <a href={CONFIG.LINKS.LOC_REQUEST || "#"} target="_blank" rel="noreferrer" className="nav-link" style={{ marginRight: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <PlusCircle size={18} /> Request Place
                    </a>
                    {CONFIG.FEATURES.ENABLE_BUY_ME_COFFEE && (
                        <a href={CONFIG.LINKS.BUY_ME_COFFEE} target="_blank" rel="noreferrer" className="bmc-button">
                            <Coffee size={16} /> Buy me a coffee
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
                        {allVibes.map(vibe => (
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
                        {allCategories.map(cat => (
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
                    <MapView places={isFiltering ? filteredPlaces : places} />
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
                        // Use CONFIG for Home Categories Order
                        CONFIG.HOME_CATEGORIES.map(category => {
                            if (!categorizedPlaces[category] || categorizedPlaces[category].length === 0) return null;
                            return (
                                <div key={category} className="section-wrapper">
                                    <div className="section-header">
                                        {getSectionIcon(category)}
                                        <h2 className="section-title">{category}</h2>
                                    </div>
                                    <div className="places-row">
                                        {categorizedPlaces[category].map(place => (
                                            <PlaceCard key={place._id} place={place} onClick={() => openModal(place)} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )
                )}
            </main>

            {/* Footer */}
            {CONFIG.FEATURES.ENABLE_FOOTER && currentView !== 'map' && (
                <footer className="footer">
                    <div className="footer-content">
                        <div className="footer-brand">LOCBOOK</div>
                        <div className="footer-links">
                            {CONFIG.LINKS.GITHUB && (
                                <a href={CONFIG.LINKS.GITHUB} target="_blank" rel="noreferrer"><Github size={18} /> GitHub</a>
                            )}
                            {CONFIG.LINKS.AUTHOR_WEBSITE && (
                                <a href={CONFIG.LINKS.AUTHOR_WEBSITE} target="_blank" rel="noreferrer"><Globe size={18} /> Website</a>
                            )}
                            {CONFIG.LINKS.FEEDBACK && (
                                <a href={CONFIG.LINKS.FEEDBACK} target="_blank" rel="noreferrer"><MessageSquare size={18} /> Feedback</a>
                            )}
                        </div>
                        <div className="footer-text">
                            Made by nqhuy
                        </div>
                        <div className="footer-copyright">
                            © {new Date().getFullYear()} LocBook. All rights reserved.
                        </div>
                    </div>
                </footer>
            )}


            {/* Modal */}
            {
                selectedPlace && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
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

export default App
