// =====================================================
// InstallAppButton - PWA Installation Button
// =====================================================
// Detects if app can be installed and shows appropriate UI
// - Android/Desktop: Native install prompt
// - iOS: Instructions modal (share > add to home screen)
// =====================================================

import { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Check } from 'lucide-react';

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

            {/* iOS Instructions Modal - Elite Design */}
            {showIOSModal && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 notranslate" translate="no">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowIOSModal(false)}
                    />

                    {/* Modal Card */}
                    <div className="relative w-full max-w-sm bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
                        {/* Close */}
                        <button
                            onClick={() => setShowIOSModal(false)}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Header */}
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-white mb-1">Instalar Prometheus</h3>
                            <p className="text-sm text-zinc-500">Acesso nativo ao sistema.</p>
                        </div>

                        {/* Instructions Grid */}
                        <div className="space-y-4">
                            {/* Step 1: Share */}
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-white/5">
                                    <Share className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-300">
                                        Toque no botão <span className="text-white font-medium">Compartilhar</span>
                                    </p>
                                </div>
                            </div>

                            {/* Step 2: Add to Home */}
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-white/5">
                                    <PlusSquare className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-300">
                                        Selecione <span className="text-white font-medium">Adicionar à Tela de Início</span>
                                    </p>
                                </div>
                            </div>

                            {/* Step 3: Done */}
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-white/5">
                                    <Check className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-300">
                                        Acesse pelo ícone na sua home
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={() => setShowIOSModal(false)}
                            className="w-full mt-8 py-3.5 px-4 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl transition-colors shadow-lg shadow-white/5"
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
