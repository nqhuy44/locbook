"use client";
import React, { useState, useEffect } from "react";
import { Share, X, ArrowUpCircle, Share2, PlusSquare, ArrowUp } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Overlay component to guide users on how to install the PWA manually
 */
const InstallOverlay = ({ onClose, isIOS }) => {
    const { t } = useLanguage();

    return (
        <div className="pwa-install-overlay" onClick={onClose}>
            <div className="pwa-overlay-card" onClick={(e) => e.stopPropagation()}>
                <div className="pwa-overlay-header">
                    <h3>{t("pwa.how_to_install") || "How to Install Spotary"}</h3>
                    <button onClick={onClose} className="pwa-overlay-close">
                        <X size={24} />
                    </button>
                </div>

                <div className="pwa-overlay-steps">
                    {isIOS ? (
                        <>
                            <div className="pwa-step">
                                <div className="pwa-step-number">1</div>
                                <div className="pwa-step-text">
                                    {t("pwa.ios_step_1") || "Tap the 'Share' button in Safari's bottom bar."}
                                    <div className="pwa-step-icon"><Share2 size={18} /></div>
                                </div>
                            </div>
                            <div className="pwa-step">
                                <div className="pwa-step-number">2</div>
                                <div className="pwa-step-text">
                                    {t("pwa.ios_step_2") || "Scroll down and select 'Add to Home Screen'."}
                                    <div className="pwa-step-icon"><PlusSquare size={18} /></div>
                                </div>
                            </div>
                            <div className="pwa-step">
                                <div className="pwa-step-number">3</div>
                                <div className="pwa-step-text">
                                    {t("pwa.ios_step_3") || "Tap 'Add' to finish."}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="pwa-step">
                                <div className="pwa-step-number">1</div>
                                <div className="pwa-step-text">
                                    {t("pwa.android_step_1") || "Tap the menu icon (three dots) at the top right."}
                                </div>
                            </div>
                            <div className="pwa-step">
                                <div className="pwa-step-number">2</div>
                                <div className="pwa-step-text">
                                    {t("pwa.android_step_2") || "Select 'Install App' or 'Add to Home Screen'."}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <button className="btn-primary pwa-overlay-btn" style={{ justifyContent: "center" }} onClick={onClose}>
                    {t("common.ok") || "Got it!"}
                </button>

                {isIOS && (
                    <div className="pwa-ios-indicator">
                        <ArrowUp className="animate-bounce" />
                    </div>
                )}
            </div>
        </div>
    );
};

const PWABanner = () => {
    const { t } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showOverlay, setShowOverlay] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        // Robust standalone detection
        const checkStandalone = () => {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const isAndroid = /Android/.test(navigator.userAgent);
            const isStandalone =
                window.matchMedia("(display-mode: standalone)").matches ||
                window.navigator.standalone ||
                document.referrer.includes("android-app://");

            // Don't show if already in standalone mode (already installed and opened as app)
            if (isStandalone) {
                setIsVisible(false);
                return;
            }

            // Force visible on mobile browsers
            if (isIOS || isAndroid) {
                const dismissed = sessionStorage.getItem("pwa-banner-dismissed");
                if (!dismissed) {
                    setIsVisible(true);
                }
            }
        };

        checkStandalone();

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setIsVisible(false);
            }
        } else {
            // No native prompt available, show instructional overlay
            // (Note: iOS will ALWAYS fall through here)
            setShowOverlay(true);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem("pwa-banner-dismissed", "true");
    };

    if (!isVisible) return null;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    return (
        <>
            <div className="pwa-banner">
                <div className="pwa-banner-card">
                    <div className="pwa-banner-left">
                        <img src="/apple-touch-icon.png" alt="Spotary Icon" className="pwa-app-icon" />
                        <div className="pwa-banner-text">
                            <span className="pwa-app-name">Spotary - Vibe Collection</span>
                            <span className="pwa-app-url">spotary.place</span>
                        </div>
                    </div>
                    <div className="pwa-banner-right">
                        <button className="pwa-install-link" onClick={handleInstallClick}>
                            {t("pwa.install_btn")}
                        </button>
                        <button className="pwa-banner-close" onClick={handleDismiss}>
                            <X size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {showOverlay && (
                <InstallOverlay
                    onClose={() => setShowOverlay(false)}
                    isIOS={isIOS}
                />
            )}
        </>
    );
};

export default PWABanner;
