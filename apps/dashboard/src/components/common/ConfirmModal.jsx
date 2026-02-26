"use client";
import React from 'react';
import { AlertCircle, X } from 'lucide-react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger' }) => {
    if (!isOpen) return null;

    const isDanger = type === 'danger';

    return (
        <div className="popup-overlay" onClick={onCancel}>
            <div className="popup-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
                <div className="popup-body">
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '50%',
                            background: isDanger ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-primary)',
                            color: isDanger ? '#ef4444' : 'var(--primary-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <AlertCircle size={24} />
                        </div>
                    </div>

                    <h3 className="popup-title" style={{ marginBottom: '0.5rem' }}>{title}</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                        {message}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <button
                            className="btn-secondary"
                            onClick={onCancel}
                            style={{ justifyContent: 'center' }}
                        >
                            {cancelText}
                        </button>
                        <button
                            className={isDanger ? "btn-secondary" : "btn-primary"}
                            onClick={onConfirm}
                            style={{
                                justifyContent: 'center',
                                background: isDanger ? '#ef4444' : undefined,
                                color: isDanger ? 'white' : undefined,
                                borderColor: isDanger ? '#ef4444' : undefined
                            }}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
