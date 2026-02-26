"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

function ReloadPrompt() {
    const { t } = useLanguage();
    const [needRefresh, setNeedRefresh] = useState(false);
    const [offlineReady, setOfflineReady] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

        // Listen for service worker updates
        navigator.serviceWorker.ready.then((registration) => {
            registration.addEventListener("updatefound", () => {
                const newWorker = registration.installing;
                if (!newWorker) return;

                newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        // New content available
                        setNeedRefresh(true);
                    }
                });
            });
        });

        // Check if already controlled (offline ready)
        if (navigator.serviceWorker.controller) {
            setOfflineReady(true);
        }
    }, []);

    const handleUpdate = () => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: "SKIP_WAITING" });
                }
            });
            // Reload after skip waiting
            navigator.serviceWorker.addEventListener("controllerchange", () => {
                window.location.reload();
            });
        }
    };

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    if (!offlineReady && !needRefresh) return null;

    return (
        <div className="pwa-reload-prompt">
            <div className="pwa-reload-card">
                <div className="pwa-reload-left">
                    <div className="pwa-reload-icon">
                        <RefreshCw size={22} className={needRefresh ? "animate-spin-slow" : ""} />
                    </div>
                    <div className="pwa-reload-text">
                        {offlineReady && !needRefresh ? (
                            <span>{t("pwa.offline_ready") || "Spotary ready for offline use"}</span>
                        ) : (
                            <span>{t("pwa.update_available") || "New version available"}</span>
                        )}
                    </div>
                </div>
                <div className="pwa-reload-actions">
                    {needRefresh ? (
                        <button className="pwa-reload-btn" onClick={handleUpdate}>
                            {t("pwa.reload_btn") || "Update"}
                        </button>
                    ) : (
                        <button className="pwa-reload-btn" onClick={close}>
                            OK
                        </button>
                    )}
                    <button className="pwa-reload-close" onClick={close}>
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ReloadPrompt;
