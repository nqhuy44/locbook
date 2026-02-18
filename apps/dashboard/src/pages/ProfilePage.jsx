import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  ArrowLeft,
  Save,
  Sparkles,
  Check,
  RefreshCw,
  Plus,
  LogIn,
} from "lucide-react";
import LoginButton from "../components/auth/LoginButton";
import ShareButton from "../components/common/ShareButton";

const DICEBEAR_STYLES = [
  "thumbs",
  "adventurer",
  "avataaars",
  "bottts",
  "fun-emoji",
  "lorelei",
  "notionists",
  "open-peeps",
  "pixel-art",
  "shapes",
];

function getDiceBearUrl(style, seed) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed || "default")}`;
}

const AVAILABLE_VIBES = [
  "Chill",
  "Cozy",
  "Quiet",
  "Lively",
  "Romantic",
  "Creative",
  "Sophisticated",
  "Friendly",
  "Adventurous",
  "Energetic",
  "Artsy",
  "Vintage",
  "Modern",
  "Hipster",
  "Luxurious",
  "Laid-back",
  "Vibrant",
  "Intimate",
  "Trendy",
  "Rustic",
].sort();

const PERSONALITY_TAGS = [
  "Introvert",
  "Extrovert",
  "Foodie",
  "Night Owl",
  "Early Bird",
  "Bookworm",
  "Music Lover",
  "Photo Addict",
  "Coffee Addict",
  "Wine Enthusiast",
  "Explorer",
  "Homebody",
].sort();

const API_URL = import.meta.env.VITE_API_URL || "";

export default function ProfilePage({ onBack, viewingProfile }) {
  const { user, updateProfile, loginWithGoogle } = useAuth();
  const { t } = useLanguage();

  // State for viewing other profile
  const [publicProfile, setPublicProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(!!viewingProfile); // Load if viewingProfile is set

  // If viewingProfile is set, use that. Else use current user.
  const isSelf =
    !viewingProfile || (user && user.username === viewingProfile.username);
  const displayedUser = isSelf ? user : publicProfile;

  useEffect(() => {
    if (viewingProfile && viewingProfile.username) {
      setProfileLoading(true);
      fetch(`${API_URL}/api/users/${viewingProfile.username}`)
        .then((res) => {
          if (!res.ok) throw new Error("User not found");
          return res.json();
        })
        .then((data) => {
          // Map API response to expected UI structure
          // API returns: { id, username, display_name, avatar_url, bio, public_lists: [] }
          // UI expects: { display_name, username, bio, preferences: { vibes, personality ... } }
          // Public endpoint doesn't return preferences unless we update it to do so.
          // Let's assume we update backend or handle missing prefs.
          setPublicProfile({
            ...data,
            preferences: {
              // Mock or default since API might not return all prefs yet
              vibes: [],
              personality: [],
              avatar_style: "thumbs",
              avatar_seed: data.username,
            },
            // If API returns preferences, use them.
          });
        })
        .catch((err) => console.error("Failed to load profile", err))
        .finally(() => setProfileLoading(false));
    } else {
      setPublicProfile(null);
    }
  }, [viewingProfile]);

  // Hooks must be at top level
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    display_name: user?.display_name || "",
    username: user?.username || "",
    bio: user?.bio || "",
  });
  const [selectedVibes, setSelectedVibes] = useState(
    user?.preferences?.vibes || [],
  );
  const [selectedPersonality, setSelectedPersonality] = useState(
    user?.preferences?.personality || [],
  );
  const [avatarStyle, setAvatarStyle] = useState(
    user?.preferences?.avatar_style || "thumbs",
  );
  const [avatarSeed, setAvatarSeed] = useState(
    user?.preferences?.avatar_seed ||
      user?.display_name ||
      user?.email ||
      "default",
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Custom Tag State
  const [customTag, setCustomTag] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);

  const [customPersonality, setCustomPersonality] = useState("");
  const [isAddingPersonality, setIsAddingPersonality] = useState(false);

  // Sync state when entering edit mode or user updates
  React.useEffect(() => {
    if (!isEditing && user) {
      setFormData({
        display_name: user.display_name || "",
        username: user.username || "",
        bio: user.bio || "",
      });
      setSelectedVibes(user.preferences?.vibes || []);
      setSelectedPersonality(user.preferences?.personality || []);
      setAvatarStyle(user.preferences?.avatar_style || "thumbs");
      setAvatarSeed(
        user.preferences?.avatar_seed ||
          user.display_name ||
          user.email ||
          "default",
      );
    }
  }, [isEditing, user]);

  const avatarUrl = useMemo(
    () => getDiceBearUrl(avatarStyle, avatarSeed),
    [avatarStyle, avatarSeed],
  );
  const userAvatarUrl =
    displayedUser?.avatar_url ||
    getDiceBearUrl(
      displayedUser?.preferences?.avatar_style || "thumbs",
      displayedUser?.preferences?.avatar_seed ||
        displayedUser?.display_name ||
        "default",
    );

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleVibe = (vibe) => {
    setSelectedVibes((prev) =>
      prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe],
    );
  };

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !selectedVibes.includes(tag)) {
      setSelectedVibes((prev) => [...prev, tag]);
      setCustomTag("");
      setIsAddingTag(false);
    }
  };

  const togglePersonality = (tag) => {
    setSelectedPersonality((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const addCustomPersonality = () => {
    const tag = customPersonality.trim();
    if (tag && !selectedPersonality.includes(tag)) {
      setSelectedPersonality((prev) => [...prev, tag]);
      setCustomPersonality("");
      setIsAddingPersonality(false);
    }
  };

  const randomizeSeed = () => {
    setAvatarSeed(Math.random().toString(36).substring(2, 10));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });
    try {
      // Generate final avatar URL
      const finalAvatarUrl = getDiceBearUrl(avatarStyle, avatarSeed);
      console.log("Submitting Profile Update:", {
        finalAvatarUrl,
        avatarStyle,
        avatarSeed,
      });

      await updateProfile({
        display_name: formData.display_name,
        username: formData.username,
        bio: formData.bio,
        avatar_url: finalAvatarUrl, // Send top-level avatar_url
        preferences: {
          vibes: selectedVibes,
          personality: selectedPersonality,
          avatar_style: avatarStyle,
          avatar_seed: avatarSeed,
        },
      });
      setMessage({ text: "Đã lưu thành công!", type: "success" });
      setTimeout(() => {
        setMessage({ text: "", type: "" });
        setIsEditing(false); // Exit edit mode
      }, 1000);
    } catch (error) {
      console.error("Update profile failed:", error);
      const errorMsg =
        error.response?.data?.detail || "Có lỗi xảy ra, vui lòng thử lại.";
      setMessage({ text: t("common.error_occurred"), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const { logout } = useAuth(); // Destructure logout

  if (profileLoading)
    return (
      <div
        className="loading-screen"
        style={{ color: "white", padding: "2rem" }}
      >
        Loading profile...
      </div>
    );

  if (!displayedUser) {
    // If trying to view self but not logged in -> Show Login
    if (isSelf) {
      return (
        <div
          className="profile-wrapper"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <div
              style={{
                width: "80px",
                height: "80px",
                background: "var(--accent-gradient)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem auto",
                color: "white",
                boxShadow: "0 10px 25px rgba(217, 70, 239, 0.4)",
              }}
            >
              <LogIn size={40} />
            </div>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                marginBottom: "0.5rem",
              }}
            >
              {t("profile.login_title")}
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
              {t("profile.login_desc")}
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <LoginButton />
            </div>
          </div>
        </div>
      );
    }
    // If trying to view other but not found
    return (
      <div
        className="loading-screen"
        style={{ color: "white", padding: "2rem" }}
      >
        User not found
      </div>
    );
  }

  // Determine if we can edit
  const canEdit = isSelf && !isEditing; // Show edit button only if self and not currently editing
  const modeEdit = isSelf && isEditing; // Actually in edit mode

  return (
    <div className="profile-wrapper">
      <div className="profile-layout">
        {/* Header Section: Avatar + Name (Visible in both modes, but editable only in edit mode) */}
        <div
          className="profile-header"
          key={modeEdit ? "edit-header" : "view-header"}
        >
          <div
            className="profile-actions-top"
            style={{ position: "absolute", top: "1rem", right: "1rem" }}
          >
            <ShareButton
              title={`@${displayedUser.username} on Spotary`}
              url={window.location.href}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "white",
                borderRadius: "50%",
                padding: "8px",
                cursor: "pointer",
              }}
            />
          </div>

          <div className="avatar-section">
            <div className="avatar-container">
              <div className="avatar-main">
                <img src={modeEdit ? avatarUrl : userAvatarUrl} alt="Avatar" />
              </div>
            </div>
            {modeEdit && (
              <button
                className="avatar-randomize"
                onClick={randomizeSeed}
                title="Randomize Avatar"
              >
                <RefreshCw size={18} />
              </button>
            )}
          </div>

          <div className="user-info-header">
            <div className="display-name">
              {modeEdit ? (
                <span>{formData.display_name || "Chưa đặt tên"}</span>
              ) : (
                <span>{displayedUser.display_name || "Chưa đặt tên"}</span>
              )}
            </div>
            <div className="username">
              <span>
                @
                {modeEdit
                  ? formData.username || "username"
                  : displayedUser.username || "username"}
              </span>
            </div>

            {isEditing && (
              <div className="avatar-styles-section">
                <div
                  className="form-label"
                  style={{ marginBottom: "4px", fontSize: "0.8rem" }}
                >
                  {t("profile.choose_avatar_style")}
                </div>
                <div className="avatar-styles">
                  {DICEBEAR_STYLES.map((style) => (
                    <button
                      key={style}
                      className={`style-btn ${avatarStyle === style ? "active" : ""}`}
                      onClick={() => setAvatarStyle(style)}
                      title={style}
                    >
                      <img
                        src={getDiceBearUrl(style, avatarSeed)}
                        alt={style}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {!modeEdit ? (
          /* ================= READ ONLY MODE ================= */
          <div className="content-area" key="view-content">
            <div className="section-card">
              <div className="section-title">
                <Sparkles size={18} /> {t("profile.personal_info")}
              </div>
              {displayedUser.bio ? (
                <p style={{ lineHeight: 1.6, color: "var(--text-secondary)" }}>
                  <span>{displayedUser.bio}</span>
                </p>
              ) : (
                <p
                  style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}
                >
                  <span>{t("profile.no_bio")}</span>
                </p>
              )}
            </div>

            <div className="section-card">
              <div className="section-title">
                <Sparkles size={18} color="#d946ef" />{" "}
                {t("profile.vibes_title")}
              </div>
              <div className="chip-grid">
                {displayedUser.preferences?.vibes?.length > 0 ? (
                  displayedUser.preferences.vibes.map((vibe) => (
                    <div
                      key={vibe}
                      className="chip active"
                      style={{ cursor: "default" }}
                    >
                      <span>{vibe}</span>
                    </div>
                  ))
                ) : (
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {t("profile.no_vibes")}
                  </span>
                )}
              </div>
            </div>

            <div className="section-card">
              <div className="section-title">
                <span>🎭</span> {t("profile.personality_title")}
              </div>
              <div className="chip-grid">
                {displayedUser.preferences?.personality?.length > 0 ? (
                  displayedUser.preferences.personality.map((tag) => (
                    <div
                      key={tag}
                      className="chip active"
                      style={{ cursor: "default" }}
                    >
                      <span>{tag}</span>
                    </div>
                  ))
                ) : (
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {t("profile.no_personality")}
                  </span>
                )}
              </div>
            </div>

            {/* Public Lists Section */}
            {displayedUser.public_lists &&
              displayedUser.public_lists.length > 0 && (
                <div className="section-card">
                  <div className="section-title">
                    <span>📚</span> {t("profile.public_lists")}
                  </div>
                  <div
                    className="chip-grid"
                    style={{
                      flexDirection: "column",
                      gap: "0.5rem",
                      alignItems: "stretch",
                    }}
                  >
                    {displayedUser.public_lists.map((list) => (
                      <div
                        key={list.id}
                        className="list-item"
                        onClick={() =>
                          window.history.pushState({}, "", `/book/${list.id}`)
                        }
                        style={{
                          padding: "0.75rem",
                          background: "var(--bg-secondary)",
                          borderRadius: "8px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: "bold" }}>
                          <span>{list.name}</span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <span>{list.item_count} places</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {canEdit && (
              <div className="action-btn-group">
                <button
                  className="edit-mode-btn"
                  onClick={() => setIsEditing(true)}
                >
                  <Sparkles size={18} />{" "}
                  <span>{t("profile.edit_profile")}</span>
                </button>

                <button className="logout-btn" onClick={logout}>
                  <LogIn size={18} style={{ transform: "rotate(180deg)" }} />{" "}
                  <span>{t("nav.sign_out")}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ================= EDIT MODE ================= */
          <div className="content-area" key="edit-content">
            <form onSubmit={handleSubmit}>
              <div className="section-card">
                <div className="section-title">
                  <Sparkles size={18} />{" "}
                  <span>{t("profile.personal_info")}</span>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>{t("profile.username_label")}</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="username"
                    className="form-input"
                    style={{ fontFamily: "monospace" }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>{t("profile.display_name_label")}</span>
                  </label>
                  <input
                    type="text"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleChange}
                    placeholder="Marin Explorer"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>{t("profile.bio_label")}</span>
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    placeholder={t("profile.bio_placeholder")}
                    className="form-input form-textarea"
                  />
                </div>
              </div>

              {/* Vibes */}
              <div className="section-card">
                <div className="section-title">
                  <Sparkles size={18} color="#d946ef" />{" "}
                  <span>{t("profile.vibes_title")}</span>
                </div>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-tertiary)",
                    marginBottom: "1rem",
                  }}
                >
                  <span>{t("profile.vibes_desc")}</span>
                </p>
                <div
                  className="vibe-tags"
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
                >
                  {[...AVAILABLE_VIBES]
                    .sort((a, b) => {
                      const aSelected = selectedVibes.includes(a);
                      const bSelected = selectedVibes.includes(b);
                      if (aSelected === bSelected) return a.localeCompare(b);
                      return aSelected ? -1 : 1;
                    })
                    .map((vibe) => (
                      <button
                        key={vibe}
                        type="button"
                        onClick={() => toggleVibe(vibe)}
                        style={{
                          padding: "0.5rem 1rem",
                          borderRadius: "20px",
                          border: selectedVibes.includes(vibe)
                            ? "none"
                            : "1px solid var(--border-color)",
                          background: selectedVibes.includes(vibe)
                            ? "var(--accent-gradient)"
                            : "var(--card-bg)",
                          color: selectedVibes.includes(vibe)
                            ? "white"
                            : "var(--text-secondary)",
                          fontSize: "0.9rem",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          boxShadow: selectedVibes.includes(vibe)
                            ? "0 4px 12px rgba(217, 70, 239, 0.3)"
                            : "none",
                        }}
                      >
                        <span>{vibe}</span>
                      </button>
                    ))}
                </div>{" "}
                {isAddingTag ? (
                  <input
                    autoFocus
                    className="add-tag-input"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addCustomTag())
                    }
                    onBlur={() => {
                      if (!customTag) setIsAddingTag(false);
                      else addCustomTag();
                    }}
                    placeholder="Tag..."
                  />
                ) : (
                  <button
                    type="button"
                    className="add-tag-btn"
                    onClick={() => setIsAddingTag(true)}
                  >
                    <Plus size={14} /> <span>{t("profile.add_tag")}</span>
                  </button>
                )}
              </div>

              {/* Personality */}
              <div className="section-card">
                <div className="section-title">
                  <span>🎭</span> <span>{t("profile.personality_title")}</span>
                </div>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-tertiary)",
                    marginBottom: "1rem",
                  }}
                >
                  <span>{t("profile.personality_desc")}</span>
                </p>
                <div className="chip-grid">
                  {[...PERSONALITY_TAGS]
                    .sort((a, b) => {
                      const aSelected = selectedPersonality.includes(a);
                      const bSelected = selectedPersonality.includes(b);
                      if (aSelected === bSelected) return a.localeCompare(b);
                      return aSelected ? -1 : 1;
                    })
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`chip ${selectedPersonality.includes(tag) ? "active" : ""}`}
                        onClick={() => togglePersonality(tag)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "0.4rem 0.8rem",
                          borderRadius: "20px",
                          border: selectedPersonality.includes(tag)
                            ? "none"
                            : "1px solid var(--border-color)",
                          background: selectedPersonality.includes(tag)
                            ? "var(--accent-gradient)"
                            : "var(--card-bg)",
                          color: selectedPersonality.includes(tag)
                            ? "white"
                            : "var(--text-secondary)",
                          fontSize: "0.9rem",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {selectedPersonality.includes(tag) && (
                          <Check size={12} />
                        )}
                        <span>{tag}</span>
                      </button>
                    ))}
                  {/* Show selected custom tags that are NOT in PERSONALITY_TAGS */}
                  {selectedPersonality
                    .filter((tag) => !PERSONALITY_TAGS.includes(tag))
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="chip active"
                        onClick={() => togglePersonality(tag)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "0.4rem 0.8rem",
                          borderRadius: "20px",
                          border: "none",
                          background: "var(--accent-gradient)",
                          color: "white",
                          fontSize: "0.9rem",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        <Check size={12} />
                        <span>{tag}</span>
                      </button>
                    ))}
                </div>
                {isAddingPersonality ? (
                  <input
                    autoFocus
                    className="add-tag-input"
                    value={customPersonality}
                    onChange={(e) => setCustomPersonality(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), addCustomPersonality())
                    }
                    onBlur={() => {
                      if (!customPersonality) setIsAddingPersonality(false);
                      else addCustomPersonality();
                    }}
                    placeholder="Trait..."
                    style={{ marginTop: "0.5rem" }}
                  />
                ) : (
                  <button
                    type="button"
                    className="add-tag-btn"
                    onClick={() => setIsAddingPersonality(true)}
                    style={{ marginTop: "0.5rem" }}
                  >
                    <Plus size={14} /> <span>{t("profile.add_tag")}</span>
                  </button>
                )}
              </div>

              {/* Save/Cancel Bar */}
              <div className="save-bar">
                <div>
                  {message.text && (
                    <div className={`msg ${message.type}`}>
                      <span>{message.text}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                >
                  <span>{t("common.cancel")}</span>
                </button>

                <button type="submit" className="save-btn" disabled={loading}>
                  <Save size={18} />
                  <span>
                    {loading ? t("profile.saving") : t("profile.save_changes")}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
