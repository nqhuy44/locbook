"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

function ReloadPrompt() {
    const { t } = useLanguage();
    const [needRefresh, setNeedRefresh] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

        // Listen for service worker updates only
        navigator.serviceWorker.ready.then((registration) => {
            registration.addEventListener("updatefound", () => {
                const newWorker = registration.installing;
                if (!newWorker) return;

                newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        // New content available — prompt user to update
                        setNeedRefresh(true);
                    }
                });
            });
        });
    }, []);

    const handleUpdate = () => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: "SKIP_WAITING" });
                }
            });
            navigator.serviceWorker.addEventListener("controllerchange", () => {
                window.location.reload();
            });
        }
    };

    const close = () => {
        setNeedRefresh(false);
    };

    if (!needRefresh) return null;

    return (
        <div className="pwa-reload-prompt">
            <div className="pwa-reload-card">
                <div className="pwa-reload-left">
                    <div className="pwa-reload-icon">
                        <RefreshCw size={22} className="animate-spin-slow" />
                    </div>
                    <div className="pwa-reload-text">
                        <span>{t("pwa.update_available") || "New version available"}</span>
                    </div>
                </div>
                <div className="pwa-reload-actions">
                    <button className="pwa-reload-btn" onClick={handleUpdate}>
                        {t("pwa.reload_btn") || "Update"}
                    </button>
                    <button className="pwa-reload-close" onClick={close}>
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ReloadPrompt;
