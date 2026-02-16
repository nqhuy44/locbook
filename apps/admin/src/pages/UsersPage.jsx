import { useState, useEffect } from "react";
import { Search, Ban, Trash2, CheckCircle, User, LogOut } from "lucide-react";

const UsersPage = ({ API_URL, token }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    fetchUsers();
  }, [page, searchTerm]); // Debounce search in real app

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        limit: LIMIT,
        offset: page * LIMIT,
      });
      if (searchTerm) query.append("search", searchTerm);

      const res = await fetch(`${API_URL}/api/admin/users?${query}`, {
        headers: { "x-admin-token": token },
      });
      const data = await res.json();
      setUsers(data.data);
      setTotal(data.total);
    } catch (e) {
      console.error("Failed to fetch users", e);
    } finally {
      setLoading(false);
    }
  };

  const handleBanToggle = async (user) => {
    const newStatus = !user.is_active;
    const action = newStatus ? "Unban" : "Ban";
    if (
      !window.confirm(
        `Are you sure you want to ${action} ${user.username || user.email}?`,
      )
    )
      return;

    try {
      const res = await fetch(
        `${API_URL}/api/admin/users/${user.id}/status?is_active=${newStatus}`,
        {
          method: "PUT",
          headers: { "x-admin-token": token },
        },
      );
      if (res.ok) {
        setUsers(
          users.map((u) =>
            u.id === user.id ? { ...u, is_active: newStatus } : u,
          ),
        );
      } else {
        alert("Failed to update status");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating status");
    }
  };

  const handleDelete = async (user) => {
    if (
      !window.confirm(
        `DANGER: Are you sure you want to PERMANENTLY DELETE ${user.username || user.email}? This cannot be undone.`,
      )
    )
      return;

    try {
      const res = await fetch(`${API_URL}/api/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
      if (res.ok) {
        setUsers(users.filter((u) => u.id !== user.id));
      } else {
        alert("Failed to delete user");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting user");
    }
  };

  return (
    <div className="section-wrapper">
      <style>{`
        .users-header {
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
          .users-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }
          .search-wrapper-styled {
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
      <div className="users-header">
        <h1 className="section-title">User Management</h1>
        <div className="search-wrapper-styled">
          <Search size={18} color="var(--text-tertiary)" />
          <input
            className="search-input-styled"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
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
          Loading Users...
        </div>
      ) : (
        <>
          {/* Desktop Table */}
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
                  <th style={{ padding: "1rem" }}>User</th>
                  <th style={{ padding: "1rem" }}>Role</th>
                  <th style={{ padding: "1rem" }}>Status</th>
                  <th style={{ padding: "1rem" }}>Joined</th>
                  <th style={{ padding: "1rem", textAlign: "right" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <td style={{ padding: "1rem" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                        }}
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt=""
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: "1px solid var(--border-color)",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: "var(--bg-primary)",
                              color: "var(--text-secondary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <User size={18} />
                          </div>
                        )}
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--text-primary)",
                            }}
                          >
                            {user.display_name || user.username || "No Name"}
                          </div>
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <span
                        className="tag-soft"
                        style={{
                          background:
                            user.role === "admin"
                              ? "var(--bg-primary)"
                              : "rgba(0,0,0,0.03)",
                          color:
                            user.role === "admin"
                              ? "var(--accent-color)"
                              : "var(--text-secondary)",
                          border:
                            user.role === "admin"
                              ? "1px solid var(--accent-soft)"
                              : "none",
                        }}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: "1rem" }}>
                      {user.is_active ? (
                        <span
                          style={{
                            color: "#10b981",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                          }}
                        >
                          <CheckCircle size={14} /> Active
                        </span>
                      ) : (
                        <span
                          style={{
                            color: "#ef4444",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                          }}
                        >
                          <Ban size={14} /> Banned
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "1rem",
                        fontSize: "0.9rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <button
                        onClick={() => handleBanToggle(user)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: user.is_active ? "#f87171" : "#10b981",
                          cursor: "pointer",
                          marginRight: "1rem",
                          padding: "0.4rem",
                          borderRadius: "50%",
                          transition: "background 0.2s",
                        }}
                        title={user.is_active ? "Ban User" : "Unban User"}
                      >
                        <Ban size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          padding: "0.4rem",
                          borderRadius: "50%",
                          transition: "background 0.2s",
                        }}
                        title="Delete User"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div
              style={{
                padding: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
                background: "var(--bg-primary)",
              }}
            >
              <div>Total: {total} users</div>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    opacity: page === 0 ? 0.3 : 1,
                    fontWeight: 500,
                  }}
                >
                  Previous
                </button>
                <span>Page {page + 1}</span>
                <button
                  disabled={users.length < LIMIT}
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    opacity: users.length < LIMIT ? 0.3 : 1,
                    fontWeight: 500,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Mobile List View */}
          <div className="mobile-list">
            {users.map((user) => (
              <div key={`mobile-${user.id}`} className="mobile-card">
                {/* Header: Avatar + Name + Email */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "1rem" }}
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1px solid var(--border-color)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: "var(--bg-primary)",
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <User size={20} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "1.05rem",
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {user.display_name || user.username || "No Name"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-tertiary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {user.email}
                    </div>
                  </div>
                </div>

                {/* Badges Row */}
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <span
                    className="tag-soft"
                    style={{
                      background:
                        user.role === "admin"
                          ? "var(--bg-primary)"
                          : "rgba(0,0,0,0.03)",
                      color:
                        user.role === "admin"
                          ? "var(--accent-color)"
                          : "var(--text-secondary)",
                      border:
                        user.role === "admin"
                          ? "1px solid var(--accent-soft)"
                          : "none",
                    }}
                  >
                    {user.role}
                  </span>
                  {user.is_active ? (
                    <span
                      style={{
                        color: "#10b981",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle size={12} /> Active
                    </span>
                  ) : (
                    <span
                      style={{
                        color: "#ef4444",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      <Ban size={12} /> Banned
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-tertiary)",
                      marginLeft: "auto",
                    }}
                  >
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Actions */}
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
                    onClick={() => handleBanToggle(user)}
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      color: user.is_active ? "#f87171" : "#10b981",
                      cursor: "pointer",
                      padding: "0.5rem",
                      borderRadius: "50%",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                    }}
                  >
                    <Ban size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
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
            {/* Mobile Pagination */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem 0",
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
              }}
            >
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-primary)",
                  opacity: page === 0 ? 0.3 : 1,
                }}
              >
                Previous
              </button>
              <span>{page + 1}</span>
              <button
                disabled={users.length < LIMIT}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-primary)",
                  opacity: users.length < LIMIT ? 0.3 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UsersPage;
