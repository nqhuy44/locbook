import { useState, useEffect } from 'react';
import { Search, X, Edit2, Trash2, Plus, Sparkles, Check, Save } from 'lucide-react';

const AdminPanel = ({ API_URL }) => {
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPlace, setSelectedPlace] = useState(null); // For editing

    // Edit Form State
    const [editForm, setEditForm] = useState({});

    useEffect(() => {
        fetchPlaces();
    }, []);

    const fetchPlaces = async () => {
        setLoading(true);
        try {
            // Fetch more for admin to easily search locally, or implement server search
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
                method: 'DELETE'
            });
            if (res.ok) {
                setPlaces(places.filter(p => p._id !== id));
            } else {
                alert("Failed to delete");
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
            // Process lists
            const processList = (str) => str.split(",").map(s => s.trim()).filter(Boolean);

            const payload = {
                ...editForm,
                categories: processList(editForm.categories),
                vibes: processList(editForm.vibes),
                rating: editForm.rating ? parseFloat(editForm.rating) : null
            };

            const res = await fetch(`${API_URL}/api/places/${selectedPlace._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const updated = await res.json();
                // Update local state - handling _id vs id nuance if any, but backend returns object
                // Backend returns updated place. Ensure we map it back to list
                // Note: backend Pydantic might return 'id' or '_id' depending on alias config
                // We enabled by_alias=True in api.py for GET list, but standard return in PUT?
                // Let's assume it returns standard JSON. We refetch or patch.
                // Simplest: Refetch or patch list. 
                // Let's patch list.

                // Helper to normalize ID
                const normId = updated._id || updated.id;

                setPlaces(places.map(p => p._id === selectedPlace._id ? { ...updated, _id: selectedPlace._id } : p));
                setSelectedPlace(null);
            } else {
                alert("Failed to update");
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
        <div className="admin-container" style={{ padding: '2rem 3rem', color: 'white' }}>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Admin Dashboard</h1>
                <div className="search-wrapper" style={{ minWidth: '300px' }}>
                    <Search size={18} color="#d8b4fe" />
                    <input
                        className="search-input"
                        placeholder="Search by name or category..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', marginTop: '4rem' }}>Loading...</div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#d8b4fe', fontSize: '0.9rem' }}>
                            <th style={{ padding: '1rem' }}>Name</th>
                            <th style={{ padding: '1rem' }}>Categories</th>
                            <th style={{ padding: '1rem' }}>Vibes</th>
                            <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPlaces.map(place => (
                            <tr key={place._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '1rem', fontWeight: 600 }}>{place.name}</td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {place.categories?.map(c => <span key={c} className="tag-soft">{c}</span>)}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>{place.vibes?.slice(0, 3).join(", ")}</td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <button
                                        onClick={() => openEdit(place)}
                                        style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', marginRight: '1rem' }}
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(place._id)}
                                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Edit Modal */}
            {selectedPlace && (
                <div className="modal-overlay" onClick={() => setSelectedPlace(null)}>
                    <div
                        className="modal-content"
                        style={{ height: 'auto', maxHeight: '90vh', width: '600px', padding: '2rem' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Edit {selectedPlace.name}</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="detail-label">Name</label>
                                <input
                                    className="search-input"
                                    style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }}
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="detail-label">Address</label>
                                <input
                                    className="search-input"
                                    style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }}
                                    value={editForm.address}
                                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="detail-label">Categories (comma separated)</label>
                                <textarea
                                    className="search-input"
                                    style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', minHeight: '80px', resize: 'vertical' }}
                                    value={editForm.categories}
                                    onChange={e => setEditForm({ ...editForm, categories: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="detail-label">Vibes (comma separated)</label>
                                <textarea
                                    className="search-input"
                                    style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', minHeight: '60px' }}
                                    value={editForm.vibes}
                                    onChange={e => setEditForm({ ...editForm, vibes: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="detail-label">Rating</label>
                                    <input
                                        className="search-input"
                                        type="number" step="0.1"
                                        style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }}
                                        value={editForm.rating}
                                        onChange={e => setEditForm({ ...editForm, rating: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="detail-label">Price Level</label>
                                    <input
                                        className="search-input"
                                        style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }}
                                        value={editForm.price_level}
                                        onChange={e => setEditForm({ ...editForm, price_level: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button onClick={() => setSelectedPlace(null)} className="filter-btn">Cancel</button>
                            <button onClick={handleSave} className="bmc-button" style={{ border: 'none', cursor: 'pointer' }}>
                                <Save size={16} /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
