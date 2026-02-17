import React, { useState, useEffect } from "react";
import {
  BarChart,
  TrendingUp,
  Users,
  MapPin,
  Eye,
  MousePointer2,
  Calendar,
  Zap,
  Cpu,
  History,
  MessageSquare,
  Clock,
} from "lucide-react";

const AnalyticsPage = ({ API_URL, token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(14);

  const timeRanges = [
    { label: "1D", value: 1 },
    { label: "1W", value: 7 },
    { label: "2W", value: 14 },
    { label: "1M", value: 30 },
    { label: "3M", value: 90 },
  ];

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/analytics?days=${days}`, {
        headers: {
          "x-admin-token": token,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div
        className="section-wrapper"
        style={{ textAlign: "center", padding: "4rem" }}
      >
        <p style={{ color: "var(--text-secondary)" }}>
          Loading analytics data...
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        className="section-wrapper"
        style={{ textAlign: "center", padding: "4rem" }}
      >
        <p style={{ color: "#f87171" }}>Error: {error}</p>
        <button
          onClick={fetchAnalytics}
          className="filter-btn"
          style={{ marginTop: "1rem" }}
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    summary = {},
    llm = { overall: {}, by_type: {} },
    chat = {},
    daily_active_graph = [],
    daily_stats = [],
  } = data || {};

  const totalInteractions = summary.total_interactions || 0;
  const totalActiveUsers = summary.active_users || 0;
  const eventCounts = summary.event_counts || {};
  const totalViews = eventCounts.VIEW_DETAIL || 0;
  const totalSearches = eventCounts.SEARCH || 0;

  return (
    <div className="section-wrapper">
      {/* Header with Time Selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <BarChart size={24} color="var(--accent-color)" />
          <h1 className="section-title">Analytics Dashboard</h1>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            background: "var(--bg-card)",
            padding: "0.3rem",
            borderRadius: "8px",
          }}
        >
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => setDays(range.value)}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "6px",
                border: "none",
                background:
                  days === range.value ? "var(--accent-color)" : "transparent",
                color: days === range.value ? "white" : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600,
                transition: "all 0.2s ease",
              }}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div
          style={{
            position: "fixed",
            top: "1rem",
            right: "1rem",
            background: "var(--accent-color)",
            color: "white",
            padding: "0.5rem 1rem",
            borderRadius: "20px",
            fontSize: "0.8rem",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          Refreshing...
        </div>
      )}

      {/* Primary Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.2rem",
          marginBottom: "2rem",
        }}
      >
        <div className="admin-card">
          <MetricHeader
            label="Total Interactions"
            icon={<MousePointer2 size={16} color="var(--accent-color)" />}
          />
          <MetricValue value={totalInteractions.toLocaleString()} />
          <MetricSub label="Views + Searches" />
        </div>

        <div className="admin-card">
          <MetricHeader
            label="Active Users"
            icon={<Users size={16} color="#fbbf24" />}
          />
          <MetricValue value={totalActiveUsers.toLocaleString()} />
          <MetricSub label={`Last ${days} days`} />
        </div>

        <div className="admin-card">
          <MetricHeader
            label="Gemini Tokens"
            icon={<Zap size={16} color="#60a5fa" />}
          />
          <MetricValue
            value={(llm.overall?.total_tokens || 0).toLocaleString()}
          />
          <MetricSub label={`${llm.overall?.total_requests || 0} API calls`} />
        </div>

        <div className="admin-card">
          <MetricHeader
            label="Chat Efficiency"
            icon={<MessageSquare size={16} color="#34d399" />}
          />
          <MetricValue
            value={chat.avg_messages_per_user?.toFixed(1) || "0.0"}
          />
          <MetricSub label="Avg msgs per user" />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
          gap: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* Engagement Trend */}
        <div className="admin-card">
          <SectionTitle title="User Engagement" icon={<History size={18} />} />
          <ChartContainer>
            {daily_active_graph.length > 0 ? (
              daily_active_graph
                .slice()
                .reverse()
                .map((day) => {
                  const maxDau =
                    Math.max(...daily_active_graph.map((d) => d.dau)) || 1;
                  const height = (day.dau / maxDau) * 100;
                  return (
                    <Bar
                      key={day.date}
                      height={height}
                      label={day.date.split("-").slice(1).join("/")}
                      tooltip={`${day.date}: ${day.dau} users`}
                      color="linear-gradient(to top, var(--accent-color), #d8b4fe)"
                    />
                  );
                })
            ) : (
              <EmptyState label="Not enough data" />
            )}
          </ChartContainer>
        </div>

        {/* Token Usage Trend */}
        <div className="admin-card">
          <SectionTitle title="Gemini Token Trend" icon={<Zap size={18} />} />
          <ChartContainer>
            {llm.trend?.length > 0 ? (
              llm.trend
                .slice()
                .reverse()
                .map((day) => {
                  const maxTokens =
                    Math.max(...llm.trend.map((d) => d.tokens)) || 1;
                  const height = (day.tokens / maxTokens) * 100;
                  return (
                    <Bar
                      key={day.date}
                      height={height}
                      label={day.date.split("-").slice(1).join("/")}
                      tooltip={`${day.date}: ${day.tokens.toLocaleString()} tokens`}
                      color="linear-gradient(to top, #60a5fa, #93c5fd)"
                    />
                  );
                })
            ) : (
              <EmptyState label="No token activity logged" />
            )}
          </ChartContainer>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* Event Distribution (Pie Chart Style) */}
        <div className="admin-card">
          <SectionTitle
            title="Action Distribution"
            icon={<MousePointer2 size={18} />}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <div
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "50%",
                background: `conic-gradient(
                 var(--accent-color) 0% ${Math.min((totalViews / (totalInteractions || 1)) * 100, 100)}%, 
                 #34d399 ${Math.min((totalViews / (totalInteractions || 1)) * 100, 100)}% 100%
               )`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "inset 0 0 10px rgba(0,0,0,0.2)",
              }}
            >
              <div
                style={{
                  width: "90px",
                  height: "90px",
                  background: "var(--bg-card)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  color: "var(--text-tertiary)",
                  textAlign: "center",
                }}
              >
                TOTAL
                <br />
                {totalInteractions}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "0.8rem",
              }}
            >
              <LegendItem
                color="var(--accent-color)"
                label="Place Views"
                value={totalViews}
              />
              <LegendItem
                color="#34d399"
                label="AI Searches"
                value={totalSearches}
              />
            </div>
          </div>
        </div>

        {/* Top Places */}
        <div className="admin-card">
          <SectionTitle title="Top Visited Spots" icon={<MapPin size={18} />} />
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}
          >
            {data.top_places?.length > 0 ? (
              data.top_places.map((place, i) => (
                <div key={i}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-primary)",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "200px",
                      }}
                    >
                      {place.name}
                    </span>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {place.views} views
                    </span>
                  </div>
                  <div
                    style={{
                      height: "8px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(place.views / (data.top_places[0].views || 1)) * 100}%`,
                        background: "var(--accent-color)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState label="No views yet" />
            )}
          </div>
        </div>

        {/* LLM Breakdown */}
        <div className="admin-card">
          <SectionTitle title="Gemini Performance" icon={<Cpu size={18} />} />
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  padding: "1rem",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    color: "var(--text-tertiary)",
                    fontSize: "0.75rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  Avg Tokens / Req
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                  {Math.round(llm.overall?.avg_tokens || 0)}
                </div>
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  padding: "1rem",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    color: "var(--text-tertiary)",
                    fontSize: "0.75rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  Input : Output
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                  {Math.round(
                    (llm.overall?.input_tokens /
                      (llm.overall?.output_tokens || 1)) *
                      10,
                  ) / 10}{" "}
                  : 1
                </div>
              </div>
            </div>

            <div>
              <h4
                style={{
                  margin: "0 0 0.8rem",
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                }}
              >
                Avg Tokens by Activity
              </h4>
              {Object.entries(llm.by_type || {}).map(([type, stats]) => (
                <div key={type} style={{ marginBottom: "0.8rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <span
                      style={{
                        textTransform: "capitalize",
                        color: "var(--text-primary)",
                      }}
                    >
                      {type}
                    </span>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {Math.round(stats.avg_tokens)} tkn
                    </span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min((stats.avg_tokens / 5000) * 100, 100)}%`,
                        background: type === "chat" ? "#34d399" : "#60a5fa",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Stats (Nightly) Table */}
      <div className="admin-card">
        <SectionTitle
          title="Daily System Performance"
          icon={<Clock size={18} />}
        />
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              textAlign: "left",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <th
                  style={{
                    padding: "1rem 0.5rem",
                    fontSize: "0.85rem",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Date
                </th>
                <th
                  style={{
                    padding: "1rem 0.5rem",
                    fontSize: "0.85rem",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Active Users
                </th>
                <th
                  style={{
                    padding: "1rem 0.5rem",
                    fontSize: "0.85rem",
                    color: "var(--text-tertiary)",
                  }}
                >
                  AI Searches
                </th>
                <th
                  style={{
                    padding: "1rem 0.5rem",
                    fontSize: "0.85rem",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Place Views
                </th>
                <th
                  style={{
                    padding: "1rem 0.5rem",
                    fontSize: "0.85rem",
                    color: "var(--text-tertiary)",
                  }}
                >
                  New Spots
                </th>
              </tr>
            </thead>
            <tbody>
              {daily_stats.length > 0 ? (
                daily_stats.map((row) => (
                  <tr
                    key={row.date}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}
                  >
                    <td
                      style={{
                        padding: "0.8rem 0.5rem",
                        fontSize: "0.9rem",
                        color: "var(--text-primary)",
                      }}
                    >
                      {row.date}
                    </td>
                    <td
                      style={{ padding: "0.8rem 0.5rem", fontSize: "0.9rem" }}
                    >
                      {row.active_users}
                    </td>
                    <td
                      style={{ padding: "0.8rem 0.5rem", fontSize: "0.9rem" }}
                    >
                      {row.searches}
                    </td>
                    <td
                      style={{ padding: "0.8rem 0.5rem", fontSize: "0.9rem" }}
                    >
                      {row.views}
                    </td>
                    <td
                      style={{
                        padding: "0.8rem 0.5rem",
                        fontSize: "0.9rem",
                        color: "var(--accent-color)",
                        fontWeight: 600,
                      }}
                    >
                      +{row.new_places}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    No nightly data available for this range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Helper Components ---

const MetricHeader = ({ label, icon }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "0.5rem",
    }}
  >
    <span style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
      {label}
    </span>
    {icon}
  </div>
);

const MetricValue = ({ value }) => (
  <div
    style={{
      fontSize: "1.8rem",
      fontWeight: 700,
      color: "var(--text-primary)",
    }}
  >
    {value}
  </div>
);

const MetricSub = ({ label }) => (
  <div
    style={{
      fontSize: "0.75rem",
      color: "var(--text-secondary)",
      marginTop: "0.3rem",
    }}
  >
    {label}
  </div>
);

const SectionTitle = ({ title, icon }) => (
  <h3
    style={{
      marginTop: 0,
      marginBottom: "1.5rem",
      fontSize: "1rem",
      color: "var(--text-primary)",
      display: "flex",
      alignItems: "center",
      gap: "0.6rem",
    }}
  >
    <span style={{ color: "var(--accent-color)" }}>{icon}</span>
    {title}
  </h3>
);

const EmptyState = ({ label }) => (
  <div
    style={{
      height: "100%",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-tertiary)",
      fontSize: "0.9rem",
    }}
  >
    {label}
  </div>
);

const LegendItem = ({ color, label, value }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: "0.8rem",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: color,
        }}
      />
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
    </div>
    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
      {value}
    </span>
  </div>
);

const ChartContainer = ({ children }) => (
  <div
    style={{
      height: "240px",
      display: "flex",
      alignItems: "flex-end",
      gap: "6px",
      padding: "0 0.5rem 1rem",
    }}
  >
    {children}
  </div>
);

const Bar = ({ height, label, tooltip, color }) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
    }}
  >
    <div
      style={{
        width: "100%",
        height: `${Math.max(height, 5)}%`,
        background: color,
        borderRadius: "4px 4px 0 0",
        transition: "height 0.5s ease",
      }}
      title={tooltip}
    />
    <div
      style={{
        fontSize: "0.6rem",
        color: "var(--text-tertiary)",
        writingMode: "vertical-rl",
        transform: "rotate(180deg)",
      }}
    >
      {label}
    </div>
  </div>
);

export default AnalyticsPage;
