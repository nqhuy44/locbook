import { useState, useEffect } from "react";
import { PlusCircle, Trash2, Save, FileText } from "lucide-react";

const ConfigPage = ({ API_URL, token }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [categoryMappings, setCategoryMappings] = useState([]);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/config`);
      const data = await res.json();
      setConfig(data);
      setJsonInput(JSON.stringify(data, null, 2));

      if (data.CATEGORY_KEYWORDS) {
        const mappings = Object.entries(data.CATEGORY_KEYWORDS).map(
          ([key, vals]) => ({
            id: Math.random().toString(36).substr(2, 9),
            name: key,
            keywords: Array.isArray(vals) ? vals.join(", ") : vals,
          }),
        );
        setCategoryMappings(mappings);
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
      if (jsonMode) {
        try {
          payload = JSON.parse(jsonInput);
        } catch (e) {
          alert("Invalid JSON");
          return;
        }
      } else {
        const newKeywords = {};
        categoryMappings.forEach((item) => {
          if (item.name.trim()) {
            newKeywords[item.name.trim()] = item.keywords
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
        });
        payload.CATEGORY_KEYWORDS = newKeywords;

        // Ensure HOME_CATEGORIES is strictly from current config state to avoid any loss
        if (config.HOME_CATEGORIES) {
          payload.HOME_CATEGORIES = config.HOME_CATEGORIES;
        }
      }

      const res = await fetch(`${API_URL}/api/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Configuration saved!");
        const saved = await res.json();
        setConfig(saved);
        setJsonInput(JSON.stringify(saved, null, 2));
        if (saved.CATEGORY_KEYWORDS) {
          const mappings = Object.entries(saved.CATEGORY_KEYWORDS).map(
            ([key, vals]) => ({
              id: Math.random().toString(36).substr(2, 9),
              name: key,
              keywords: Array.isArray(vals) ? vals.join(", ") : vals,
            }),
          );
          setCategoryMappings(mappings);
        }
      } else {
        alert("Failed to save config");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving config");
    }
  };

  const addCategoryMapping = () => {
    setCategoryMappings([
      ...categoryMappings,
      { id: Math.random().toString(), name: "New Category", keywords: "" },
    ]);
  };

  const removeCategoryMapping = (id) => {
    if (!window.confirm("Remove this category mapping?")) return;
    setCategoryMappings(categoryMappings.filter((m) => m.id !== id));
  };

  const updateCategoryMapping = (id, field, value) => {
    // If we're updating the name, we should also update HOME_CATEGORIES if the old name was present
    if (field === "name") {
      const oldMapping = categoryMappings.find((m) => m.id === id);
      const oldName = oldMapping?.name;

      if (oldName && config.HOME_CATEGORIES?.includes(oldName)) {
        setConfig((prev) => ({
          ...prev,
          HOME_CATEGORIES: prev.HOME_CATEGORIES.map((c) =>
            c === oldName ? value : c,
          ),
        }));
      }
    }

    setCategoryMappings(
      categoryMappings.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
  };

  // Helper for input styles
  const commonInputStyle = {
    background: "var(--bg-primary)",
    marginBottom: "0.5rem",
    color: "var(--text-primary)",
    borderColor: "var(--border-color)",
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
        Loading Configuration...
      </div>
    );
  if (!config)
    return (
      <div
        style={{
          textAlign: "center",
          marginTop: "2rem",
          color: "var(--text-secondary)",
        }}
      >
        Error loading config
      </div>
    );

  return (
    <div className="section-wrapper" style={{ paddingBottom: "5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 className="section-title" style={{ marginBottom: "0.2rem" }}>
            App Configuration
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--text-tertiary)",
              fontSize: "0.9rem",
            }}
          >
            Manage system settings and feature flags
          </p>
        </div>
        <button
          className="filter-btn"
          onClick={() => setJsonMode(!jsonMode)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.2rem",
            background: jsonMode
              ? "var(--bg-secondary)"
              : "var(--accent-gradient)",
            color: jsonMode ? "var(--text-primary)" : "white",
            border: jsonMode ? "1px solid var(--border-color)" : "none",
            fontWeight: 600,
          }}
        >
          {jsonMode ? <FileText size={18} /> : <FileText size={18} />}
          {jsonMode ? "Switch to Form UI" : "Switch to JSON Mode"}
        </button>
      </div>

      {jsonMode ? (
        <div className="admin-card">
          <textarea
            className="search-input"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            style={{
              height: "500px",
              fontFamily: "monospace",
              color: "var(--text-primary)",
              background: "var(--bg-primary)",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "2rem",
            alignItems: "start",
          }}
        >
          {/* LEFT COLUMN */}
          <div
            style={{
              flex: "1 1 400px",
              display: "flex",
              flexDirection: "column",
              gap: "2rem",
              minWidth: "300px",
            }}
          >
            {/* Feature Flags */}
            <div className="admin-card">
              <h3
                style={{
                  marginTop: 0,
                  color: "var(--accent-color)",
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                Feature Flags
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.8rem",
                }}
              >
                {Object.entries(config.FEATURES || {}).map(([key, val]) => (
                  <label
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      background: "var(--bg-primary)",
                      padding: "0.8rem",
                      borderRadius: "12px",
                      border: val
                        ? "1px solid var(--accent-color)"
                        : "1px solid transparent",
                      transition: "all 0.2s",
                      boxShadow: "sm",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        color: val
                          ? "var(--text-primary)"
                          : "var(--text-tertiary)",
                      }}
                    >
                      {key.replace("ENABLE_", "")}
                    </span>
                    <div
                      style={{
                        position: "relative",
                        width: "40px",
                        height: "22px",
                        background: val ? "var(--accent-color)" : "#e5e7eb",
                        borderRadius: "99px",
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: val ? "20px" : "2px",
                          width: "18px",
                          height: "18px",
                          background: "white",
                          borderRadius: "50%",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        }}
                      />
                    </div>
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          FEATURES: {
                            ...config.FEATURES,
                            [key]: e.target.checked,
                          },
                        })
                      }
                      style={{ display: "none" }}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="admin-card">
              <h3
                style={{
                  marginTop: 0,
                  color: "var(--accent-color)",
                  marginBottom: "1rem",
                }}
              >
                External Links
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.2rem",
                }}
              >
                {Object.entries(config.LINKS || {}).map(([key, val]) => (
                  <div key={key}>
                    <label
                      className="detail-label"
                      style={{
                        display: "block",
                        marginBottom: "0.3rem",
                        color: "var(--text-secondary)",
                        fontWeight: 600,
                      }}
                    >
                      {key.replace(/_/g, " ")}
                    </label>
                    <input
                      className="search-input"
                      style={commonInputStyle}
                      value={val}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          LINKS: { ...config.LINKS, [key]: e.target.value },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div
            style={{
              flex: "1.5 1 500px",
              display: "flex",
              flexDirection: "column",
              gap: "2rem",
              minWidth: "300px",
            }}
          >
            {/* Home Categories */}
            <div className="admin-card">
              <h3 style={{ marginTop: 0, color: "var(--accent-color)" }}>
                Home Page Display Order
              </h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-tertiary)",
                  marginTop: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                Which categories from above should appear on the homepage?
              </p>
              {/* Drag and Drop UI */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  background: "var(--bg-primary)",
                  padding: "1rem",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                }}
              >
                {/* 1. Render Enabled Categories (Draggable) */}
                {(config.HOME_CATEGORIES || []).map((cat, index) => (
                  <div
                    key={cat}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", index);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault(); // Necessary for drop
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIndex = parseInt(
                        e.dataTransfer.getData("text/plain"),
                      );
                      const toIndex = index;
                      if (fromIndex === toIndex) return;

                      const newOrder = [...(config.HOME_CATEGORIES || [])];
                      const [moved] = newOrder.splice(fromIndex, 1);
                      newOrder.splice(toIndex, 0, moved);

                      setConfig({ ...config, HOME_CATEGORIES: newOrder });
                    }}
                    onClick={() => {
                      // Click to Disable (Remove)
                      const newOrder = config.HOME_CATEGORIES.filter(
                        (c) => c !== cat,
                      );
                      setConfig({ ...config, HOME_CATEGORIES: newOrder });
                    }}
                    style={{
                      padding: "0.4rem 0.8rem",
                      background: "rgba(52, 211, 153, 0.15)", // Green tint
                      border: "1px solid rgba(52, 211, 153, 0.3)",
                      color: "var(--text-primary)",
                      borderRadius: "20px",
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      cursor: "grab",
                      userSelect: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      transition: "all 0.2s",
                    }}
                    title="Drag to reorder, Click to remove"
                  >
                    <span style={{ cursor: "pointer" }}>{cat}</span>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "var(--text-tertiary)",
                        cursor: "pointer",
                        display: "flex",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* 2. Render Disabled Categories (Click to Enable) */}
                {categoryMappings
                  .map((m) => m.name)
                  .filter((name) => !config.HOME_CATEGORIES?.includes(name))
                  .map((cat) => (
                    <div
                      key={cat}
                      onClick={() => {
                        // Click to Enable (Add to end)
                        const newOrder = [
                          ...(config.HOME_CATEGORIES || []),
                          cat,
                        ];
                        setConfig({ ...config, HOME_CATEGORIES: newOrder });
                      }}
                      style={{
                        padding: "0.4rem 0.8rem",
                        background: "var(--bg-secondary)",
                        border: "1px dashed var(--border-color)",
                        color: "var(--text-tertiary)",
                        borderRadius: "20px",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        userSelect: "none",
                        transition: "all 0.2s",
                        opacity: 0.7,
                      }}
                      title="Click to add to Home"
                    >
                      + {cat}
                    </div>
                  ))}

                {categoryMappings.length === 0 &&
                  (config.HOME_CATEGORIES || []).length === 0 && (
                    <div
                      style={{
                        color: "var(--text-tertiary)",
                        fontSize: "0.8rem",
                        fontStyle: "italic",
                      }}
                    >
                      No categories defined. Add rules below.
                    </div>
                  )}
              </div>
            </div>

            {/* Category Logic */}
            <div className="admin-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <h3 style={{ margin: 0, color: "var(--accent-color)" }}>
                  Category Rules
                </h3>
                <button
                  onClick={addCategoryMapping}
                  className="bmc-button"
                  style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                >
                  <PlusCircle size={16} /> Add Rule
                </button>
              </div>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-tertiary)",
                  marginTop: 0,
                  marginBottom: "1.5rem",
                }}
              >
                Define keyword patterns to automatically detect categories.
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {categoryMappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                      background: "var(--bg-primary)",
                      padding: "1.2rem",
                      borderRadius: "16px",
                      border: "1px solid var(--border-color)",
                      position: "relative",
                    }}
                  >
                    <button
                      onClick={() => removeCategoryMapping(mapping.id)}
                      style={{
                        position: "absolute",
                        top: "12px",
                        right: "12px",
                        background: "transparent",
                        border: "none",
                        color: "#f87171",
                        cursor: "pointer",
                        opacity: 0.7,
                      }}
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div>
                      <label
                        className="detail-label"
                        style={{
                          marginBottom: "0.3rem",
                          display: "block",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        CATEGORY
                      </label>
                      <input
                        value={mapping.name}
                        onChange={(e) =>
                          updateCategoryMapping(
                            mapping.id,
                            "name",
                            e.target.value,
                          )
                        }
                        className="search-input"
                        style={{
                          ...commonInputStyle,
                          width: "100%",
                          marginBottom: 0,
                          background: "white",
                        }}
                        placeholder="Category Name"
                      />
                    </div>
                    <div>
                      <label
                        className="detail-label"
                        style={{
                          marginBottom: "0.3rem",
                          display: "block",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        KEYWORDS
                      </label>
                      <textarea
                        value={mapping.keywords}
                        onChange={(e) =>
                          updateCategoryMapping(
                            mapping.id,
                            "keywords",
                            e.target.value,
                          )
                        }
                        className="search-input"
                        style={{
                          ...commonInputStyle,
                          minHeight: "60px",
                          resize: "vertical",
                          width: "100%",
                          marginBottom: 0,
                          background: "white",
                        }}
                        placeholder="comma, separated, keywords"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {categoryMappings.length === 0 && (
                <div
                  style={{ textAlign: "center", opacity: 0.5, padding: "2rem" }}
                >
                  No mappings defined.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          <Save size={20} /> Save Configuration
        </button>
      </div>
    </div>
  );
};

export default ConfigPage;
