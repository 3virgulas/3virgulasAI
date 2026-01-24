// =====================================================
// InstallAppButton - PWA Installation Button
// =====================================================
// Detects if app can be installed and shows appropriate UI
// - Android/Desktop: Native install prompt
// - iOS: Instructions modal (share > add to home screen)
// =====================================================

import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

// BeforeInstallPromptEvent interface (not in standard TS)
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

// Detect iOS
const isIOS = (): boolean => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Check if running as installed PWA
const isStandalone = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;
};

export function InstallAppButton() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showIOSModal, setShowIOSModal] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (isStandalone()) {
            setIsInstalled(true);
            return;
        }

        // Listen for install prompt (Android/Desktop)
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
        };

        // Listen for successful install
        const handleAppInstalled = () => {
            setIsInstalled(true);
            setInstallPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    // Handle install click
    const handleInstallClick = async () => {
        if (isIOS()) {
            setShowIOSModal(true);
            return;
        }

        if (installPrompt) {
            await installPrompt.prompt();
            const { outcome } = await installPrompt.userChoice;
            if (outcome === 'accepted') {
                setInstallPrompt(null);
            }
        }
    };

    // Don't show if already installed
    if (isInstalled) return null;

    // Show button only if can install (has prompt or is iOS)
    if (!installPrompt && !isIOS()) return null;

    return (
        <>
            {/* Install Button */}
            <button
                onClick={handleInstallClick}
                className="flex items-center gap-2 w-full p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all text-sm group"
            >
                <Download className="w-4 h-4 group-hover:text-emerald-400 transition-colors" />
                <span>Instalar App</span>
            </button>

            {/* iOS Instructions Modal */}
            {showIOSModal && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 notranslate" translate="no">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/80"
                        onClick={() => setShowIOSModal(false)}
                    />

                    {/* Modal */}
                    <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4 animate-in slide-in-from-bottom duration-300">
                        {/* Close */}
                        <button
                            onClick={() => setShowIOSModal(false)}
                            className="absolute top-3 right-3 p-2 text-zinc-500 hover:text-white rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
                                <img
                                    src="/pwa-192x192.png"
                                    alt="Prometheus"
                                    className="w-10 h-10 rounded-lg"
                                />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Instalar Prometheus</h3>
                                <p className="text-xs text-zinc-500">Acesso rápido como app nativo</p>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                    1
                                </div>
                                <div className="flex-1">
                                    <p className="text-zinc-300">Toque no botão <span className="inline-flex items-center gap-1 text-blue-400"><Share className="w-4 h-4" /> Compartilhar</span></p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                    2
                                </div>
                                <div className="flex-1">
                                    <p className="text-zinc-300">Role e toque em <span className="text-white font-medium">"Adicionar à Tela de Início"</span></p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                    ✓
                                </div>
                                <div className="flex-1">
                                    <p className="text-zinc-300">Pronto! O app aparecerá na sua tela inicial</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <button
                            onClick={() => setShowIOSModal(false)}
                            className="w-full mt-4 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
                        >
                            Entendi
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

export default InstallAppButton;
