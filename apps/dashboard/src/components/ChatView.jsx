import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, User, Bot } from 'lucide-react';
import { CONFIG } from '../config';
import ReactMarkdown from 'react-markdown';

const ChatView = ({ onPlaceClick, config }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [activeSuggestions, setActiveSuggestions] = useState([]);

    const messagesEndRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || '';

    useEffect(() => {
        // Generate NEW session on every reload (Page Load = New Context)
        const sid = 'sess_' + Math.random().toString(36).substr(2, 9);
        setSessionId(sid);

        // Optional: Clear any old session from storage if we previously set it
        localStorage.removeItem('locbook_chat_session');

        // Welcome message
        if (messages.length === 0) {
            setMessages([{
                role: 'assistant',
                content: "Hé lô! Marin đây 🎀. Hôm nay bạn muốn đi đâu? (Ví dụ: 'Tìm quán cafe yên tĩnh', 'Chỗ nào nhậu vui vẻ'...) ",
                timestamp: new Date()
            }]);
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = { role: 'user', content: input, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/chat/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    message: userMsg.content
                })
            });
            const data = await res.json();

            const replyMsg = {
                role: 'assistant',
                content: data.reply || "Marin đang bị lỗi kết nối 😢",
                timestamp: new Date()
            };

            setMessages(prev => [...prev, replyMsg]);

            // Update top suggestions panel if places are returned
            if (data.suggested_places && data.suggested_places.length > 0) {
                // Map fields to match PlaceCard expectations roughly or custom render
                setActiveSuggestions(data.suggested_places);
            }

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Lỗi kết nối rồi huhu 😭",
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!CONFIG.FEATURES.FEAT_AI_MATCHMAKE) return null;

    return (
        <div className="chat-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '15px', padding: '10px 15px 15px 15px', boxSizing: 'border-box' }}>

            {/* 1. Recommendations Panel (Top) */}
            <div className="recommendations-panel" style={{ flexShrink: 0 }}>
                <h3 style={{ color: '#d8b4fe', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={18} /> Marin's Picks
                </h3>

                {activeSuggestions.length === 0 ? (
                    <div style={{ padding: '20px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                        Chưa có gợi ý nào. Hãy hỏi Marin nhé! 👇
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
                        {activeSuggestions.map((place, idx) => {
                            const imageUrl = place.local_image_path
                                ? `${API_URL}/images/${place.local_image_path}`
                                : (place.images && place.images.length > 0 ? place.images[0] : null);

                            return (
                                <div
                                    key={idx}
                                    onClick={() => onPlaceClick(place)}
                                    style={{
                                        minWidth: '280px', maxWidth: '280px',
                                        height: '220px', // Fixed height
                                        background: '#2d1b4e', borderRadius: '16px', overflow: 'hidden',
                                        border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                                        flexShrink: 0,
                                        position: 'relative',
                                        display: 'flex', flexDirection: 'column'
                                    }}
                                >
                                    {/* Image Area */}
                                    <div style={{
                                        flex: 1,
                                        background: '#4c1d95',
                                        backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        position: 'relative'
                                    }}>
                                        {(!place.images || place.images.length === 0) && <span style={{ fontSize: '2rem' }}>📍</span>}

                                        {/* Gradient Overlay */}
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}></div>

                                        {/* Rating Badge */}
                                        <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', color: '#fbbf24', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            <span>⭐</span> {place.rating}
                                        </div>
                                    </div>

                                    {/* Info Area (Overlaid or distinct? Let's keep it separate for now or overlaid if fancy. Let's try overlaid text at bottom of image for TikTok style) */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        padding: '12px',
                                        color: 'white'
                                    }}>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{place.name}</h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.address}</p>

                                        <div style={{ marginTop: '8px', display: 'flex', gap: '5px', overflow: 'hidden' }}>
                                            {place.vibes && (Array.isArray(place.vibes) ? place.vibes : place.vibes.split(',')).slice(0, 2).map((v, i) => (
                                                <span key={i} style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '8px', backdropFilter: 'blur(4px)' }}>
                                                    {typeof v === 'string' ? v.trim() : v}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 2. Chat Conversation (Bottom - Flex Grow) */}
            <div className="chat-interface" style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                {/* Messages Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {messages.map((msg, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '12px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '50%',
                                background: msg.role === 'user' ? '#a855f7' : '#db2777',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                overflow: 'hidden'
                            }}>
                                {msg.role === 'user' ? (
                                    <User size={18} color="white" />
                                ) : (
                                    config?.MARIN?.AVATAR_IMAGE ? (
                                        <img
                                            src={config.MARIN.AVATAR_IMAGE.startsWith('http') ? config.MARIN.AVATAR_IMAGE : `${API_URL}${config.MARIN.AVATAR_IMAGE}`}
                                            alt="Marin"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <Bot size={18} color="white" />
                                    )
                                )}
                            </div>
                            <div style={{ maxWidth: '70%' }}>

                                <div style={{
                                    padding: '12px 16px', borderRadius: '18px',
                                    background: msg.role === 'user' ? '#a855f7' : '#3f3f46',
                                    color: 'white', lineHeight: '1.5',
                                    overflowWrap: 'break-word',
                                    fontSize: '14px'
                                }}>
                                    <ReactMarkdown
                                        components={{
                                            p: ({ node, ...props }) => <p style={{ margin: '0 0 8px 0', lastChild: { marginBottom: 0 } }} {...props} />,
                                            ul: ({ node, ...props }) => <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px' }} {...props} />,
                                            li: ({ node, ...props }) => <li style={{ marginBottom: '4px' }} {...props} />,
                                            strong: ({ node, ...props }) => <strong style={{ color: '#fbbf24', fontWeight: 600 }} {...props} />
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Bot size={18} color="white" />
                            </div>
                            <div style={{ padding: '12px 16px', borderRadius: '18px', background: '#3f3f46', color: 'rgba(255,255,255,0.5)' }}>
                                Marin đang suy nghĩ...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ position: 'relative', display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleSend()}
                            placeholder="Gõ tin nhắn cho Marin..."
                            style={{
                                flex: 1, padding: '14px 20px',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px', color: 'white', outline: 'none', fontSize: '15px'
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="btn-primary"
                            style={{ width: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatView;
