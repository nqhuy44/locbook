import { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, Save, LogOut, Settings as SettingsIcon, MapPin, List, PlusCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
    const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loginInput, setLoginInput] = useState('');

    useEffect(() => {
        if (token) {
            setIsAuthenticated(true);
        }
    }, [token]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (loginInput.trim()) {
            localStorage.setItem('adminToken', loginInput);
            setToken(loginInput);
            setIsAuthenticated(true);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        setToken('');
        setIsAuthenticated(false);
    };

    if (!isAuthenticated) {
        return (
            <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0720' }}>
                <form onSubmit={handleLogin} style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', width: '300px' }}>
                    <h2 style={{ color: 'white', marginTop: 0, textAlign: 'center' }}>Admin Login</h2>
                    <input
                        type="password"
                        placeholder="Enter Admin Token"
                        value={loginInput}
                        onChange={e => setLoginInput(e.target.value)}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid #4ade80', color: 'white', marginTop: '1rem', marginBottom: '1rem' }}
                    />
                    <button type="submit" className="bmc-button" style={{ width: '100%', border: 'none', justifyContent: 'center' }}>Access Dashboard</button>
                </form>
            </div>
        );
    }

    return (
        <div className="app-container" style={{ minHeight: '100vh', background: '#0f0720' }}>
            <AdminPanel API_URL={API_URL} token={token} onLogout={handleLogout} />
        </div>
    );
}

