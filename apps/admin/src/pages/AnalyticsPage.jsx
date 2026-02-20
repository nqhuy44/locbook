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
  Search,
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
        headers: { "x-admin-token": token },
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

      {/* ========== PRIMARY METRICS ========== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.2rem",
          marginBottom: "2rem",
        }}
      >
        {/* Total Interactions */}
        <div className="admin-card">
          <MetricHeader
            label="Total Interactions"
            icon={<MousePointer2 size={16} color="var(--accent-color)" />}
          />
          <MetricValue value={totalInteractions.toLocaleString()} />
          <MetricSub label="Views + Searches" />
        </div>

        {/* Active Users */}
        <div className="admin-card">
          <MetricHeader
            label="Active Users"
            icon={<Users size={16} color="#fbbf24" />}
          />
          <MetricValue value={totalActiveUsers.toLocaleString()} />
          <MetricSub label={`Last ${days} days`} />
        </div>

        {/* Gemini Tokens — grouped breakdown */}
        <div className="admin-card">
          <MetricHeader
            label="Gemini Tokens"
            icon={<Zap size={16} color="#60a5fa" />}
          />
          <MetricValue
            value={(llm.overall?.total_tokens || 0).toLocaleString()}
          />
          <MetricSub label={`${llm.overall?.total_requests || 0} API calls`} />
          {Object.keys(llm.by_type || {}).length > 0 &&
            (() => {
              const groups = {
                Chat: { types: ["chat", "chat_tool"], color: "#34d399" },
                Analyze: {
                  types: ["analysis", "aesthetic", "ocr"],
                  color: "#60a5fa",
                },
              };
              return (
                <div
                  style={{
                    marginTop: "0.8rem",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    paddingTop: "0.6rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {Object.entries(groups).map(
                    ([label, { types: typeKeys, color }]) => {
                      const tokens = typeKeys.reduce(
                        (s, k) => s + (llm.by_type[k]?.total_tokens || 0),
                        0,
                      );
                      const reqs = typeKeys.reduce(
                        (s, k) => s + (llm.by_type[k]?.requests || 0),
                        0,
                      );
                      if (tokens === 0 && reqs === 0) return null;
                      return (
                        <div
                          key={label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.75rem",
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: color,
                                display: "inline-block",
                              }}
                            />
                            {label}
                          </span>
                          <span style={{ color: "var(--text-tertiary)" }}>
                            {tokens.toLocaleString()} tkn · {reqs} req
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              );
            })()}
        </div>

        {/* Chat Efficiency */}
        <div className="admin-card">
          <MetricHeader
            label="Chat Efficiency"
            icon={<MessageSquare size={16} color="#34d399" />}
          />
          <MetricValue
            value={chat.avg_messages_per_user?.toFixed(1) || "0.0"}
          />
          <MetricSub label="Avg msgs per user" />
          <div
            style={{
              marginTop: "0.8rem",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: "0.6rem",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.75rem",
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              Total Sessions
            </span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {(chat.total_sessions || 0).toLocaleString()}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.75rem",
              marginTop: "0.3rem",
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>Chat Users</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {chat.active_chat_users || 0}
            </span>
          </div>
        </div>
      </div>

      {/* ========== TREND CHARTS ========== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
          gap: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* User Engagement Trend */}
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

        {/* Token Trend — Stacked Chat vs Analyze */}
        <div className="admin-card">
          <SectionTitle title="Gemini Token Trend" icon={<Zap size={18} />} />
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: "var(--text-secondary)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#34d399",
                  display: "inline-block",
                }}
              />{" "}
              Chat
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: "var(--text-secondary)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#60a5fa",
                  display: "inline-block",
                }}
              />{" "}
              Analyze
            </span>
          </div>
          <ChartContainer>
            {llm.trend_grouped?.length > 0 ? (
              llm.trend_grouped
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((day) => {
                  const maxTokens =
                    Math.max(
                      ...llm.trend_grouped.map(
                        (d) => (d.chat_tokens || 0) + (d.analyze_tokens || 0),
                      ),
                    ) || 1;
                  const total =
                    (day.chat_tokens || 0) + (day.analyze_tokens || 0);
                  const height = (total / maxTokens) * 100;
                  const chatPct =
                    total > 0 ? ((day.chat_tokens || 0) / total) * 100 : 50;
                  return (
                    <div
                      key={day.date}
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
                          borderRadius: "4px 4px 0 0",
                          transition: "height 0.5s ease",
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column",
                        }}
                        title={`${day.date}: Chat ${(day.chat_tokens || 0).toLocaleString()} · Analyze ${(day.analyze_tokens || 0).toLocaleString()}`}
                      >
                        <div style={{ flex: chatPct, background: "#34d399" }} />
                        <div
                          style={{ flex: 100 - chatPct, background: "#60a5fa" }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: "0.6rem",
                          color: "var(--text-tertiary)",
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                        }}
                      >
                        {day.date.split("-").slice(1).join("/")}
                      </div>
                    </div>
                  );
                })
            ) : (
              <EmptyState label="No token activity logged" />
            )}
          </ChartContainer>
        </div>
      </div>

      {/* ========== DISTRIBUTION + PERFORMANCE ========== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* Action Distribution */}
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
                background: `conic-gradient(var(--accent-color) 0% ${Math.min((totalViews / (totalInteractions || 1)) * 100, 100)}%, #34d399 ${Math.min((totalViews / (totalInteractions || 1)) * 100, 100)}% 100%)`,
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

        {/* Gemini Performance — Grouped Table */}
        <div className="admin-card">
          <SectionTitle title="Gemini Performance" icon={<Cpu size={18} />} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1.2rem",
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
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                textAlign: "left",
                borderCollapse: "collapse",
                fontSize: "0.8rem",
              }}
            >
              <thead>
                <tr
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <th
                    style={{
                      padding: "0.6rem 0.4rem",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    Group
                  </th>
                  <th
                    style={{
                      padding: "0.6rem 0.4rem",
                      color: "var(--text-tertiary)",
                      textAlign: "right",
                    }}
                  >
                    Requests
                  </th>
                  <th
                    style={{
                      padding: "0.6rem 0.4rem",
                      color: "var(--text-tertiary)",
                      textAlign: "right",
                    }}
                  >
                    Tokens
                  </th>
                  <th
                    style={{
                      padding: "0.6rem 0.4rem",
                      color: "var(--text-tertiary)",
                      textAlign: "right",
                    }}
                  >
                    Avg
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const groups = [
                    {
                      label: "Chat",
                      types: ["chat", "chat_tool"],
                      color: "#34d399",
                    },
                    {
                      label: "Analyze",
                      types: ["analysis", "aesthetic", "ocr"],
                      color: "#60a5fa",
                    },
                  ];
                  const byType = llm.by_type || {};
                  return groups.map(({ label, types: keys, color }) => {
                    const reqs = keys.reduce(
                      (s, k) => s + (byType[k]?.requests || 0),
                      0,
                    );
                    const tokens = keys.reduce(
                      (s, k) => s + (byType[k]?.total_tokens || 0),
                      0,
                    );
                    const avg = reqs > 0 ? Math.round(tokens / reqs) : 0;
                    return (
                      <tr
                        key={label}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.03)",
                        }}
                      >
                        <td style={{ padding: "0.6rem 0.4rem" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: color,
                                display: "inline-block",
                              }}
                            />
                            {label}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "0.6rem 0.4rem",
                            textAlign: "right",
                          }}
                        >
                          {reqs}
                        </td>
                        <td
                          style={{
                            padding: "0.6rem 0.4rem",
                            textAlign: "right",
                          }}
                        >
                          {tokens.toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: "0.6rem 0.4rem",
                            textAlign: "right",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {avg}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== TOP RANKINGS ========== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
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
                        maxWidth: "180px",
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
                      height: "6px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(place.views / (data.top_places[0].views || 1)) * 100}%`,
                        background: "var(--accent-color)",
                        borderRadius: "3px",
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

        {/* Top Search Keywords */}
        <div className="admin-card">
          <SectionTitle
            title="Top Search Keywords"
            icon={<Search size={18} />}
          />
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}
          >
            {data.search_keywords?.length > 0 ? (
              data.search_keywords.map((kw, i) => (
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
                        maxWidth: "180px",
                        padding: "2px 8px",
                        background: "rgba(52, 211, 153, 0.1)", // Green tint
                        border: "1px solid rgba(52, 211, 153, 0.2)",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                      }}
                    >
                      #{kw.keyword}
                    </span>
                    <span
                      style={{
                        color: "var(--text-tertiary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {kw.count}×
                    </span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(kw.count / (data.search_keywords[0].count || 1)) * 100}%`,
                        background:
                          "linear-gradient(to right, #34d399, #60a5fa)",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState label="No search data yet" />
            )}
          </div>
        </div>

        {/* Top Chat Users */}
        <div className="admin-card">
          <SectionTitle
            title="Top Chat Users"
            icon={<MessageSquare size={18} />}
          />
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}
          >
            {data.top_chat_users?.length > 0 ? (
              data.top_chat_users.map((u, i) => (
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
                        maxWidth: "160px",
                      }}
                    >
                      {i + 1}. {u.name}
                    </span>
                    <span
                      style={{
                        color: "var(--text-tertiary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.messages} msgs · {u.sessions} sess
                    </span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(u.messages / (data.top_chat_users[0].messages || 1)) * 100}%`,
                        background:
                          "linear-gradient(to right, #a78bfa, #f472b6)",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState label="No chat users yet" />
            )}
          </div>
        </div>
      </div>

      {/* ========== SYSTEM STATS TABLE ========== */}
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
