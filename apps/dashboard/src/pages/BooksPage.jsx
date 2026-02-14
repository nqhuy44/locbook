import React, { useState, useEffect } from 'react';
import { Plus, ChevronRight, Book as BookIcon, Globe, Lock } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

function BooksPage() {
    const { user } = useAuth();
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [newListDesc, setNewListDesc] = useState("");
    const [newListPrivacy, setNewListPrivacy] = useState("public");

    const [createLoading, setCreateLoading] = useState(false);

    useEffect(() => {
        if (user) {
            fetchLists();
        } else {
            setLoading(false);
        }
    }, [user]);

    const fetchLists = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            const res = await fetch(`${API_URL}/api/lists`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setLists(data);
            }
        } catch (err) {
            console.error("Failed to fetch books", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateList = async (e) => {
        e.preventDefault();
        if (!newListName.trim()) return;

        setCreateLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/lists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: newListName,
                    description: newListDesc,
                    privacy: newListPrivacy
                })
            });

            if (res.ok) {
                setShowCreateModal(false);
                setNewListName("");
                setNewListDesc("");
                setNewListPrivacy("public");
                fetchLists();
            } else {
                const err = await res.json();
                alert(`Failed to create book: ${err.detail || 'Unknown error'}`);
            }
        } catch (err) {
            console.error("Failed to create book", err);
            alert("An error occurred while creating the book.");
        } finally {
            setCreateLoading(false);
        }
    };

    // If not logged in, show login prompt
    if (!user) {
        return (
            <div className="books-page-container">
                <div className="books-login-container">
                    <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                        <div className="login-icon-circle">
                            <BookIcon size={40} />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Login to use Books</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                            Create collections of your favorite places, share them with friends, and more!
                        </p>

                        <div className="login-prompt-card">
                            <LogIn size={24} color="#d946ef" style={{ marginBottom: '0.5rem' }} />
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                Go to the <strong>Profile</strong> to sign in.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    if (loading) return <div className="loading-screen" style={{ color: 'white', padding: '2rem' }}>Loading books...</div>;

    return (
        <div className="books-page-container">
            {/* Header */}
            <div className="books-header">
                <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>My Books</h1>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                    <Plus size={18} /> New Book
                </button>
            </div>

            {/* List Content */}
            <div className="books-content">
                {lists.length === 0 ? (
                    <div className="empty-state">
                        <BookIcon size={48} className="empty-state-icon" />
                        <p>You haven't created any books yet.</p>
                        <p style={{ fontSize: '0.9rem' }}>Create a book to collect your favorite places!</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {lists.map(list => (
                            <a
                                key={list.id}
                                href={`/books/${list.id}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.history.pushState(null, '', `/books/${list.id}`);
                                    window.dispatchEvent(new CustomEvent('navigate', { detail: { path: `/books/${list.id}` } }));
                                }}
                                className="book-card"
                            >
                                <div>
                                    <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {list.name}
                                        {list.privacy === 'private' && <Lock size={14} color="var(--text-tertiary)" />}
                                        {list.privacy === 'public' && <Globe size={14} color="var(--text-tertiary)" />}
                                    </h3>
                                    {list.description && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{list.description}</p>}
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.5rem', display: 'inline-block' }}>
                                        {list.item_count} places
                                    </span>
                                </div>
                                <ChevronRight size={20} color="var(--text-tertiary)" />
                            </a>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '450px', height: 'auto', padding: '2rem', margin: '1rem' }}>
                        <h2 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '1.5rem' }}>Create New Book</h2>
                        <form onSubmit={handleCreateList}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Book Name</label>
                                <input
                                    type="text"
                                    value={newListName}
                                    onChange={e => setNewListName(e.target.value)}
                                    placeholder="e.g. Weekend Brunch, Best Coffee"
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Privacy</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setNewListPrivacy('private')}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            border: newListPrivacy === 'private' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                            background: newListPrivacy === 'private' ? 'rgba(217, 70, 239, 0.1)' : 'var(--bg-secondary)',
                                            color: newListPrivacy === 'private' ? 'var(--primary-color)' : 'var(--text-primary)',
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
                                        onClick={() => setNewListPrivacy('public')}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            border: newListPrivacy === 'public' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                            background: newListPrivacy === 'public' ? 'rgba(217, 70, 239, 0.1)' : 'var(--bg-secondary)',
                                            color: newListPrivacy === 'public' ? 'var(--primary-color)' : 'var(--text-primary)',
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
                                    value={newListDesc}
                                    onChange={e => setNewListDesc(e.target.value)}
                                    placeholder="What is this book about?"
                                    className="input-field"
                                    style={{ minHeight: '100px', resize: 'vertical' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary" disabled={createLoading}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={createLoading}>
                                    {createLoading ? 'Creating...' : 'Create Book'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BooksPage;
