import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, User, Bot, MapPin } from "lucide-react";
import { CONFIG } from "../config";
import ReactMarkdown from "react-markdown";
import { API_URL } from "../utils/config";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { LogIn } from "lucide-react";

const ChatView = ({ onPlaceClick, config }) => {
  const { user, token, fetchWithAuth } = useAuth();
  const { t } = useLanguage();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [activeSuggestions, setActiveSuggestions] = useState([]);

  const messagesEndRef = useRef(null);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Geolocation error or denied:", error);
        },
      );
    }
  }, []);

  // Auth Guard
  if (!user) {
    return (
      <div className="books-page-container">
        <div className="books-login-container">
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <div className="login-icon-circle">
              <Sparkles size={40} />
            </div>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                marginBottom: "0.5rem",
              }}
            >
              {t("ask_marin.login_required")}
            </h2>
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: "2rem",
              }}
            >
              {t("ask_marin.chat_login_msg")}
            </p>

            <div className="login-prompt-card">
              <LogIn
                size={24}
                color="#d946ef"
                style={{ marginBottom: "0.5rem" }}
              />
              <div
                style={{
                  fontSize: "0.9rem",
                  color: "var(--text-secondary)",
                }}
              >
                {t("ask_marin.go_to_profile")}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    // Generate NEW session on every reload (Page Load = New Context)
    const sid = "sess_" + Math.random().toString(36).substr(2, 9);
    setSessionId(sid);

    // Optional: Clear any old session from storage if we previously set it
    localStorage.removeItem("spotary_chat_session");

    // Welcome message
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "Hé lô! Marin đây 🎀. Hôm nay bạn muốn đi đâu? (Ví dụ: 'Tìm quán cafe yên tĩnh', 'Chỗ nào nhậu vui vẻ'...) ",
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = { role: "user", content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMsg.content,
          location: location, // Send location if available
        }),
      });
      const data = await res.json();

      const replyMsg = {
        role: "assistant",
        content: data.reply || "Marin đang bị lỗi kết nối 😢",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, replyMsg]);

      // Update top suggestions panel if places are returned
      if (data.suggested_places && data.suggested_places.length > 0) {
        // Map fields to match PlaceCard expectations roughly or custom render
        setActiveSuggestions(data.suggested_places);
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Lỗi kết nối rồi huhu 😭",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!CONFIG.FEATURES.ASK_MARIN) return null;

  return (
    <div className="chat-view">
      {/* 1. Recommendations Panel (Top) */}
      <div className="recommendations-panel">
        <h3 className="recommendations-title">
          <Sparkles size={16} /> Marin's Picks
        </h3>

        {activeSuggestions.length === 0 ? (
          <div className="empty-recommendations">
            Chưa có gợi ý nào. Hãy hỏi Marin nhé! 👇
          </div>
        ) : (
          <div
            className="suggestions-list hidden-scrollbar"
            style={{ gap: "8px", paddingBottom: "4px" }}
          >
            {activeSuggestions.map((place, idx) => {
              let imageUrl = place.images?.[0] || place.local_image_path;
              if (imageUrl) {
                if (imageUrl.startsWith("/images/"))
                  imageUrl = `${API_URL}${imageUrl}`;
                else if (!imageUrl.startsWith("http"))
                  imageUrl = `${API_URL}/images/${imageUrl}`;
              }

              return (
                <div
                  key={idx}
                  onClick={() => onPlaceClick(place)}
                  style={{
                    minWidth: "120px",
                    maxWidth: "120px",
                    background: "white",
                    borderRadius: "8px",
                    overflow: "hidden",
                    cursor: "pointer",
                    border: "1px solid var(--border-color)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      height: "90px",
                      background: "#f3f4f6",
                      position: "relative",
                    }}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={place.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ccc",
                          fontSize: "1.5rem",
                        }}
                      >
                        🏠
                      </div>
                    )}
                    <div
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        background: "rgba(255,255,255,0.9)",
                        padding: "1px 4px",
                        borderRadius: "3px",
                        fontSize: "0.65rem",
                        fontWeight: "bold",
                        color: "#b45309",
                      }}
                    >
                      ★ {place.rating}
                    </div>
                  </div>
                  <div style={{ padding: "6px" }}>
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "0.8rem",
                        marginBottom: "2px",
                        whiteSpace: "nowrap",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        lineHeight: "1.2",
                        color: "var(--text-primary)",
                      }}
                    >
                      {place.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-tertiary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {place.address?.split(",")[0]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Chat Area (Middle) - Scrollable */}
      <div className="chat-messages">
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          return (
            <div key={idx} className={`message-row ${isUser ? "user" : "bot"}`}>
              <div className={`message-avatar ${isUser ? "user" : "bot"}`}>
                {isUser ? (
                  <User size={18} color="white" />
                ) : config?.MARIN?.AVATAR_IMAGE ? (
                  <img
                    src={
                      config.MARIN.AVATAR_IMAGE.startsWith("http")
                        ? config.MARIN.AVATAR_IMAGE
                        : `${API_URL}${config.MARIN.AVATAR_IMAGE}`
                    }
                    alt="Marin"
                  />
                ) : (
                  <Bot size={18} color="var(--accent-color)" />
                )}
              </div>
              <div className="message-bubble-wrapper">
                <div className={`message-bubble ${isUser ? "user" : "bot"}`}>
                  <ReactMarkdown
                    components={{
                      p: ({ node, ...props }) => (
                        <p
                          style={{
                            margin: "0 0 8px 0",
                            lastChild: { marginBottom: 0 },
                          }}
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul
                          style={{ margin: "0 0 8px 0", paddingLeft: "20px" }}
                          {...props}
                        />
                      ),
                      li: ({ node, ...props }) => (
                        <li style={{ marginBottom: "4px" }} {...props} />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong
                          style={{
                            color: isUser ? "#fef08a" : "var(--accent-color)",
                            fontWeight: 600,
                          }}
                          {...props}
                        />
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
                <div className={`message-timestamp ${isUser ? "user" : "bot"}`}>
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="typing-indicator">
            <div className="typing-avatar">
              <Bot size={18} color="white" />
            </div>
            <div className="typing-bubble">Marin đang suy nghĩ...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Gõ tin nhắn cho Marin..."
            className="chat-input"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="btn-primary chat-send-btn"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
