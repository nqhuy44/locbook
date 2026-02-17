import { useState, useEffect } from "react";
import { PlusCircle, Trash2, Save, Sparkles } from "lucide-react";

const MarinPage = ({ API_URL, token }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [marinConfig, setMarinConfig] = useState({
    AVATAR_NAME: "",
    AVATAR_IMAGE: "",
    SYSTEM_INSTRUCTION: "",
  });
  const [marinSynonyms, setMarinSynonyms] = useState([]);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/config`);
      const data = await res.json();
      setConfig(data);
      if (data.MARIN) {
        setMarinConfig(data.MARIN);
        if (data.MARIN.CATEGORY_SYNONYMS) {
          const synonyms = Object.entries(data.MARIN.CATEGORY_SYNONYMS).map(
            ([key, vals]) => ({
              id: Math.random().toString(36).substr(2, 9),
              category: key,
              synonyms: Array.isArray(vals) ? vals.join(", ") : vals,
            }),
          );
          setMarinSynonyms(synonyms);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      let payload = { ...config };
      const newSynonyms = {};
      marinSynonyms.forEach((item) => {
        if (item.category.trim()) {
          newSynonyms[item.category.trim()] = item.synonyms
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      });

      payload.MARIN = {
        ...marinConfig,
        CATEGORY_SYNONYMS: newSynonyms,
      };

      const res = await fetch(`${API_URL}/api/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Marin Config saved!");
        const saved = await res.json();
        setConfig(saved);
        setMarinConfig(saved.MARIN);
      } else {
        alert("Failed to save config");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving config");
    }
  };

  // UI Helpers
  const commonInputStyle = {
    width: "100%",
    background: "var(--bg-primary)",
    marginBottom: "0.5rem",
    color: "var(--text-primary)",
    borderColor: "var(--border-color)",
    padding: "0.8rem",
    borderRadius: "8px",
    border: "1px solid var(--border-color)",
  };

  const addSynonym = () => {
    setMarinSynonyms([
      ...marinSynonyms,
      { id: Math.random().toString(), category: "New", synonyms: "" },
    ]);
  };

  const removeSynonym = (id) => {
    setMarinSynonyms(marinSynonyms.filter((m) => m.id !== id));
  };

  const updateSynonym = (id, field, value) => {
    setMarinSynonyms(
      marinSynonyms.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
  };

  if (loading)
    return (
      <div
        style={{
          textAlign: "center",
          marginTop: "2rem",
          color: "var(--text-secondary)",
        }}
      >
        Loading Marin AI...
      </div>
    );

  return (
    <div className="section-wrapper" style={{ paddingBottom: "5rem" }}>
      <h1
        className="section-title"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <Sparkles size={24} color="var(--accent-color)" /> Marin AI Personality
      </h1>

      <div
        style={{
          display: "flex",
          gap: "2rem",
          flexWrap: "wrap",
          marginTop: "2rem",
        }}
      >
        <div style={{ flex: "1", minWidth: "350px" }}>
          <div className="admin-card">
            <h3 style={{ marginTop: 0, color: "var(--accent-color)" }}>
              Identity
            </h3>
            <div style={{ marginBottom: "1rem" }}>
              <label
                className="detail-label"
                style={{
                  display: "block",
                  marginBottom: "0.4rem",
                  color: "var(--text-tertiary)",
                  fontWeight: 600,
                }}
              >
                Name
              </label>
              <input
                style={commonInputStyle}
                value={marinConfig.AVATAR_NAME || ""}
                onChange={(e) =>
                  setMarinConfig({
                    ...marinConfig,
                    AVATAR_NAME: e.target.value,
                  })
                }
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label
                className="detail-label"
                style={{
                  display: "block",
                  marginBottom: "0.4rem",
                  color: "var(--text-tertiary)",
                  fontWeight: 600,
                }}
              >
                Avatar URL
              </label>
              <input
                style={commonInputStyle}
                value={marinConfig.AVATAR_IMAGE || ""}
                onChange={(e) =>
                  setMarinConfig({
                    ...marinConfig,
                    AVATAR_IMAGE: e.target.value,
                  })
                }
              />
              {marinConfig.AVATAR_IMAGE && (
                <div
                  style={{
                    marginTop: "1rem",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={marinConfig.AVATAR_IMAGE}
                    alt="Preview"
                    style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "3px solid var(--accent-color-soft)",
                    }}
                  />
                </div>
              )}
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label
                className="detail-label"
                style={{
                  display: "block",
                  marginBottom: "0.4rem",
                  color: "var(--text-tertiary)",
                  fontWeight: 600,
                }}
              >
                System Instruction
              </label>
              <textarea
                style={{
                  ...commonInputStyle,
                  minHeight: "150px",
                  resize: "vertical",
                }}
                value={marinConfig.SYSTEM_INSTRUCTION || ""}
                onChange={(e) =>
                  setMarinConfig({
                    ...marinConfig,
                    SYSTEM_INSTRUCTION: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div style={{ flex: "1.5", minWidth: "400px" }}>
          <div className="admin-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3 style={{ margin: 0, color: "var(--accent-color)" }}>
                Category Synonyms
              </h3>
              <button
                onClick={addSynonym}
                className="bmc-button"
                style={{ fontSize: "0.8rem", padding: "0.5rem 1rem" }}
              >
                <PlusCircle size={14} /> Add Pattern
              </button>
            </div>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-tertiary)",
                marginBottom: "1.5rem",
              }}
            >
              Map user inputs (like "quẩy", "chill") to specific database
              categories.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.8rem",
              }}
            >
              {marinSynonyms.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: "1rem",
                    alignItems: "flex-start",
                  }}
                >
                  <input
                    style={{
                      ...commonInputStyle,
                      width: "150px",
                      marginBottom: 0,
                    }}
                    value={item.category}
                    onChange={(e) =>
                      updateSynonym(item.id, "category", e.target.value)
                    }
                    placeholder="Key"
                  />
                  <input
                    style={{ ...commonInputStyle, flex: 1, marginBottom: 0 }}
                    value={item.synonyms}
                    onChange={(e) =>
                      updateSynonym(item.id, "synonyms", e.target.value)
                    }
                    placeholder="Synonyms..."
                  />
                  <button
                    onClick={() => removeSynonym(item.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#f87171",
                      marginTop: "0.8rem",
                      cursor: "pointer",
                      opacity: 0.8,
                    }}
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            {marinSynonyms.length === 0 && (
              <div
                style={{ textAlign: "center", opacity: 0.5, padding: "2rem" }}
              >
                No synonyms defined.
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: "2rem",
          right: "2rem",
          zIndex: 100,
        }}
      >
        <button
          onClick={handleSave}
          className="bmc-button"
          style={{
            border: "none",
            cursor: "pointer",
            padding: "1rem 2rem",
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
          }}
        >
          <Save size={20} /> Save AI Config
        </button>
      </div>
    </div>
  );
};

export default MarinPage;
