import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, MapPin, Trash2, ExternalLink, Utensils, Settings, Edit2, Globe, Lock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

function BookDetailPage({ bookId, onBack, onPlaceClick }) {
    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addUrl, setAddUrl] = useState("");
    const [addLoading, setAddLoading] = useState(false);
    const [items, setItems] = useState([]);

    // Edit State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editPrivacy, setEditPrivacy] = useState("private");
    const [editLoading, setEditLoading] = useState(false);

    useEffect(() => {
        fetchBookDetails();
    }, [bookId]);

    const fetchBookDetails = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            const res = await fetch(`${API_URL}/api/lists/${bookId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setBook(data);
                setItems(data.items || []);
                // Init edit state
                setEditName(data.name);
                setEditDesc(data.description || "");
                setEditPrivacy(data.privacy || "private");
            }
        } catch (err) {
            console.error("Failed to fetch book details", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPlace = async (e) => {
        e.preventDefault();
        setAddLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/lists/${bookId}/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    url: addUrl,
                    suggested_dishes: []
                })
            });

            if (res.ok) {
                const updatedBook = await res.json();
                setBook(updatedBook);
                setItems(updatedBook.items || []);
                setShowAddModal(false);
                setAddUrl("");
            } else {
                const err = await res.json();
                alert(`Failed to add place: ${err.detail}`);
            }
        } catch (err) {
            console.error("Failed to add place", err);
            alert("Error adding place");
        } finally {
            setAddLoading(false);
        }
    };

    const handleDeleteItem = async (placeId) => {
        if (!confirm("Remove this place from the book?")) return;
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/lists/${bookId}/items/${placeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                setItems(items.filter(i => i.place.id !== placeId));
            }
        } catch (err) {
            console.error("Failed to delete item", err);
        }
    };

    const handleDeleteBook = async () => {
        if (!confirm("Are you sure you want to delete this book? This action cannot be undone.")) return;
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/lists/${bookId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                onBack(); // Go back to list
            } else {
                alert("Failed to delete book");
            }
        } catch (err) {
            console.error("Failed to delete book", err);
            alert("Error deleting book");
        }
    };

    const handleUpdateBook = async (e) => {
        e.preventDefault();
        setEditLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/lists/${bookId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: editName,
                    description: editDesc,
                    privacy: editPrivacy
                })
            });

            if (res.ok) {
                const updatedBook = await res.json();
                setBook(updatedBook);
                setShowEditModal(false);
            } else {
                alert("Failed to update book");
            }
        } catch (err) {
            console.error("Failed to update book", err);
        } finally {
            setEditLoading(false);
        }
    };


    if (loading) return <div className="loading-screen" style={{ color: 'white', padding: '2rem' }}>Loading book...</div>;
    if (!book) return <div className="loading-screen" style={{ color: 'white', padding: '2rem' }}>Book not found</div>;

    return (
        <div className="books-page-container">
            {/* Header */}
            <div className="books-header with-border">
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 0 }}>
                    <ArrowLeft size={24} />
                </button>
                <div style={{ flex: 1, paddingLeft: '1rem', minWidth: 0 }}>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {book.name}
                        {book.privacy === 'private' && <Lock size={16} color="var(--text-tertiary)" />}
                        {book.privacy === 'public' && <Globe size={16} color="var(--text-tertiary)" />}
                    </h1>
                    {book.description && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.description}</p>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                        onClick={handleDeleteBook}
                        className="btn-secondary"
                        style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', marginRight: '1rem' }}
                        title="Delete Book"
                    >
                        <Trash2 size={18} />
                    </button>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => setShowEditModal(true)}
                            className="btn-secondary"
                            style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%' }}
                            title="Edit Book"
                        >
                            <Edit2 size={18} />
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="btn-primary"
                            style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '36px', height: '36px' }}
                            title="Add Place"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="books-content">
                {items.length === 0 ? (
                    <div className="empty-state">
                        <MapPin size={48} className="empty-state-icon" />
                        <p>No places in this book yet.</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="btn-secondary"
                            style={{ marginTop: '1rem' }}
                        >
                            Add from Google Maps
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {items.map(item => {
                            const place = item.place;
                            const imageUrl = place.images?.[0] || place.local_image_path;
                            // Fix image url logic - dup from PlaceCard but simplified
                            let finalImg = imageUrl;
                            if (imageUrl && !imageUrl.startsWith("http")) {
                                if (imageUrl.startsWith("/")) finalImg = `${API_URL}${imageUrl}`;
                                else finalImg = `${API_URL}/images/${imageUrl}`;
                            }

                            return (
                                <div key={place.id} className="place-item-card">
                                    <div onClick={() => onPlaceClick(place)} className="place-item-content">
                                        <div className="place-item-image">
                                            {finalImg ? (
                                                <img src={finalImg} alt={place.name} />
                                            ) : (
                                                <div className="place-item-placeholder">
                                                    {place.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</h3>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.address}</p>

                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                                {place.vibes?.slice(0, 2).map(v => (
                                                    <span key={v} className="tag-soft" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>{v}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Footer for Item */}
                                    <div className="place-item-actions">
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            {item.suggested_dishes?.length > 0 && (
                                                <span style={{ fontSize: '0.85rem', color: '#ffd700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Utensils size={14} /> {item.suggested_dishes.length} suggestions
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteItem(place.id)}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', padding: '4px', cursor: 'pointer' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '450px', height: 'auto', padding: '2rem', margin: '1rem' }}>
                        <h2 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '1rem' }}>Add Place</h2>
                        <form onSubmit={handleAddPlace}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Google Maps Link</label>
                                <input
                                    type="url"
                                    value={addUrl}
                                    onChange={e => setAddUrl(e.target.value)}
                                    placeholder="https://maps.app.goo.gl/..."
                                    className="input-field"
                                    required
                                />
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                                    Paste a Google Maps link. We'll analyze it and add it to your book.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary" disabled={addLoading}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={addLoading}>
                                    {addLoading ? 'Analyzing...' : 'Add Place'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '450px', height: 'auto', padding: '2rem', margin: '1rem' }}>
                        <h2 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '1.5rem' }}>Edit Book</h2>
                        <form onSubmit={handleUpdateBook}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Book Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    placeholder="e.g. Weekend Brunch"
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Privacy</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setEditPrivacy('private')}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            border: editPrivacy === 'private' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                            background: editPrivacy === 'private' ? 'rgba(217, 70, 239, 0.1)' : 'var(--bg-secondary)',
                                            color: editPrivacy === 'private' ? 'var(--primary-color)' : 'var(--text-primary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        <Lock size={20} />
                                        <span>Private</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditPrivacy('public')}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            border: editPrivacy === 'public' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                            background: editPrivacy === 'public' ? 'rgba(217, 70, 239, 0.1)' : 'var(--bg-secondary)',
                                            color: editPrivacy === 'public' ? 'var(--primary-color)' : 'var(--text-primary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        <Globe size={20} />
                                        <span>Public</span>
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Description (Optional)</label>
                                <textarea
                                    value={editDesc}
                                    onChange={e => setEditDesc(e.target.value)}
                                    placeholder="What is this book about?"
                                    className="input-field"
                                    style={{ minHeight: '100px', resize: 'vertical' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary" disabled={editLoading}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={editLoading}>
                                    {editLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BookDetailPage;
