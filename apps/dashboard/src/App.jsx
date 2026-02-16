import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  X,
  MapPin,
  Navigation,
  Sparkles,
  Star,
  Coffee,
  Wine,
  UtensilsCrossed,
  Beer,
  PartyPopper,
  Heart,
  ThumbsUp,
  PenLine,
  BookOpen,
  Palette,
  TrendingUp,
  Clock,
  Lock,
  LogIn,
  Github,
  Globe,
  PlusCircle,
  MessageSquare,
  Settings,
  Share2,
  Check,
  User as UserIcon,
  Menu,
  Compass,
} from "lucide-react";
import { CONFIG as DEFAULT_CONFIG } from "./config";
import MapView from "./components/MapView";
import CategoryRow from "./components/CategoryRow";
import ChatView from "./components/ChatView";
import { useAuth, AuthProvider } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import LoginButton from "./components/auth/LoginButton";
import UserMenu from "./components/auth/UserMenu";
import BottomNav from "./components/BottomNav";
import OnboardingPage from "./pages/OnboardingPage";
import ProfilePage from "./pages/ProfilePage";
import BooksPage from "./pages/BooksPage";
import BookDetailPage from "./pages/BookDetailPage";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import SettingsModal from "./components/common/SettingsModal";
import FilterBar from "./components/FilterBar";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "20px",
            color: "white",
            background: "rgba(255,0,0,0.1)",
            borderRadius: "8px",
          }}
        >
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: "pre-wrap" }}>
            {this.state.error && this.state.error.toString()}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

const API_URL = import.meta.env.VITE_API_URL || "";

const PRICE_LEVEL_MAP = {
  PRICE_LEVEL_INEXPENSIVE: "Inexpensive",
  PRICE_LEVEL_MODERATE: "Moderate",
  PRICE_LEVEL_EXPENSIVE: "Expensive",
  PRICE_LEVEL_VERY_EXPENSIVE: "Very Expensive",
};

