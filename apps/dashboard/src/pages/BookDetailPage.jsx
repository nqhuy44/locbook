import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  ArrowLeft,
  Plus,
  MapPin,
  Trash2,
  ExternalLink,
  Utensils,
  Settings,
  Edit2,
  Globe,
  Lock,
  X,
  Book as BookIcon,
  LogIn,
  UserPlus,
  UserMinus,
} from "lucide-react";
import ShareButton from "../components/common/ShareButton";
import ConfirmModal from "../components/common/ConfirmModal";
import { useToast } from "../context/ToastContext";

const API_URL = import.meta.env.VITE_API_URL || "";

function BookDetailPage({ bookId, onBack, onPlaceClick, user }) {
  const { fetchWithAuth } = useAuth();
  const { t } = useLanguage();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [items, setItems] = useState([]);

  // Edit Form State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrivacy, setEditPrivacy] = useState("private");
  const [editLoading, setEditLoading] = useState(false);

  // Custom Confirm Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeletePlaceConfirm, setShowDeletePlaceConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Toast
  const { showToast } = useToast();

  const fetchBookDetails = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/lists/${bookId}`);

      if (res.ok) {
        const data = await res.json();
        setBook(data);
        setItems(data.items || []);
        // Init edit state
        setEditName(data.name);
        setEditDesc(data.description || "");
        setEditPrivacy(data.privacy || "private");
      } else {
        console.error("Failed to fetch book:", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch book details", err);
    } finally {
      setLoading(false);
    }
  };
  const handleFollowToggle = async () => {
    if (!user) return;
    const token = localStorage.getItem("auth_token");
    const method = book.is_following ? "DELETE" : "POST";

    try {
      const res = await fetchWithAuth(`${API_URL}/api/lists/${bookId}/follow`, {
        method: method,
      });

      if (res.ok) {
        showToast(
          book.is_following ? "Unfollowed book" : "Following book!",
          "success",
        );
        fetchBookDetails();
      } else {
        const err = await res.json();
        showToast(err.detail || "Action failed", "error");
      }
    } catch (err) {
      console.error("Failed to toggle follow", err);
      showToast("An error occurred", "error");
    }
  };

  useEffect(() => {
    if (user) {
      fetchBookDetails();
    } else {
      setLoading(false); // Stop loading if no user, so we show login prompt
    }
  }, [bookId, user]);

  // ... [fetchBookDetails and other handlers] ...

  // If not logged in, show login prompt (consistent with BooksPage)
  if (!user) {
    return (
      <div className="books-page-container">
        {/* Header to allow going back even if not logged in */}
        <div className="books-header with-border">
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-primary)",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <ArrowLeft size={24} />
            <span style={{ fontSize: "1rem", fontWeight: 500 }}>
              {t("books.back")}
            </span>
          </button>
        </div>

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
                color: "var(--text-primary)",
              }}
            >
              {t("books.login_title")}
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
              {t("books.login_desc")}
            </p>

            <div className="login-prompt-card">
              <LogIn size={24} color="#d946ef" />
              <div>{t("books.login_prompt")}</div>
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
        {t("common.loading")}
      </div>
    );

  const handleAddPlace = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/lists/${bookId}/add`, {
        method: "POST",
        body: JSON.stringify({
          url: addUrl,
          suggested_dishes: [],
        }),
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

  const handleDeleteItem = (placeId) => {
    setItemToDelete(placeId);
    setShowDeletePlaceConfirm(true);
  };

  const executeDeleteItem = async () => {
    if (!itemToDelete) return;
    const placeId = itemToDelete;
    try {
      const res = await fetchWithAuth(
        `${API_URL}/api/lists/${bookId}/items/${placeId}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        setItems(items.filter((i) => i.place.id !== placeId));
      }
    } catch (err) {
      console.error("Failed to delete item", err);
    } finally {
      setShowDeletePlaceConfirm(false);
      setItemToDelete(null);
    }
  };

  const handleDeleteBook = async () => {
    // Confirm handled by UI button (ConfirmModal now)
    try {
      const res = await fetchWithAuth(`${API_URL}/api/lists/${bookId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast(t("books.book_deleted"), "success");
        onBack(); // Go back to list
      } else {
        showToast(t("common.error"), "error");
      }
    } catch (err) {
      console.error("Failed to delete book", err);
      showToast("Error deleting book", "error");
    } finally {
      setShowDeleteConfirm(false); // Close modal
    }
  };

  const handleUpdateBook = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/lists/${bookId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          privacy: editPrivacy,
        }),
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

  if (loading)
    return (
      <div
        className="loading-screen"
        style={{ color: "white", padding: "2rem" }}
      >
        {t("common.loading")}
      </div>
    );
  if (!book)
    return (
      <div
        className="loading-screen"
        style={{ color: "white", padding: "2rem" }}
      >
        {t("books.book_not_found")}
      </div>
    );

  return (
    <div className="books-page-container">
      {/* Header */}
      <div className="books-header with-border">
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-primary)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <ArrowLeft size={24} />
        </button>
        <div style={{ flex: 1, paddingLeft: "1rem", minWidth: 0 }}>
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: "700",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {book.name}
            {book.privacy === "private" && (
              <Lock size={16} color="var(--text-tertiary)" />
            )}
            {book.privacy === "public" && (
              <Globe size={16} color="var(--text-tertiary)" />
            )}
          </h1>
          {book.description && (
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {book.description}
            </p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ShareButton
            title={`Check out "${book.name}" on Spotary`}
            url={window.location.href}
            className="btn-secondary"
            iconOnly={true}
            style={{
              padding: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
            }}
          />
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* Delete button moved to Edit Modal */}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {book && !book.is_owner && (
                <button
                  onClick={handleFollowToggle}
                  className={
                    book.is_following ? "btn-secondary" : "btn-primary"
                  }
                  style={{
                    padding: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                  }}
                  title={book.is_following ? "Unfollow" : "Follow"}
                >
                  {book.is_following ? (
                    <UserMinus size={18} />
                  ) : (
                    <UserPlus size={18} />
                  )}
                </button>
              )}
              {book && book.is_owner && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="btn-secondary"
                  style={{
                    padding: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                  }}
                  title={t("books.edit_title")}
                >
                  <Edit2 size={18} />
                </button>
              )}
              {book && book.is_owner && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="btn-primary"
                  style={{
                    padding: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    width: "36px",
                    height: "36px",
                  }}
                  title={t("books.add_place_title")}
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="books-detail-content">
        {items.length === 0 ? (
          <div className="empty-state">
            <MapPin size={48} className="empty-state-icon" />
            <p>{t("books.no_places")}</p>
            {book.is_owner && (
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-secondary"
                style={{ marginTop: "1rem" }}
              >
                {t("books.add_from_maps")}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((item) => {
              const place = item.place;
              const imageUrl = place.images?.[0] || place.local_image_path;
              // Fix image url logic - dup from PlaceCard but simplified
              let finalImg = imageUrl;
              if (imageUrl && !imageUrl.startsWith("http")) {
                if (imageUrl.startsWith("/"))
                  finalImg = `${API_URL}${imageUrl}`;
                else finalImg = `${API_URL}/images/${imageUrl}`;
              }

              return (
                <div key={place.id} className="place-item-card">
                  <div
                    onClick={() => onPlaceClick(place)}
                    className="place-item-content"
                  >
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
                      <h3
                        style={{
                          margin: "0 0 0.3rem 0",
                          fontSize: "1.1rem",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {place.name}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.9rem",
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {place.address}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          marginTop: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        {place.vibes?.slice(0, 2).map((v) => (
                          <span
                            key={v}
                            className="tag-soft"
                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Action Footer for Item */}
                  <div className="place-item-actions">
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                      }}
                    >
                      {item.suggested_dishes?.length > 0 && (
                        <span
                          style={{
                            fontSize: "0.85rem",
                            color: "#ffd700",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Utensils size={14} /> {item.suggested_dishes.length}{" "}
                          {t("books.suggestions")}
                        </span>
                      )}
                    </div>
                    {book.is_owner && (
                      <button
                        onClick={() => handleDeleteItem(place.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          padding: "4px",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Place Modal */}
      {showAddModal && (
        <div className="popup-overlay" onClick={() => setShowAddModal(false)}>
          <div
            className="popup-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "450px" }}
          >
            <div className="popup-header">
              <h2 className="popup-title">{t("books.add_place_title")}</h2>
              <button
                onClick={() => setShowAddModal(false)}
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
            <form onSubmit={handleAddPlace}>
              <div className="popup-body">
                <div style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                    }}
                  >
                    {t("books.add_place_url_label")}
                  </label>
                  <input
                    type="url"
                    value={addUrl}
                    onChange={(e) => setAddUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                    className="input-field"
                    required
                  />
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-tertiary)",
                      marginTop: "0.5rem",
                    }}
                  >
                    {t("books.add_place_help")}
                  </p>
                </div>
              </div>
              <div className="popup-footer">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                  disabled={addLoading}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={addLoading}
                >
                  {addLoading ? t("books.analyzing") : t("books.add_btn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="popup-overlay" onClick={() => setShowEditModal(false)}>
          <div
            className="popup-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "450px" }}
          >
            <div className="popup-header">
              <h2 className="popup-title">{t("books.edit_title")}</h2>
              <button
                onClick={() => setShowEditModal(false)}
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
            <form onSubmit={handleUpdateBook}>
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
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                    <button
                      type="button"
                      onClick={() => setEditPrivacy("private")}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        borderRadius: "8px",
                        border:
                          editPrivacy === "private"
                            ? "2px solid var(--primary-color)"
                            : "1px solid var(--border-color)",
                        background:
                          editPrivacy === "private"
                            ? "rgba(217, 70, 239, 0.1)"
                            : "var(--bg-secondary)",
                        color:
                          editPrivacy === "private"
                            ? "var(--primary-color)"
                            : "var(--text-primary)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <Lock size={20} />
                      <span>{t("books.privacy_private")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPrivacy("public")}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        borderRadius: "8px",
                        border:
                          editPrivacy === "public"
                            ? "2px solid var(--primary-color)"
                            : "1px solid var(--border-color)",
                        background:
                          editPrivacy === "public"
                            ? "rgba(217, 70, 239, 0.1)"
                            : "var(--bg-secondary)",
                        color:
                          editPrivacy === "public"
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
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder={t("books.desc_placeholder")}
                    className="input-field"
                    style={{ minHeight: "100px", resize: "vertical" }}
                  />
                </div>
                <div
                  style={{
                    marginTop: "2rem",
                    paddingTop: "1.5rem",
                    borderTop: "1px solid var(--border-color)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-secondary"
                    style={{
                      width: "100%",
                      color: "#ef4444",
                      borderColor: "rgba(239, 68, 68, 0.2)",
                      background: "rgba(239, 68, 68, 0.05)",
                      justifyContent: "center",
                      height: "48px",
                    }}
                  >
                    <Trash2 size={18} style={{ marginRight: "8px" }} />
                    {t("books.delete_book")}
                  </button>
                </div>
              </div>
              <div
                className="popup-footer"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  paddingBottom: "1.5rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary"
                  disabled={editLoading}
                  style={{ justifyContent: "center", height: "48px" }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={editLoading}
                  style={{
                    justifyContent: "center",
                    height: "48px",
                    width: "100%",
                  }}
                >
                  {editLoading
                    ? t("profile.saving")
                    : t("profile.save_changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={t("books.delete_book")}
        message={t("books.delete_book_confirm")}
        onConfirm={handleDeleteBook}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="danger"
      />

      <ConfirmModal
        isOpen={showDeletePlaceConfirm}
        title={t("books.remove_place_title")}
        message={t("books.remove_place_msg")}
        onConfirm={executeDeleteItem}
        onCancel={() => setShowDeletePlaceConfirm(false)}
        confirmText={t("books.remove_btn")}
        cancelText={t("common.cancel")}
        type="danger"
      />
    </div>
  );
}

export default BookDetailPage;