const AdminPanel = ({ API_URL, token, onLogout }) => {
    const [view, setView] = useState('places'); // 'places' | 'config'
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPlace, setSelectedPlace] = useState(null); // For editing
    const [editForm, setEditForm] = useState({});

    // Fetch places
    useEffect(() => {
        if (view === 'places') fetchPlaces();
    }, [view]);

    const fetchPlaces = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/places?limit=1000`);
            const data = await res.json();
            setPlaces(data.data);
        } catch (e) {
            console.error("Failed to fetch", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this place?")) return;
        try {
            const res = await fetch(`${API_URL}/api/places/${id}`, {
                method: 'DELETE',
                headers: { 'x-admin-token': token }
            });
            if (res.ok) {
                setPlaces(places.filter(p => p._id !== id));
            } else {
                if (res.status === 403) alert("Unauthorized: Invalid Token");
                else alert("Failed to delete");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting");
        }
    };

    const openEdit = (place) => {
        setSelectedPlace(place);
        setEditForm({
            name: place.name,
            address: place.address || "",
            categories: place.categories?.join(", ") || "",
            vibes: place.vibes?.join(", ") || "",
            price_level: place.price_level || "",
            rating: place.rating || "",
            google_maps_url: place.google_maps_url || ""
        });
    };

    const handleSave = async () => {
        try {
            const processList = (str) => str.split(",").map(s => s.trim()).filter(Boolean);
            const payload = {
                ...editForm,
                categories: processList(editForm.categories),
                vibes: processList(editForm.vibes),
                rating: editForm.rating ? parseFloat(editForm.rating) : null
            };

            const res = await fetch(`${API_URL}/api/places/${selectedPlace._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': token
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const updated = await res.json();
                setPlaces(places.map(p => p._id === selectedPlace._id ? { ...updated, _id: selectedPlace._id } : p));
                setSelectedPlace(null);
            } else {
                if (res.status === 403) alert("Unauthorized: Invalid Token");
                else alert("Failed to update");
            }
        } catch (e) {
            console.error(e);
            alert("Error updating");
        }
    };

    const filteredPlaces = places.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.categories?.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="app-main-container" style={{ padding: '2rem 3rem', color: 'white' }}>
            {/* Mobile Styles */}
            < style > {`
                @media (max-width: 768px) {
                    .app-container { padding: 1rem !important; }
                    .admin-header { flex-direction: column; align-items: stretch !important; gap: 1.5rem; }
                    .header-top { justify-content: space-between; width: 100%; }
                    .brand { font-size: 1.5rem !important; }
                    .nav-links { width: 100%; justify-content: space-around; margin-top: 1rem; }
                    
                    /* Table -> Cards */
                    table, thead, tbody, th, td, tr { display: block; }
                    thead tr { position: absolute; top: -9999px; left: -9999px; }
                    tr.admin-row { 
                        margin-bottom: 1rem; 
                        background: rgba(255,255,255,0.03); 
                        border-radius: 12px; 
                        padding: 1.5rem; 
                        border: 1px solid rgba(255,255,255,0.05) !important; 
                        position: relative;
                    }
                    td { 
                        border: none !important; 
                        padding: 0.5rem 0 !important; 
                        position: relative; 
                        color: rgba(255,255,255,0.8);
                    }
                    /* Category tags container */
                    td:nth-child(3) { margin-top: 0.5rem; }
                    /* Actions - moved to top right absolute */
                    td:nth-child(2) { 
                        position: absolute; 
                        top: 1rem; 
                        right: 1rem; 
                        padding: 0 !important;
                    }
                    
                    /* Config Panel Mobile */
                    .filter-btn { width: 100%; justify-content: center; margin-top: 1rem; }
                    .save-float-container {
                         width: calc(100% - 2rem);
                         left: 1rem !important;
                         right: 1rem !important;
                         bottom: 1rem !important;
                         display: flex;
                         justify-content: center;
                    }
                    .save-float-container button {
                        width: 100%;
                        justify-content: center;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.5) !important;
                    }
                    .header-controls {
                        width: 100%;
                        flex-wrap: wrap;
                    }
                    .search-wrapper {
                        width: 100% !important;
                        margin-bottom: 1rem;
                    }
                    .config-header {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 1rem;
                    }
                    .config-header h2 {
                        margin-bottom: 0.5rem !important;
                    }
                    /* Override global bmc-button mobile styles (which force circular icon-only) */
                    .add-category-btn, 
                    .save-float-container button {
                        font-size: 0.9rem !important;
                        width: 100% !important;
                        height: auto !important;
                        border-radius: 8px !important;
                        padding: 0.8rem !important; 
                        aspect-ratio: auto !important;
                    }
                    .save-float-container button {
                        border-radius: 99px !important;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.5) !important;
                    }
                }
            `}</style>

            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="brand" style={{ fontSize: '2rem', cursor: 'default', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        LOCBOOK <span className="brand-subtitle" style={{ fontSize: '1rem', opacity: 0.7 }}>Admin</span>
                    </div>

                    <div className="nav-links" style={{ display: 'flex', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '99px' }}>
                        <button
                            className={`nav-link ${view === 'places' ? 'active' : ''}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: view === 'places' ? '#d8b4fe' : 'rgba(255,255,255,0.6)', padding: '0.5rem 1rem' }}
                            onClick={() => setView('places')}
                        >
                            <MapPin size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Places
                        </button>
                        <button
                            className={`nav-link ${view === 'config' ? 'active' : ''}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: view === 'config' ? '#d8b4fe' : 'rgba(255,255,255,0.6)', padding: '0.5rem 1rem' }}
                            onClick={() => setView('config')}
                        >
                            <SettingsIcon size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Configuration
                        </button>
                    </div>
                </div>

                <div className="header-controls" style={{ display: 'flex', gap: '1rem' }}>
                    {view === 'places' && (
                        <div className="search-wrapper" style={{ minWidth: '300px' }}>
                            <Search size={18} color="#d8b4fe" />
                            <input
                                className="search-input"
                                placeholder="Search by name or category..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                    )}
                    <button onClick={onLogout} className="filter-btn" style={{ borderColor: '#f87171', color: '#f87171', whiteSpace: 'nowrap' }}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </div>

            {
                view === 'places' ? (
                    loading ? (
                        <div style={{ textAlign: 'center', marginTop: '4rem' }}>Loading...</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#d8b4fe', fontSize: '0.9rem' }}>
                                    <th style={{ padding: '1rem', width: '20%' }}>Name</th>
                                    <th style={{ padding: '1rem', width: '100px' }}>Actions</th>
                                    <th style={{ padding: '1rem' }}>Categories</th>
                                    <th style={{ padding: '1rem' }}>Vibes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPlaces.map(place => (
                                    <tr key={place._id} className="admin-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{place.name}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                <button
                                                    onClick={() => openEdit(place)}
                                                    style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer' }}
                                                    title="Edit"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(place._id)}
                                                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {place.categories?.slice(0, 5).map(c => <span key={c} className="tag-soft">{c}</span>)}
                                                {place.categories?.length > 5 && <span className="tag-soft">...</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{place.vibes?.slice(0, 3).join(", ")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                ) : (
                    <ConfigPanel API_URL={API_URL} token={token} />
                )
            }

            {/* Edit Modal */}
            {
                selectedPlace && (
                    <div className="modal-overlay" onClick={() => setSelectedPlace(null)}>
                        <div
                            className="modal-content"
                            style={{ height: 'auto', maxHeight: '90vh', width: '600px', padding: '2rem' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Edit {selectedPlace.name}</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* ... Form Inputs Same As Before ... */}
                                <div>
                                    <label className="detail-label">Name</label>
                                    <input
                                        className="search-input"
                                        style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }}
                                        value={editForm.name || ''}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="detail-label">Address</label>
                                    <input
                                        className="search-input"
                                        style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }}
                                        value={editForm.address || ''}
                                        onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="detail-label">Categories</label>
                                    <textarea className="search-input" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }} value={editForm.categories} onChange={e => setEditForm({ ...editForm, categories: e.target.value })} />
                                </div>
                                <div>
                                    <label className="detail-label">Vibes</label>
                                    <textarea className="search-input" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }} value={editForm.vibes} onChange={e => setEditForm({ ...editForm, vibes: e.target.value })} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div><label className="detail-label">Rating</label><input type="number" step="0.1" className="search-input" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }} value={editForm.rating || ''} onChange={e => setEditForm({ ...editForm, rating: e.target.value })} /></div>
                                    <div><label className="detail-label">Price</label><input className="search-input" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }} value={editForm.price_level || ''} onChange={e => setEditForm({ ...editForm, price_level: e.target.value })} /></div>
                                </div>
                            </div>
                            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button onClick={() => setSelectedPlace(null)} className="filter-btn">Cancel</button>
                                <button onClick={handleSave} className="bmc-button" style={{ border: 'none', cursor: 'pointer' }}>Save Changes</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

