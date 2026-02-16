import React, { useState, useEffect } from "react";
import {
  Plus,
  ChevronRight,
  Book as BookIcon,
  Globe,
  Lock,
  X,
  Users,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { LogIn } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

const BookItem = ({ list, t, isOwned = false }) => (
  <a
    href={`/books/${list.id}`}
    onClick={(e) => {
      e.preventDefault();
      window.history.pushState(null, "", `/books/${list.id}`);
      window.dispatchEvent(
        new CustomEvent("navigate", {
          detail: { path: `/books/${list.id}` },
        }),
      );
    }}
    className="book-card"
  >
    <div>
      <h3
        style={{
          margin: "0 0 0.3rem 0",
          fontSize: "1.1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        {list.name}
        {list.privacy === "private" && (
          <Lock size={14} color="var(--text-tertiary)" />
        )}
        {list.privacy === "public" && (
          <Globe size={14} color="var(--text-tertiary)" />
        )}
      </h3>
      {list.description && (
        <p
          style={{
            margin: 0,
            color: "var(--text-secondary)",
            fontSize: "0.9rem",
          }}
        >
          {list.description}
        </p>
      )}
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--text-tertiary)",
            display: "inline-block",
          }}
        >
          {list.item_count} places
        </span>
        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--text-tertiary)",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <Users size={12} /> {list.followers_count || 0}
        </span>
      </div>
      {!isOwned && list.owner_username && (
        <div
          style={{
            marginTop: "0.8rem",
            fontSize: "0.8rem",
            color: "var(--accent-color)",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {t("books.following_tag") || "Đang follow"} @{list.owner_username}
        </div>
      )}
    </div>
    <ChevronRight size={20} color="var(--text-tertiary)" />
  </a>
);

function BooksPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
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
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      const res = await fetch(`${API_URL}/api/lists`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/lists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newListName,
          description: newListDesc,
          privacy: newListPrivacy,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewListName("");
        setNewListDesc("");
        setNewListPrivacy("public");
        fetchLists();
      } else {
        const err = await res.json();
        alert(`Failed to create book: ${err.detail || "Unknown error"}`);
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
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <div className="login-icon-circle">
              <BookIcon size={40} />
            </div>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                marginBottom: "0.5rem",
              }}
            >
              {t("books.login_title")}
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
              {t("books.login_desc")}
            </p>

            <div className="login-prompt-card">
              <LogIn
                size={24}
                color="#d946ef"
                style={{ marginBottom: "0.5rem" }}
              />
              <div
                style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}
              >
                {t("books.login_prompt")}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div
        className="loading-screen"
        style={{ color: "white", padding: "2rem" }}
      >
        Loading books...
      </div>
    );

  return (
    <div className="books-page-container">
      {/* Header */}
      <div className="books-header">
        <h1 style={{ fontSize: "1.25rem", fontWeight: "700", margin: 0 }}>
          {t("books.title")}
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <Plus size={18} /> {t("books.new_book")}
        </button>
      </div>

      {/* List Content */}
      <div className="books-content">
        {lists.length === 0 ? (
          <div className="empty-state">
            <BookIcon size={48} className="empty-state-icon" />
            <p>{t("books.empty_title")}</p>
            <p style={{ fontSize: "0.9rem" }}>{t("books.empty_desc")}</p>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            {/* My Books Section */}
            {lists.some((l) => l.is_owner) && (
              <div>
                <h2
                  style={{
                    fontSize: "1rem",
                    color: "var(--text-secondary)",
                    marginBottom: "0.75rem",
                    fontWeight: "600",
                  }}
                >
                  {t("books.my_books") || "My Books"}
                </h2>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {lists
                    .filter((l) => l.is_owner)
                    .map((list) => (
                      <BookItem
                        key={list.id}
                        list={list}
                        t={t}
                        isOwned={true}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Followed Books Section */}
            {lists.some((l) => !l.is_owner) && (
              <div>
                <h2
                  style={{
                    fontSize: "1rem",
                    color: "var(--text-secondary)",
                    marginBottom: "0.75rem",
                    fontWeight: "600",
                  }}
                >
                  {t("books.followed_books") || "Followed Books"}
                </h2>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {lists
                    .filter((l) => !l.is_owner)
                    .map((list) => (
                      <BookItem
                        key={list.id}
                        list={list}
                        t={t}
                        isOwned={false}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="popup-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="popup-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "450px" }}
          >
            <div className="popup-header">
              <h2 className="popup-title">{t("books.create_title")}</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                }}
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateList}>
              <div className="popup-body">
                <div style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                    }}
                  >
                    {t("books.name_label")}
                  </label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder={t("books.name_placeholder")}
                    className="input-field"
                    required
                  />
                </div>
                <div style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                    }}
                  >
                    {t("books.privacy_label")}
                  </label>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    {/* Private option hidden as per requirement */}
                    <button
                      type="button"
                      onClick={() => setNewListPrivacy("public")}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        borderRadius: "8px",
                        border:
                          newListPrivacy === "public"
                            ? "2px solid var(--primary-color)"
                            : "1px solid var(--border-color)",
                        background:
                          newListPrivacy === "public"
                            ? "rgba(217, 70, 239, 0.1)"
                            : "var(--bg-secondary)",
                        color:
                          newListPrivacy === "public"
                            ? "var(--primary-color)"
                            : "var(--text-primary)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <Globe size={20} />
                      <span>{t("books.privacy_public")}</span>
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: "2rem" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                    }}
                  >
                    {t("books.desc_label")}
                  </label>
                  <textarea
                    value={newListDesc}
                    onChange={(e) => setNewListDesc(e.target.value)}
                    placeholder={t("books.desc_placeholder")}
                    className="input-field"
                    style={{ minHeight: "100px", resize: "vertical" }}
                  />
                </div>
              </div>
              <div className="popup-footer">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                  disabled={createLoading}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createLoading}
                >
                  {createLoading ? t("books.creating") : t("books.create_btn")}
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
