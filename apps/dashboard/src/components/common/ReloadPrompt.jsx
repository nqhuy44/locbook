import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

function ReloadPrompt() {
    const { t } = useLanguage();
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered:', r);
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

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
                        {offlineReady ? (
                            <span>{t("pwa.offline_ready") || "Spotary ready for offline use"}</span>
                        ) : (
                            <span>{t("pwa.update_available") || "New version available"}</span>
                        )}
                    </div>
                </div>
                <div className="pwa-reload-actions">
                    {needRefresh && (
                        <button className="pwa-reload-btn" onClick={() => updateServiceWorker(true)}>
                            {t("pwa.reload_btn")}
                        </button>
                    ) || (
                            <button className="pwa-reload-btn" onClick={() => close()}>
                                OK
                            </button>
                        )}
                    <button className="pwa-reload-close" onClick={() => close()}>
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ReloadPrompt;
