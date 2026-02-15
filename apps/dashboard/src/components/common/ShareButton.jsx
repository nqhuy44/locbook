import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const ShareButton = ({ title, url, className, style, iconOnly = false }) => {
    const [copied, setCopied] = useState(false);
    const { showToast } = useToast();

    const handleShare = async () => {
        const shareData = {
            title: title || document.title,
            url: url || window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareData.url);
                setCopied(true);
                showToast("Link copied to clipboard", "success");
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error("Failed to copy:", err);
                showToast("Could not copy link", "error");
            }
        }
    };

    return (
        <button
            className={`share-btn ${className || ''}`}
            onClick={handleShare}
            style={style}
            title="Share"
        >
            {copied ? <Check size={18} /> : <Share2 size={18} />}
            {copied && !iconOnly && <span style={{ marginLeft: '4px', fontSize: '0.8rem' }}>Copied!</span>}
        </button>
    );
};

export default ShareButton;