const ConfigPanel = ({ API_URL, token }) => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(false);
    const [jsonMode, setJsonMode] = useState(false);
    const [jsonInput, setJsonInput] = useState("");

    // Local state for Category Mapping editing (array format for easier rendering)
    const [categoryMappings, setCategoryMappings] = useState([]);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/config`);
            const data = await res.json();
            setConfig(data);
            setJsonInput(JSON.stringify(data, null, 2));

            // Convert object to array for UI
            if (data.CATEGORY_KEYWORDS) {
                const mappings = Object.entries(data.CATEGORY_KEYWORDS).map(([key, vals]) => ({
                    id: Math.random().toString(36).substr(2, 9),
                    name: key,
                    keywords: Array.isArray(vals) ? vals.join(", ") : vals
                }));
                // Sort by name or precedence? Keep default order.
                setCategoryMappings(mappings);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            let payload = { ...config };

            if (jsonMode) {
                try {
                    payload = JSON.parse(jsonInput);
                } catch (e) {
                    alert("Invalid JSON");
                    return;
                }
            } else {
                // Reconstruct CATEGORY_KEYWORDS from array
                const newKeywords = {};
                categoryMappings.forEach(item => {
                    if (item.name.trim()) {
                        newKeywords[item.name.trim()] = item.keywords.split(",").map(s => s.trim()).filter(Boolean);
                    }
                });
                payload.CATEGORY_KEYWORDS = newKeywords;
            }

            const res = await fetch(`${API_URL}/api/config`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': token
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Configuration saved!");
                const saved = await res.json();
                setConfig(saved);
                setJsonInput(JSON.stringify(saved, null, 2));

                // Refresh local state
                if (saved.CATEGORY_KEYWORDS) {
                    const mappings = Object.entries(saved.CATEGORY_KEYWORDS).map(([key, vals]) => ({
                        id: Math.random().toString(36).substr(2, 9),
                        name: key,
                        keywords: Array.isArray(vals) ? vals.join(", ") : vals
                    }));
                    setCategoryMappings(mappings);
                }
            } else {
                alert("Failed to save config");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving config");
        }
    };

    // Helper to add new category mapping
    const addCategoryMapping = () => {
        setCategoryMappings([...categoryMappings, { id: Math.random().toString(), name: "New Category", keywords: "" }]);
    };

    const removeCategoryMapping = (id) => {
        if (!window.confirm("Remove this category mapping?")) return;
        setCategoryMappings(categoryMappings.filter(m => m.id !== id));
    };

    const updateCategoryMapping = (id, field, value) => {
        setCategoryMappings(categoryMappings.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    const commonInputStyle = {
        width: '100%',
        background: 'rgba(0, 0, 0, 0.3)',
        border: 'none',
        color: 'white',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        fontSize: '0.9rem',
        fontFamily: 'inherit',
        marginTop: '0.25rem'
    };

    if (loading) return <div>Loading Configuration...</div>;
    if (!config) return <div>Error loading config</div>;

    return (
        <div style={{ maxWidth: '100%', paddingBottom: '4rem' }}>
            <div className="config-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ margin: 0 }}>App Configuration</h2>
                <button className="filter-btn" onClick={() => setJsonMode(!jsonMode)}>
                    {jsonMode ? "Switch to Form UI" : "Switch to JSON Mode"}
                </button>
            </div>

            {jsonMode ? (
                <textarea
                    value={jsonInput}
                    onChange={e => setJsonInput(e.target.value)}
                    style={{ ...commonInputStyle, height: '500px', fontFamily: 'monospace', color: '#a5f3fc' }}
                />
            ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'start' }}>

                    {/* LEFT COLUMN */}
                    <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '2rem', minWidth: '300px' }}>
                        {/* Feature Flags */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                            <h3 style={{ marginTop: 0, color: '#d8b4fe', marginBottom: '1rem' }}>Feature Flags</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                {Object.entries(config.FEATURES || {}).map(([key, val]) => (
                                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px', border: val ? '1px solid #d8b4fe' : '1px solid transparent', transition: 'all 0.2s' }}>
                                        <input
                                            type="checkbox"
                                            checked={val}
                                            onChange={e => setConfig({
                                                ...config,
                                                FEATURES: { ...config.FEATURES, [key]: e.target.checked }
                                            })}
                                            style={{ accentColor: '#d8b4fe', transform: 'scale(1.2)' }}
                                        />
                                        <span style={{ fontSize: '0.9rem', color: val ? 'white' : 'rgba(255,255,255,0.6)' }}>{key.replace('ENABLE_', '')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Links */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                            <h3 style={{ marginTop: 0, color: '#d8b4fe', marginBottom: '1rem' }}>External Links</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {Object.entries(config.LINKS || {}).map(([key, val]) => (
                                    <div key={key}>
                                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem', display: 'block' }}>
                                            {key.replace(/_/g, " ")}
                                        </label>
                                        <input
                                            style={commonInputStyle}
                                            value={val}
                                            onChange={e => setConfig({
                                                ...config,
                                                LINKS: { ...config.LINKS, [key]: e.target.value }
                                            })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div style={{ flex: '1.5 1 500px', display: 'flex', flexDirection: 'column', gap: '2rem', minWidth: '300px' }}>
                        {/* Home Categories */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                            <h3 style={{ marginTop: 0, color: '#d8b4fe' }}>Home Page Display Order</h3>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem', marginBottom: '1rem' }}>
                                Which categories from above should appear on the homepage and in what order?
                            </p>
                            <textarea
                                style={{ ...commonInputStyle, minHeight: '80px', color: '#a5f3fc' }}
                                value={config.HOME_CATEGORIES?.join(", ")}
                                onChange={e => setConfig({
                                    ...config,
                                    HOME_CATEGORIES: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                                })}
                            />
                        </div>

                        {/* Category Logic */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                <h3 style={{ margin: 0, color: '#d8b4fe' }}>Category Rules</h3>
                                <button onClick={addCategoryMapping} className="bmc-button add-category-btn" style={{ fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}>
                                    <PlusCircle size={16} /> Add New Category Rule
                                </button>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: 0, marginBottom: '1.5rem' }}>
                                Define keyword patterns to automatically detect categories.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {categoryMappings.map((mapping) => (
                                    <div key={mapping.id} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1rem',
                                        background: 'rgba(255,255,255,0.02)',
                                        padding: '1.2rem',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        position: 'relative'
                                    }}>
                                        <button
                                            onClick={() => removeCategoryMapping(mapping.id)}
                                            style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', opacity: 0.7 }}
                                            title="Remove"
                                        >
                                            <Trash2 size={16} />
                                        </button>

                                        <div>
                                            <label style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.3rem', display: 'block', fontWeight: 600 }}>CATEGORY</label>
                                            <input
                                                value={mapping.name}
                                                onChange={(e) => updateCategoryMapping(mapping.id, 'name', e.target.value)}
                                                style={commonInputStyle}
                                                placeholder="Category Name"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.3rem', display: 'block', fontWeight: 600 }}>KEYWORDS</label>
                                            <textarea
                                                value={mapping.keywords}
                                                onChange={(e) => updateCategoryMapping(mapping.id, 'keywords', e.target.value)}
                                                style={{ ...commonInputStyle, minHeight: '60px', resize: 'vertical', color: '#d1d5db' }}
                                                placeholder="comma, separated, keywords"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {categoryMappings.length === 0 && <div style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>No mappings defined.</div>}
                        </div>
                    </div>
                </div>
            )}

            <div className="save-float-container" style={{ position: 'fixed', bottom: '2rem', right: '3rem', zIndex: 100 }}>
                <button onClick={handleSave} className="bmc-button" style={{ border: 'none', cursor: 'pointer', padding: '1rem 2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                    <Save size={18} /> Save Configuration
                </button>
            </div>
        </div>
    );
};

export default App;
