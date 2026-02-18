import React from "react";
import { Search, ThumbsUp, TrendingUp, Clock, Sparkles } from "lucide-react";

/**
 * FilterBar Component
 *
 * Encapsulates the search input and sort mode selection.
 *
 * @param {Object} props
 * @param {string} props.searchTerm - Current search input value
 * @param {Function} props.setSearchTerm - Callback to update search term
 * @param {string} props.sortMode - Current sort mode (popular, trending, newest)
 * @param {Function} props.setSortMode - Callback to update sort mode
 * @param {string} props.currentView - Current active view (list, map, etc.)
 * @param {Function} props.t - Translation function
 */
const FilterBar = ({
  searchTerm,
  setSearchTerm,
  sortMode,
  setSortMode,
  currentView,
  t,
}) => {
  return (
    <div className="filter-bar">
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        <div
          className="search-wrapper"
          style={currentView === "map" ? { maxWidth: "100%" } : {}}
        >
          <Search size={18} color="#d8b4fe" />
          <input
            className="search-input"
            type="text"
            placeholder={t("home.search_placeholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Sort Mode Selector */}
        {currentView !== "map" && (
          <div className="sort-selector">
            {[
              {
                key: "popular",
                icon: <ThumbsUp size={14} />,
                label: t("home.popular"),
              },
              //   {
              //     key: "trending",
              //     icon: <TrendingUp size={14} />,
              //     label: t("home.trending"),
              //   },
              {
                key: "newest",
                icon: <Clock size={14} />,
                label: t("home.newest"),
              },
            ].map((mode) => (
              <button
                key={mode.key}
                className={`sort-btn ${sortMode === mode.key ? "active" : ""}`}
                onClick={() => setSortMode(mode.key)}
              >
                {mode.icon} {mode.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
