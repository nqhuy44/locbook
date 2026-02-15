import React, { useEffect } from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success': return <Check size={18} />;
            case 'error': return <AlertCircle size={18} />;
            default: return <Info size={18} />;
        }
    };

    const getColors = () => {
        switch (type) {
            case 'success': return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' };
            case 'error': return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' };
            default: return { bg: '#e0f2fe', text: '#075985', border: '#bae6fd' };
        }
    };

    const colors = getColors();

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px', // Or center it if preferred
            zIndex: 9999,
            background: 'var(--bg-card)', // Use app theme background
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '300px',
            animation: 'slideIn 0.3s ease-out'
        }}>
            <div style={{
                color: colors.text,
                background: colors.bg,
                width: '28px', height: '28px',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                {getIcon()}
            </div>
            <div style={{ flex: 1, fontSize: '0.9rem', fontWeight: '500' }}>
                {message}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}>
                <X size={16} />
            </button>
            <style>{`
                @keyframes slideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Toast;
