import { useState, useEffect } from "react";
import { Search, Edit2, Trash2, MapPin } from "lucide-react";

const PlacesPage = ({ API_URL, token }) => {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/places?limit=1000`);
      const data = await res.json();
      setPlaces(data.data);
    } catch (e) {
      console.error("Failed to fetch", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this place?")) return;
    try {
      const res = await fetch(`${API_URL}/api/places/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
      if (res.ok) {
        setPlaces(places.filter((p) => p._id !== id));
      } else {
        if (res.status === 403) alert("Unauthorized: Invalid Token");
        else alert("Failed to delete");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting");
    }
  };

  const openEdit = (place) => {
    setSelectedPlace(place);
    setEditForm({
      name: place.name,
      address: place.address || "",
      categories: place.categories?.join(", ") || "",
      vibes: place.vibes?.join(", ") || "",
      price_level: place.price_level || "",
      rating: place.rating || "",
      google_maps_url: place.google_maps_url || "",
    });
  };

  const handleSave = async () => {
    try {
      const processList = (str) =>
        str
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      const payload = {
        ...editForm,
        categories: processList(editForm.categories),
        vibes: processList(editForm.vibes),
        rating: editForm.rating ? parseFloat(editForm.rating) : null,
      };

      const id = selectedPlace.id || selectedPlace._id;

      const res = await fetch(`${API_URL}/api/places/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setPlaces(
          places.map((p) => {
            const pId = p.id || p._id;
            return pId === id ? { ...updated, _id: p._id, id: p.id } : p;
          }),
        );
        setSelectedPlace(null);
      } else {
        if (res.status === 403) alert("Unauthorized: Invalid Token");
        else alert("Failed to update");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating");
    }
  };

  const filteredPlaces = places.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.categories?.some((c) =>
        c.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
  );

  return (
    <div className="section-wrapper">
      <style>{`
        .places-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .desktop-table {
          display: block;
        }
        .mobile-list {
          display: none;
        }
        
        @media (max-width: 768px) {
          .places-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }
          .search-wrapper {
            max-width: 100% !important;
          }
          .desktop-table {
            display: none;
          }
          .mobile-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
          .section-title {
            margin-bottom: 0.5rem;
          }
        }
      `}</style>

      <div className="places-header">
        <h1 className="section-title">Places Registry</h1>
        <div className="search-wrapper-styled">
          <Search size={18} color="var(--text-tertiary)" />
          <input
            className="search-input-styled"
            placeholder="Search places..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div
          style={{
            textAlign: "center",
            marginTop: "4rem",
            color: "var(--text-secondary)",
          }}
        >
          Loading...
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div
            className="admin-card desktop-table"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    color: "var(--text-secondary)",
                    fontSize: "0.85rem",
                    background: "var(--bg-primary)",
                  }}
                >
                  <th style={{ padding: "1rem", width: "25%" }}>Name</th>
                  <th style={{ padding: "1rem", width: "100px" }}>Actions</th>
                  <th style={{ padding: "1rem" }}>Categories</th>
                  <th style={{ padding: "1rem" }}>Vibes</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlaces.map((place) => (
                  <tr
                    key={place.id || place._id}
                    className="admin-row"
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <td style={{ padding: "1rem" }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {place.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-tertiary)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <MapPin size={12} /> {place.address}
                      </div>
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={() => openEdit(place)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--accent-color-strong)",
                            cursor: "pointer",
                            padding: "0.4rem",
                            borderRadius: "50%",
                            transition: "background 0.2s",
                          }}
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(place.id || place._id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: "0.4rem",
                            borderRadius: "50%",
                            transition: "background 0.2s",
                          }}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        {place.categories?.slice(0, 5).map((c) => (
                          <span key={c} className="tag-soft">
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "1rem",
                        color: "var(--text-secondary)",
                        fontSize: "0.9rem",
                      }}
                    >
                      {place.vibes?.slice(0, 3).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-list">
            {filteredPlaces.map((place) => (
              <div
                key={`mobile-${place.id || place._id}`}
                className="mobile-card"
              >
                {/* 1. Name */}
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "var(--text-primary)",
                  }}
                >
                  {place.name}
                </div>

                {/* 2. Address */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.9rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  <MapPin size={14} />
                  <span>{place.address || "No address"}</span>
                </div>

                {/* 3. Categories (Tags) & Vibes */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginTop: "4px",
                  }}
                >
                  {place.categories?.map((c) => (
                    <span
                      key={c}
                      className="tag-soft"
                      style={{
                        background: "var(--accent-soft)",
                        color: "var(--accent-color-strong)",
                      }}
                    >
                      {c}
                    </span>
                  ))}
                  {place.vibes?.map((v) => (
                    <span key={v} className="tag-soft">
                      #{v}
                    </span>
                  ))}
                </div>

                {/* Actions: Bottom Right */}
                <div
                  style={{
                    // position: "absolute",
                    bottom: "0.5rem",
                    right: "0.5rem",
                    display: "flex",
                    gap: "0.5rem",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => openEdit(place)}
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--accent-color-strong)",
                      cursor: "pointer",
                      padding: "0.5rem",
                      borderRadius: "50%",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                    }}
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(place.id || place._id)}
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      color: "#ef4444",
                      cursor: "pointer",
                      padding: "0.5rem",
                      borderRadius: "50%",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit Modal - Unchanged Logic, just rendering */}
      {selectedPlace && (
        <div className="modal-overlay" onClick={() => setSelectedPlace(null)}>
          <div
            className="modal-content"
            style={{
              height: "auto",
              maxHeight: "90vh",
              width: "600px",
              padding: "2rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "1.5rem",
                color: "var(--text-primary)",
              }}
            >
              Edit {selectedPlace.name}
            </h2>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {/* Form Fields */}
              <div>
                <label className="detail-label">Name</label>
                <input
                  className="search-input"
                  style={{ background: "var(--bg-primary)" }}
                  value={editForm.name || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="detail-label">Address</label>
                <input
                  className="search-input"
                  style={{ background: "var(--bg-primary)" }}
                  value={editForm.address || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, address: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="detail-label">Categories</label>
                <textarea
                  className="search-input"
                  style={{ background: "var(--bg-primary)", minHeight: "80px" }}
                  value={editForm.categories}
                  onChange={(e) =>
                    setEditForm({ ...editForm, categories: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="detail-label">Vibes</label>
                <textarea
                  className="search-input"
                  style={{ background: "var(--bg-primary)", minHeight: "60px" }}
                  value={editForm.vibes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, vibes: e.target.value })
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}
              >
                <div>
                  <label className="detail-label">Rating</label>
                  <input
                    type="number"
                    step="0.1"
                    className="search-input"
                    style={{ background: "var(--bg-primary)" }}
                    value={editForm.rating || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, rating: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="detail-label">Price</label>
                  <input
                    className="search-input"
                    style={{ background: "var(--bg-primary)" }}
                    value={editForm.price_level || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, price_level: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: "2rem",
                display: "flex",
                justifyContent: "flex-end",
                gap: "1rem",
              }}
            >
              <button
                onClick={() => setSelectedPlace(null)}
                className="filter-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bmc-button"
                style={{ border: "none", cursor: "pointer" }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlacesPage;
