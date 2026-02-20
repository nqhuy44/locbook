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
        // Load the new CATEGORY_MAPPINGS array
        if (data.MARIN.CATEGORY_MAPPINGS) {
          const mappings = data.MARIN.CATEGORY_MAPPINGS.map((item) => ({
            id: Math.random().toString(36).substr(2, 9),
            vietnamese: item.vietnamese || "",
            english: item.english || "",
            keywords: Array.isArray(item.keywords)
              ? item.keywords.join(", ")
              : item.keywords || "",
          }));
          setMarinSynonyms(mappings);
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

      // Re-pack into the CATEGORY_MAPPINGS array format
      const newMappings = marinSynonyms
        .filter((item) => item.english.trim() || item.vietnamese.trim())
        .map((item) => ({
          vietnamese: item.vietnamese.trim(),
          english: item.english.trim(),
          keywords: item.keywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }));

      payload.MARIN = {
        ...marinConfig,
        CATEGORY_MAPPINGS: newMappings,
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
      {
        id: Math.random().toString(),
        vietnamese: "",
        english: "",
        keywords: "",
      },
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
                  minHeight: "600px",
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

        <div style={{ flex: "1.5" }}>
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
                Language & Category Mappings
              </h3>
              <button
                onClick={addSynonym}
                className="bmc-button"
                style={{ fontSize: "0.8rem", padding: "0.5rem 1rem" }}
              >
                <PlusCircle size={14} /> Add Row
              </button>
            </div>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-tertiary)",
                marginBottom: "1.5rem",
              }}
            >
              Map conversational keywords to specific database categories to
              help Marin understand user intent.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.8rem",
              }}
            >
              {/* Removed fixed table headers for mobile compatibility */}
              {marinSynonyms.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1rem",
                    alignItems: "flex-end",
                    background: "rgba(255,255,255,0.02)",
                    padding: "1rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ flex: "1 1 180px" }}>
                    <label
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-tertiary)",
                        marginBottom: "0.4rem",
                        display: "block",
                      }}
                    >
                      Vietnamese Label
                    </label>
                    <input
                      style={{
                        ...commonInputStyle,
                        width: "100%",
                        marginBottom: 0,
                      }}
                      value={item.vietnamese}
                      onChange={(e) =>
                        updateSynonym(item.id, "vietnamese", e.target.value)
                      }
                      placeholder="VD: Quán Nhậu"
                    />
                  </div>

                  <div style={{ flex: "1 1 130px" }}>
                    <label
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-tertiary)",
                        marginBottom: "0.4rem",
                        display: "block",
                      }}
                    >
                      English Class
                    </label>
                    <input
                      style={{
                        ...commonInputStyle,
                        width: "100%",
                        marginBottom: 0,
                      }}
                      value={item.english}
                      onChange={(e) =>
                        updateSynonym(item.id, "english", e.target.value)
                      }
                      placeholder="VD: bar"
                    />
                  </div>

                  <div style={{ flex: "2 1 250px" }}>
                    <label
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-tertiary)",
                        marginBottom: "0.4rem",
                        display: "block",
                      }}
                    >
                      Keywords / Slang (comma separated)
                    </label>
                    <input
                      style={{
                        ...commonInputStyle,
                        width: "100%",
                        marginBottom: 0,
                      }}
                      value={item.keywords}
                      onChange={(e) =>
                        updateSynonym(item.id, "keywords", e.target.value)
                      }
                      placeholder="quán nhậu, mồi bén, pub..."
                    />
                  </div>

                  <button
                    onClick={() => removeSynonym(item.id)}
                    style={{
                      background: "rgba(248, 113, 113, 0.1)",
                      border: "1px solid rgba(248, 113, 113, 0.2)",
                      borderRadius: "6px",
                      color: "#f87171",
                      padding: "0.7rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
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
                No mappings defined.
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: "6rem",
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