function AppContent() {
  const { user, loading: authLoading, loginResponse } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [currentView, setCurrentView] = useState("list");
  const [sortMode, setSortMode] = useState("popular");
  const [activeTab, setActiveTab] = useState("info");
  const [menuItems, setMenuItems] = useState([]);
  const [bookId, setBookId] = useState(null);
  const [userLists, setUserLists] = useState([]);
  const [showBookSelector, setShowBookSelector] = useState(false);
  const [userInteractions, setUserInteractions] = useState({
    upvoted: false,
    bookmarked: false,
    viewed: false,
  });
  const [placeMemos, setPlaceMemos] = useState([]);
  const [showMemoEditor, setShowMemoEditor] = useState(false);
  const [memoContent, setMemoContent] = useState("");
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const touchStartRef = React.useRef(0);
  const refreshingRef = React.useRef(false);
  const mainContentRef = React.useRef(null);

  const handleToggleList = async (listId, isAdded) => {
    if (!user || !selectedPlace) return;
    const placeId = selectedPlace._id || selectedPlace.id;
    const token = localStorage.getItem("auth_token");

    try {
      if (isAdded) {
        // Remove
        const res = await fetch(
          `${API_URL}/api/lists/${listId}/items/${placeId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          showToast("Removed from book!", "success");
          fetchUserLists();
        }
      } else {
        // Add
        const res = await fetch(`${API_URL}/api/lists/${listId}/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            url: selectedPlace.google_maps_url,
            name: selectedPlace.name,
            address: selectedPlace.address,
            suggested_dishes: [],
          }),
        });
        if (res.ok) {
          showToast("Added to book!", "success");
          fetchUserLists();
        } else {
          const err = await res.json();
          showToast(err.detail || "Failed to add", "error");
        }
      }
    } catch (err) {
      console.error("Failed to toggle list", err);
      showToast("An error occurred", "error");
    }
  };

  const fetchUserLists = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/lists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserLists(data);
      }
    } catch (err) {
      console.error("Failed to fetch user lists", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserLists();
    }
  }, [user]);

  // Custom navigation handler for deep links / internal navigation
  useEffect(() => {
    const handleNavigate = (e) => {
      const path = e.detail.path;
      if (path && path.startsWith("/books")) {
        const parts = path.split("/");
        if (parts.length > 2) {
          setBookId(parts[2]);
          setCurrentView("book-detail");
        } else {
          setCurrentView("books");
        }
      }
    };
    window.addEventListener("navigate", handleNavigate);
    return () => window.removeEventListener("navigate", handleNavigate);
  }, [user]);

  // Auth Guard removed as requested
  // useEffect(() => { ... }, ...);

  // Auth State - controlled by AuthContext now, but we might show prompts
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Filters
  console.log("Current API_URL:", API_URL);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeVibes, setActiveVibes] = useState([]);
  const [activeCats, setActiveCats] = useState([]);

  // Handle Onboarding Redirect
  useEffect(() => {
    if (user && loginResponse?.is_new) {
      setCurrentView("onboarding");
    }
  }, [user, loginResponse]);

  // State for Profile View
  const [viewingProfile, setViewingProfile] = useState(null); // { username: string } or null for self

  useEffect(() => {
    fetchData();

    const handleUrlChange = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);

      // 1. Places (via /place/:id or ?place=:id)
      if (path.startsWith("/place/")) {
        const placeId = path.split("/")[2];
        if (placeId) {
          // Fetch place details if not in memory?
          // For now, let's assume we fetch all places or handle it in fetchData
          // Ideally we should fetch specific place if not found
          fetch(`${API_URL}/api/discovery/places/${placeId}`, {
            headers: user
              ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
              : {},
          })
            .then((res) => res.json())
            .then((place) => {
              if (place && !place.detail) setSelectedPlace(place);
            })
            .catch((err) =>
              console.error("Failed to load deep-linked place:", err),
            );
        }
      } else if (params.get("place")) {
        const placeId = params.get("place");
        // Existing logic...
      } else {
        setSelectedPlace(null);
      }

      // 2. Books / Lists
      if (path.startsWith("/book/")) {
        const bId = path.split("/")[2];
        if (bId) {
          setBookId(bId);
          setCurrentView("book-detail");
        }
      } else if (path === "/books") {
        setCurrentView("books");
        setBookId(null);
      }

      // 3. Profiles
      if (path.startsWith("/profile/")) {
        const username = path.split("/")[2];
        if (username) {
          setViewingProfile({ username }); // Switch to public profile view
          setCurrentView("profile");
        }
      } else if (path === "/profile") {
        setViewingProfile(null); // Self
        setCurrentView("profile");
      } else if (path === "/" || path === "") {
        // Default
        if (!path.startsWith("/place/")) {
          setCurrentView("list"); // or 'map' based on preference?
        }
      }
    };

    window.addEventListener("popstate", handleUrlChange);
    // Initial check
    handleUrlChange();

    return () => window.removeEventListener("popstate", handleUrlChange);
  }, [user]);

  // Helper to update URL without reload
  const updateUrl = (path) => {
    window.history.pushState({}, "", path);
  };

  useEffect(() => {
    if (places.length > 0 && !selectedPlace) {
      const params = new URLSearchParams(window.location.search);
      const placeId = params.get("place");
      if (placeId) {
        const found = places.find((p) => p._id === placeId);
        if (found) openModal(found);
      }
    }
  }, [places]);

  const fetchData = async (isPull = false) => {
    if (refreshingRef.current && isPull) return;
    try {
      if (isPull) {
        refreshingRef.current = true;
        setIsPullRefreshing(true);
      } else {
        setLoading(true);
      }

      // Add a small artificial delay for refresh so it's visible
      const startTime = Date.now();

      const [placesRes, configRes] = await Promise.all([
        fetch(`${API_URL}/api/places?limit=150`),
        fetch(`${API_URL}/api/config`),
      ]);

      const placesData = await placesRes.json();
      setPlaces(placesData.data);

      if (configRes.ok) {
        const contentType = configRes.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const configData = await configRes.json();
          if (configData && configData.HOME_CATEGORIES) {
            setConfig((prev) => ({ ...prev, ...configData }));
          }
        }
      }

      // Ensure at least 600ms delay for refresh animation
      if (isPull) {
        const elapsed = Date.now() - startTime;
        if (elapsed < 600) {
          await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
        }
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
      setIsPullRefreshing(false);
      setPullDistance(0);
      refreshingRef.current = false;
    }
  };

  const handleTouchStart = (e) => {
    // If already refreshing or not on scroll top, don't start a new gesture
    if (refreshingRef.current) return;

    if (
      mainContentRef.current &&
      mainContentRef.current.scrollTop === 0 &&
      currentView === "list"
    ) {
      touchStartRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStartRef.current === 0 || refreshingRef.current) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current;

    // Reset if user scrolls away from top during gesture
    if (mainContentRef.current && mainContentRef.current.scrollTop > 0) {
      setPullDistance(0);
      touchStartRef.current = 0;
      return;
    }

    if (diff > 0) {
      // User is pulling down
      const resistance = 0.4;
      const distance = Math.min(diff * resistance, 100);
      setPullDistance(distance);

      // Prevent default scroll behavior if pulling down
      if (e.cancelable) e.preventDefault();
    } else if (diff < 0) {
      // User is pushing back up
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    // Use a functional update or ref logic if needed, but here we can check pullDistance
    // because it's updated via state. However, to be extra safe with closures:
    setPullDistance((currentDistance) => {
      if (currentDistance > 60 && !refreshingRef.current) {
        refreshingRef.current = true;
        fetchData(true);
      }
      return 0; // Always reset visual pull on end
    });
    touchStartRef.current = 0;
  };

  // Reset pull states when switching views to prevent "stuck" UI
  useEffect(() => {
    if (currentView !== "list") {
      setPullDistance(0);
      setIsPullRefreshing(false);
      refreshingRef.current = false;
      touchStartRef.current = 0;
    }
  }, [currentView]);

  useEffect(() => {
    const container = document.querySelector(".app-container");
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [currentView]); // Removed pullDistance to keep handlers stable

  const categorizedPlaces = useMemo(() => {
    const groups = {};
    config.HOME_CATEGORIES.forEach((cat) => (groups[cat] = []));
    if (!groups["Casual"]) groups["Casual"] = [];

    places.forEach((place) => {
      const cats = place.categories?.join(" ").toLowerCase() || "";
      const vibes = place.vibes?.join(" ").toLowerCase() || "";
      const combined = cats + " " + vibes;
      for (const [category, keywords] of Object.entries(
        config.CATEGORY_KEYWORDS,
      )) {
        if (
          groups[category] &&
          keywords.some((k) => new RegExp(`\\b${k}\\b`, "i").test(combined))
        ) {
          groups[category].push(place);
        }
      }
    });

    for (const key in groups) {
      groups[key] = [...new Set(groups[key])];
    }

    return groups;
  }, [places, config]);

  const { displayedVibes, displayedCategories } = useMemo(() => {
    const matchesSearch = (p) =>
      searchTerm === "" ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.vibes?.some((v) =>
        v.toLowerCase().includes(searchTerm.toLowerCase()),
      ) ||
      p.categories?.some((c) =>
        c.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const placesForVibes = places.filter((p) => {
      const mSearch = matchesSearch(p);
      const mCat =
        activeCats.length === 0 ||
        p.categories?.some((c) => activeCats.includes(c));
      return mSearch && mCat;
    });

    const placesForCats = places.filter((p) => {
      const mSearch = matchesSearch(p);
      const mVibe =
        activeVibes.length === 0 ||
        p.vibes?.some((v) => activeVibes.includes(v));
      return mSearch && mVibe;
    });

    const getUnique = (list, key) => {
      const s = new Set();
      list.forEach((p) => p[key]?.forEach((x) => s.add(x)));
      return Array.from(s);
    };

    const availVibes = getUnique(placesForVibes, "vibes");
    const availCats = getUnique(placesForCats, "categories");

    const buildList = (available, active) => {
      const activeSorted = [...active].sort();
      const remaining = available.filter((x) => !active.includes(x)).sort();
      return [...activeSorted, ...remaining];
    };

    return {
      displayedVibes: buildList(availVibes, activeVibes),
      displayedCategories: buildList(availCats, activeCats),
    };
  }, [places, searchTerm, activeVibes, activeCats, config]);

  const isFiltering =
    searchTerm !== "" || activeVibes.length > 0 || activeCats.length > 0;

  const filteredPlaces = useMemo(() => {
    if (!isFiltering) return [];
    return places.filter((place) => {
      const matchesSearch =
        searchTerm === "" ||
        place.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        place.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        place.vibes?.some((v) =>
          v.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        place.categories?.some((c) =>
          c.toLowerCase().includes(searchTerm.toLowerCase()),
        );

      const matchesVibe =
        activeVibes.length === 0 ||
        place.vibes?.some((v) => activeVibes.includes(v));

      const matchesCat =
        activeCats.length === 0 ||
        place.categories?.some((c) => activeCats.includes(c));

      return matchesSearch && matchesVibe && matchesCat;
    });
  }, [places, searchTerm, activeVibes, activeCats, isFiltering]);

  const toggleVibe = (vibe) => {
    if (activeVibes.includes(vibe))
      setActiveVibes(activeVibes.filter((v) => v !== vibe));
    else setActiveVibes([...activeVibes, vibe]);
  };

  const toggleCat = (cat) => {
    if (activeCats.includes(cat))
      setActiveCats(activeCats.filter((c) => c !== cat));
    else setActiveCats([...activeCats, cat]);
  };

  const openModal = async (place) => {
    setSelectedPlace(place);
    setActiveTab("info");
    setMenuItems([]);
    setUserInteractions({ upvoted: false, bookmarked: false, viewed: false });
    setPlaceMemos([]);
    setShowMemoEditor(false);
    setMemoContent("");
    document.body.style.overflow = "hidden";

    const placeId = place._id || place.id;
    const newUrl = `${window.location.pathname}?place=${placeId}`;
    window.history.pushState({ path: newUrl }, "", newUrl);

    // Fetch full place if needed
    if (!place.raw_ai_response) {
      try {
        const res = await fetch(`${API_URL}/api/places/${placeId}`);
        const fullPlace = await res.json();
        setSelectedPlace(fullPlace);
      } catch (e) {
        console.error("Failed to fetch details", e);
      }
    }

    // Fetch interaction status
    if (user) {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(
          `${API_URL}/api/interactions/status/${placeId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const data = await res.json();
          setUserInteractions(data);
        }
      } catch (e) {
        console.error("Failed to fetch interactions", e);
      }
    }

    // Fetch memos
    try {
      const res = await fetch(`${API_URL}/api/memos/place/${placeId}`);
      if (res.ok) {
        const data = await res.json();
        setPlaceMemos(data);
      }
    } catch (e) {
      console.error("Failed to fetch memos", e);
    }

    // Fetch menu
    try {
      const menuRes = await fetch(`${API_URL}/api/places/${placeId}/menu`);
      if (menuRes.ok) {
        const menuData = await menuRes.json();
        setMenuItems(menuData.menu || []);
      }
    } catch (e) {
      console.error("Failed to fetch menu", e);
    }
  };

  const handleToggleUpvote = async () => {
    if (!user || !selectedPlace) return;
    const placeId = selectedPlace._id || selectedPlace.id;
    const token = localStorage.getItem("auth_token");

    try {
      const res = await fetch(`${API_URL}/api/interactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ place_id: placeId, type: "upvote" }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserInteractions((prev) => ({
          ...prev,
          upvoted: data.status === "created",
        }));
        setSelectedPlace((prev) => ({
          ...prev,
          upvote_count: data.upvote_count,
        }));
        showToast(
          data.status === "created" ? "Upvoted!" : "Removed upvote",
          "success",
        );
      }
    } catch (e) {
      console.error("Failed to toggle upvote", e);
    }
  };

  const handleSaveMemo = async () => {
    if (!user || !selectedPlace || !memoContent.trim()) return;
    const placeId = selectedPlace._id || selectedPlace.id;
    const token = localStorage.getItem("auth_token");

    try {
      const res = await fetch(`${API_URL}/api/memos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ place_id: placeId, content: memoContent }),
      });
      if (res.ok) {
        const newMemo = await res.json();
        setPlaceMemos((prev) => [newMemo, ...prev]);
        setMemoContent("");
        setShowMemoEditor(false);
        setSelectedPlace((prev) => ({
          ...prev,
          memo_count: (prev.memo_count || 0) + 1,
        }));
        showToast("Memo saved!", "success");
      }
    } catch (e) {
      console.error("Failed to save memo", e);
    }
  };
  const closeModal = () => {
    setSelectedPlace(null);
    setShowBookSelector(false);
    document.body.style.overflow = "auto";
    const baseUrl = window.location.pathname;
    window.history.pushState({ path: baseUrl }, "", baseUrl);
  };

  const getSectionIcon = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes("bar")) return <Wine size={20} color="#a855f7" />;
    if (lower.includes("nhậu")) return <Beer size={20} color="#f59e0b" />;
    if (lower.includes("coffee") || lower.includes("cafe"))
      return <Coffee size={20} color="#f472b6" />;
    if (lower.includes("special") || lower.includes("date"))
      return <Sparkles size={20} color="#d946ef" />;
    return <UtensilsCrossed size={20} color="#fbbf24" />;
  };

  if (loading || authLoading)
    return (
      <div
        className="loading-screen"
        style={{
          color: "white",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkles className="loader-icon" /> {t("home.loading")}
      </div>
    );

  // Standalone pages – rendered without the main navbar/filter chrome
  if (currentView === "onboarding") {
    return <OnboardingPage onComplete={() => setCurrentView("list")} />;
  }

  return (
    <div className="app-container">
      {/* Pull-to-refresh Indicator */}
      <div
        className={`pull-to-refresh-indicator ${isPullRefreshing ? "refreshing" : ""}`}
        style={{
          transform: `translateY(${pullDistance}px)`,
          opacity: pullDistance > 0 || isPullRefreshing ? 1 : 0,
        }}
      >
        <Sparkles
          size={24}
          className={isPullRefreshing ? "spinning" : ""}
          style={{
            transform: `rotate(${pullDistance * 2}deg)`,
            color: "var(--accent-color)",
          }}
        />
      </div>

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-left">
          <div
            className="brand"
            onClick={() => {
              setSearchTerm("");
              setActiveVibes([]);
              setActiveCats([]);
              setCurrentView("list");
            }}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <img
              src="/logo-transparent.png"
              alt="Logo"
              style={{ width: "32px", height: "32px" }}
            />
            Spotary
          </div>
          <div className="nav-links">
            {config.FEATURES.ENABLE_DISCOVER && (
              <span
                className={`nav-link ${currentView === "list" && !isFiltering ? "active" : ""}`}
                onClick={() => {
                  setSearchTerm("");
                  setActiveVibes([]);
                  setActiveCats([]);
                  setCurrentView("list");
                  // Always trigger refresh when clicking Discover
                  fetchData(true);
                }}
              >
                {t("nav.discover")}
              </span>
            )}

            {config.FEATURES.ENABLE_MAP && (
              <span
                className={`nav-link ${currentView === "map" ? "active" : ""}`}
                onClick={() => {
                  setCurrentView("map");
                }}
              >
                {t("nav.map")}
              </span>
            )}

            {config.FEATURES.FEAT_AI_MATCHMAKE && (
              <span
                className={`nav-link ${currentView === "chat" ? "active" : ""}`}
                onClick={() => {
                  setSearchTerm("");
                  setActiveVibes([]);
                  setActiveCats([]);
                  setCurrentView("chat");
                }}
                style={{ display: "flex", alignItems: "center", gap: "5px" }}
              >
                <Sparkles size={16} /> {t("nav.ask_marin")}
              </span>
            )}
          </div>
        </div>

        <div className="nav-right">
          <button
            // Removed desktop-only to show on mobile
            className="nav-link"
            onClick={() => setShowSettings(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={t("settings.title")}
          >
            {/* Changed from Settings to Menu icon as requested */}
            <Menu size={24} color="var(--text-secondary)" />
          </button>

          {/* Auth UI - Hide on mobile, move to Profile page */}
          <div className="desktop-only">
            {user ? (
              <UserMenu onProfileClick={() => setCurrentView("profile")} />
            ) : (
              <div
                onClick={() => setCurrentView("profile")}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#6b7280",
                }}
                title="Login"
              >
                <UserIcon size={20} />
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Filter Bar */}
      {currentView !== "chat" &&
        currentView !== "profile" &&
        currentView !== "books" &&
        currentView !== "book-detail" &&
        !(currentView === "map" && !user) && (
          <FilterBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sortMode={sortMode}
            setSortMode={setSortMode}
            currentView={currentView}
            t={t}
          />
        )}

      {/* Main Content */}
      <main className="main-content" ref={mainContentRef}>
        {currentView === "chat" ? (
          <div style={{ height: "100%", width: "100%" }}>
            <ChatView onPlaceClick={openModal} config={config} />
          </div>
        ) : currentView === "map" ? (
          <MapView
            places={isFiltering ? filteredPlaces : places}
            onPlaceClick={openModal}
          />
        ) : currentView === "profile" ? (
          <ProfilePage
            onBack={() => setCurrentView("list")}
            viewingProfile={viewingProfile}
          />
        ) : currentView === "books" ? (
          <BooksPage />
        ) : currentView === "book-detail" && bookId ? (
          <BookDetailPage
            bookId={bookId}
            onBack={() => {
              window.history.pushState(null, "", "/books");
              window.dispatchEvent(
                new CustomEvent("navigate", { detail: { path: "/books" } }),
              );
            }}
            onPlaceClick={openModal}
          />
        ) : isFiltering ? (
          <div className="section-wrapper">
            <h2 className="section-title">
              {t("home.search_results")} ({filteredPlaces.length})
            </h2>
            <div className="places-grid" style={{ marginTop: "1.5rem" }}>
              {filteredPlaces.map((place) => (
                <PlaceCard
                  key={place._id}
                  place={place}
                  onClick={() => openModal(place)}
                />
              ))}
            </div>
          </div>
        ) : (
          config.HOME_CATEGORIES.map((category) => {
            if (
              !categorizedPlaces[category] ||
              categorizedPlaces[category].length === 0
            )
              return null;

            // Map category to translation key
            const categoryKeyMap = {
              Casual: "casual",
              "Cafe & Coffee": "cafe",
              "Special Occasion": "special",
              Bar: "bar",
            };
            const catKey = categoryKeyMap[category] || category.toLowerCase();
            const translatedTitle = catKey
              ? t(`categories.${catKey}`)
              : category;

            return (
              <CategoryRow
                key={category}
                title={
                  translatedTitle === `categories.${catKey}`
                    ? category
                    : translatedTitle
                }
                icon={getSectionIcon(category)}
                places={categorizedPlaces[category]}
                onPlaceClick={openModal}
                PlaceCardComponent={PlaceCard}
              />
            );
          })
        )}
      </main>

      {/* Bottom Navigation (Mobile) */}
      <BottomNav
        currentView={currentView}
        onViewChange={(view) => {
          setSearchTerm("");
          setActiveVibes([]);
          setActiveCats([]);

          if (view === "list") {
            setCurrentView("list");
            fetchData(true);
          } else if (view === "map") setCurrentView("map");
          else if (view === "chat") setCurrentView("chat");
          else if (view === "books") setCurrentView("books");
        }}
        onProfileClick={() => setCurrentView("profile")}
      />

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Book Selector Popup Modal */}
      {showBookSelector && (
        <div
          className="book-popup-overlay"
          onClick={() => setShowBookSelector(false)}
        >
          <div
            className="book-popup-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="book-popup-header">
              <h3>{t("books.select_book") || "Select Book"}</h3>
              <button
                className="close-btn-popup"
                onClick={() => setShowBookSelector(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="book-popup-list">
              {userLists.length > 0 ? (
                userLists.map((list) => {
                  const isAdded = list.items?.some(
                    (item) =>
                      item.place_id === (selectedPlace._id || selectedPlace.id),
                  );
                  return (
                    <div
                      key={list.id}
                      onClick={() => handleToggleList(list.id, isAdded)}
                      className={`book-list-item ${isAdded ? "item-added" : ""}`}
                    >
                      <div className="item-info-row">
                        <BookOpen
                          size={18}
                          color={isAdded ? "var(--accent-color)" : "#94a3b8"}
                        />
                        <span className="list-name">{list.name}</span>
                      </div>
                      {isAdded && (
                        <Check size={18} color="var(--accent-color)" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="empty-state-popup">
                  <p>No books found. Create one in your profile!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer - Desktop Only */}
      {config.FEATURES.ENABLE_FOOTER &&
        currentView !== "map" &&
        currentView !== "chat" && (
          <footer className="footer desktop-only">
            <div className="footer-content">
              <div className="footer-brand">Spotary</div>
              <div className="footer-links">
                {config.FEATURES.ENABLE_BUY_ME_COFFEE && (
                  <a
                    href={config.LINKS.BUY_ME_COFFEE}
                    target="_blank"
                    rel="noreferrer"
                    className="bmc-button-footer"
                  >
                    <Coffee size={18} /> {t("settings.coffee")}
                  </a>
                )}
                {config.LINKS.GITHUB && (
                  <a
                    href={config.LINKS.GITHUB}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Github size={18} /> GitHub
                  </a>
                )}
                {config.LINKS.AUTHOR_WEBSITE && (
                  <a
                    href={config.LINKS.AUTHOR_WEBSITE}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Globe size={18} /> Website
                  </a>
                )}
                {config.LINKS.FEEDBACK && (
                  <a
                    href={config.LINKS.FEEDBACK}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageSquare size={18} /> {t("settings.feedback")}
                  </a>
                )}
              </div>
              <div className="footer-text">Made by nqhuy</div>
              <div className="footer-copyright">
                © {new Date().getFullYear()} Spotary. All rights reserved. v
                {__APP_VERSION__}
              </div>
            </div>
          </footer>
        )}

      {/* Modal */}
      {selectedPlace && (
        <div
          className="popup-overlay"
          onClick={() => {
            closeModal();
            window.history.pushState({}, "", "/");
          }}
        >
          <div
            className="popup-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "900px",
              maxWidth: "96vw",
              height: "90vh",
              maxHeight: "90vh",
            }}
          >
            <ErrorBoundary>
              <div
                className="modal-close"
                onClick={() => {
                  closeModal();
                  window.history.pushState({}, "", "/");
                }}
              >
                <X size={24} />
              </div>

              <div className="modal-hero">
                <PlaceHeroImage place={selectedPlace} />
                <div className="hero-overlay"></div>
                <div className="hero-info">
                  <h1 className="hero-title">{selectedPlace.name}</h1>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "1rem",
                    }}
                  >
                    {selectedPlace.price_level && (
                      <div
                        className="badge"
                        style={{
                          background: "rgba(255,255,255,0.15)",
                          color: "white",
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                        }}
                      >
                        {PRICE_LEVEL_MAP[selectedPlace.price_level] ||
                          selectedPlace.price_level}
                      </div>
                    )}
                    {selectedPlace.rating && (
                      <div
                        className="badge"
                        style={{
                          background: "rgba(245, 158, 11, 0.2)",
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                        }}
                      >
                        <span style={{ color: "#f59e0b" }}>
                          ⭐ {selectedPlace.rating}
                        </span>
                      </div>
                    )}
                    {selectedPlace.aesthetic_score && (
                      <div
                        className="badge"
                        style={{
                          background: "rgba(168, 85, 247, 0.2)",
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                        }}
                      >
                        <span style={{ color: "#a855f7" }}>
                          🎨 {selectedPlace.aesthetic_score}/10
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="hero-actions">
                    <ShareButton />
                    {selectedPlace.google_maps_url ? (
                      <a
                        href={selectedPlace.google_maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary"
                        style={{
                          flex: "2",
                          justifyContent: "center",
                          background: "var(--accent-gradient)",
                          color: "white",
                        }}
                      >
                        <Navigation size={20} />
                        <span>Get Directions</span>
                      </a>
                    ) : null}
                  </div>

                  {/* Social Actions Tier - Only visible if logged in */}
                  {user && (
                    <div className="hero-social-actions">
                      {/* Add to Book */}
                      <button
                        className="social-action-btn"
                        onClick={() => setShowBookSelector(true)}
                        title="Add to Book"
                      >
                        <PlusCircle size={18} />
                        <span className="social-action-count">Book</span>
                      </button>

                      {/* Memo (Placeholder as requested) */}
                      <button
                        className="social-action-btn"
                        onClick={() =>
                          showToast("Memo feature coming soon!", "info")
                        }
                        title="Memo"
                      >
                        <PenLine size={18} />
                        <span className="social-action-count">
                          {selectedPlace.memo_count || 0}
                        </span>
                      </button>

                      {/* Upvote */}
                      <button
                        className={`social-action-btn ${userInteractions.upvoted ? "active" : ""}`}
                        onClick={handleToggleUpvote}
                        title="Upvote"
                      >
                        <ThumbsUp
                          size={18}
                          fill={
                            userInteractions.upvoted ? "currentColor" : "none"
                          }
                        />
                        <span className="social-action-count">
                          {selectedPlace.upvote_count || 0}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab Bar: Info | Menu */}
              <div className="modal-tabs">
                <button
                  className={`modal-tab ${activeTab === "info" ? "active" : ""}`}
                  onClick={() => setActiveTab("info")}
                >
                  Info
                </button>
                <button
                  className={`modal-tab ${activeTab === "menu" ? "active" : ""}`}
                  onClick={() => setActiveTab("menu")}
                >
                  Menu{" "}
                  {menuItems.length > 0 && (
                    <span className="tab-badge">{menuItems.length}</span>
                  )}
                </button>
              </div>

              <div className="modal-body">
                {activeTab === "info" ? (
                  <>
                    <div className="col-main" style={{ flex: 2 }}>
                      {selectedPlace.raw_ai_response?.marin_comment && (
                        <div className="marin-box">
                          <div className="marin-label">Marin's Take</div>
                          <div className="marin-text">
                            "{selectedPlace.raw_ai_response.marin_comment}"
                          </div>
                        </div>
                      )}

                      <div className="detail-row">
                        <div className="detail-label">Address</div>
                        <div className="detail-value">
                          {selectedPlace.address}
                        </div>
                      </div>

                      {selectedPlace.opening_hours && (
                        <div className="detail-row">
                          <div className="detail-label">Hours</div>
                          <div className="detail-value">
                            {selectedPlace.opening_hours}
                          </div>
                        </div>
                      )}

                      {/* Memos Section */}
                      <div className="detail-row" style={{ marginTop: "2rem" }}>
                        <div
                          className="detail-label"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <BookOpen size={16} /> Memos{" "}
                          <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>
                            ({placeMemos.length})
                          </span>
                        </div>
                        <div
                          className="memos-list"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            marginTop: "1rem",
                          }}
                        >
                          {placeMemos.map((memo) => (
                            <div
                              key={memo.id}
                              style={{
                                background: "rgba(0,0,0,0.03)",
                                padding: "1rem",
                                borderRadius: "12px",
                                border: "1px solid var(--border-color)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.9rem",
                                  color: "var(--text-primary)",
                                  lineHeight: "1.5",
                                }}
                              >
                                {memo.content}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--text-tertiary)",
                                  marginTop: "0.5rem",
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <span>
                                  {new Date(
                                    memo.created_at,
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                          {placeMemos.length === 0 && (
                            <div
                              style={{
                                fontSize: "0.85rem",
                                color: "var(--text-tertiary)",
                                fontStyle: "italic",
                              }}
                            >
                              No memos yet. Be the first to write one!
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="col-side" style={{ flex: 1 }}>
                      <div className="detail-row">
                        <div className="detail-label">Vibes</div>
                        <div className="pill-list">
                          {selectedPlace.vibes?.map((v) => (
                            <span key={v} className="pill">
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="detail-row">
                        <div className="detail-label">Categories</div>
                        <div className="pill-list">
                          {selectedPlace.categories?.map((c) => (
                            <span key={c} className="pill">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Menu Tab */
                  <div style={{ flex: 1 }}>
                    {menuItems.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "3rem",
                          color: "rgba(255,255,255,0.4)",
                        }}
                      >
                        <UtensilsCrossed
                          size={40}
                          style={{ marginBottom: "1rem", opacity: 0.3 }}
                        />
                        <p>No menu available yet</p>
                      </div>
                    ) : (
                      <div className="menu-list">
                        {menuItems.map((item, idx) => (
                          <div key={idx} className="menu-item">
                            <div className="menu-item-info">
                              <span className="menu-item-name">
                                {item.is_signature && (
                                  <Star
                                    size={12}
                                    fill="#ffd700"
                                    color="#ffd700"
                                    style={{ marginRight: 4 }}
                                  />
                                )}
                                {item.name}
                              </span>
                              {item.description && (
                                <span className="menu-item-desc">
                                  {item.description}
                                </span>
                              )}
                              {item.category && (
                                <span className="menu-item-cat">
                                  {item.category}
                                </span>
                              )}
                            </div>
                            <span className="menu-item-price">
                              {item.display_price ||
                                (item.price
                                  ? `${(item.price / 1000).toFixed(0)}k`
                                  : "")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ErrorBoundary>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

function PlaceCard({ place, onClick }) {
  let imageUrl =
    place.images?.length > 0 ? place.images[0] : place.local_image_path;

  if (imageUrl) {
    if (imageUrl.startsWith("http")) {
    } else if (imageUrl.startsWith("/images/")) {
      imageUrl = `${API_URL}${imageUrl}`;
    } else if (imageUrl.startsWith("data/images/")) {
      imageUrl = `${API_URL}/images/${imageUrl.replace("data/images/", "")}`;
    } else {
      imageUrl = `${API_URL}/images/${imageUrl}`;
    }
  }

  return (
    <div
      className="place-card"
      onClick={() => {
        if (onClick) onClick();
        // Sync URL
        window.history.pushState({}, "", `/place/${place.id}`);
      }}
    >
      <div className="card-media">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={place.name}
            className="card-img"
            loading="lazy"
          />
        ) : (
          <div className="card-placeholder">{place.name.charAt(0)}</div>
        )}
        {place.rating && (
          <div className="card-rating-badge">
            <Star size={10} fill="currentColor" /> {place.rating}
          </div>
        )}
        {place.aesthetic_score && (
          <div className="card-aesthetic-badge">
            <Palette size={10} /> {place.aesthetic_score}
          </div>
        )}
      </div>
      <div className="card-content">
        <h3 className="card-title" title={place.name}>
          {place.name}
        </h3>
        <div className="card-subtitle">{place.address}</div>
        <div className="card-tags">
          {place.vibes?.slice(0, 2).map((v) => (
            <span key={v} className="tag-soft match">
              {v}
            </span>
          ))}
        </div>
        {place.upvote_count > 0 && (
          <div className="card-stats">
            <span>
              <ThumbsUp size={11} /> {place.upvote_count}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceHeroImage({ place }) {
  let imageUrl =
    place.images?.length > 0 ? place.images[0] : place.local_image_path;

  if (imageUrl) {
    if (imageUrl.startsWith("http")) {
    } else if (imageUrl.startsWith("/images/")) {
      imageUrl = `${API_URL}${imageUrl}`;
    } else if (imageUrl.startsWith("data/images/")) {
      imageUrl = `${API_URL}/images/${imageUrl.replace("data/images/", "")}`;
    } else {
      imageUrl = `${API_URL}/images/${imageUrl}`;
    }
  }

  if (imageUrl) {
    return <img src={imageUrl} alt={place.name} />;
  }
  return (
    <div style={{ width: "100%", height: "100%", background: "#2d1b4e" }}></div>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          url: window.location.href,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
        alert("Could not copy link to clipboard");
      }
    }
  };

  return (
    <button
      className="btn-secondary"
      onClick={handleShare}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.8rem 1.2rem",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.2)",
        background: "rgba(255,255,255,0.1)",
        color: "white",
        cursor: "pointer",
        transition: "all 0.2s",
        backdropFilter: "blur(4px)",
      }}
    >
      {copied ? <Check size={20} color="#4ade80" /> : <Share2 size={20} />}
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

export default App;
