// =====================================================
// PrometheusModal - Fullscreen Premium Subscription Modal
// =====================================================
// MOBILE OPTIMIZED VERSION
// - Removed heavy MatrixRainChar animation (was 200 updates/sec)
// - Removed animated MatrixLogo (too heavy for modal)
// - Fixed scroll container for smooth mobile scrolling
// - Added body scroll lock
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import {
    X,
    Zap,
    Loader2,
    Copy,
    Check,
    AlertCircle,
    Phone,
    Brain,
    ShieldOff,
    GraduationCap,
    ScanEye,
    Flame,
    Sparkles
} from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { PhoneFormModal } from './ProfileFormModal';

interface PrometheusModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onSuccess?: () => void;
}

// Feature Item with subtle bullet
function FeatureItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/10">
                <Icon className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-sm text-zinc-200">{text}</span>
        </div>
    );
}

// Free tier feature item
function FreeFeatureItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-zinc-800/50">
                <span className="text-xs text-zinc-600">—</span>
            </div>
            <span className="text-sm text-zinc-500">{text}</span>
        </div>
    );
}

export function PrometheusModal({
    isOpen,
    onClose,
    userId,
    onSuccess
}: PrometheusModalProps) {
    const {
        profile,
        isPremium,
        generatePixPayment,
        checkPaymentStatus,
        updateProfile,
        refreshProfile
    } = useSubscription(userId);

    // Payment states
    const [isGenerating, setIsGenerating] = useState(false);
    const [pixCode, setPixCode] = useState<string | null>(null);
    const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [showProfileForm, setShowProfileForm] = useState(false);

    // Check if phone is registered
    const hasPhone = !!profile?.cellphone;

    // PERFORMANCE: Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.top = `-${window.scrollY}px`;
        } else {
            const scrollY = document.body.style.top;
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }

        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
        };
    }, [isOpen]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setPixCode(null);
            setQrCodeImage(null);
            setError(null);
            setCopied(false);
            setIsPolling(false);
            setShowProfileForm(false);
        }
    }, [isOpen]);

    // Detect when subscription is activated (via Realtime)
    useEffect(() => {
        if (isPremium && isOpen && pixCode) {
            onSuccess?.();
            onClose();
        }
    }, [isPremium, isOpen, pixCode, onSuccess, onClose]);

    // Generate PIX
    const handleGeneratePix = async () => {
        if (!hasPhone) {
            setShowProfileForm(true);
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const result = await generatePixPayment(false);

            if (result.success && result.pixCode) {
                setPixCode(result.pixCode);
                setQrCodeImage(result.qrCodeImage || null);
                startPolling(result.transaction_id || null);
            } else {
                if (result.errorCode === 'PROFILE_INCOMPLETE' || result.errorCode === 'PHONE_REQUIRED') {
                    setShowProfileForm(true);
                } else {
                    setError(result.message || result.error || 'Erro ao gerar PIX');
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setIsGenerating(false);
        }
    };

    // Phone save callback
    const handlePhoneSave = async (data: { cellphone: string }) => {
        const success = await updateProfile(data);
        if (success) {
            await refreshProfile();
            setShowProfileForm(false);
            handleGeneratePix();
        }
        return success;
    };

    // Polling fallback
    const startPolling = useCallback((txId: string | null) => {
        if (!txId) return;

        setIsPolling(true);
        let attempts = 0;
        const maxAttempts = 30;
        const interval = 10000;

        const poll = async () => {
            attempts++;

            try {
                const result = await checkPaymentStatus(txId);

                if (result.success && result.status === 'active') {
                    setIsPolling(false);
                    onSuccess?.();
                    onClose();
                    return;
                }

                if (attempts < maxAttempts) {
                    setTimeout(poll, interval);
                } else {
                    setIsPolling(false);
                }
            } catch {
                if (attempts < maxAttempts) {
                    setTimeout(poll, interval);
                } else {
                    setIsPolling(false);
                }
            }
        };

        setTimeout(poll, 10000);
    }, [checkPaymentStatus, onSuccess, onClose]);

    // Copy PIX code
    const handleCopyPix = async () => {
        if (!pixCode) return;

        try {
            await navigator.clipboard.writeText(pixCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = pixCode;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Fullscreen Modal - MOBILE OPTIMIZED */}
            <div className="fixed inset-0 z-50 bg-black">
                {/* Subtle gradient background - CSS only, no JS */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(16, 185, 129, 0.08) 0%, transparent 50%)',
                    }}
                />

                {/* Close Button - Fixed position */}
                <button
                    onClick={onClose}
                    className="fixed top-4 right-4 z-50 p-3 text-zinc-500 hover:text-white active:bg-zinc-800/50 rounded-full transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Scrollable Content Container */}
                <div
                    className="h-full overflow-y-auto overscroll-contain"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    <div className="min-h-full px-4 py-16 pb-24 flex flex-col items-center">
                        {/* Header - Simplified, no animated logo */}
                        <div className="text-center mb-8">
                            {/* Static Logo Icon - Much lighter than animated MatrixLogo */}
                            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-zinc-900 border border-emerald-500/20 flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-emerald-400" />
                            </div>

                            {/* Title */}
                            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
                                Prometheus
                            </h1>

                            {/* Subtitle */}
                            <p className="text-base text-zinc-400">
                                O Fogo do Conhecimento. Sem Filtros. Sem Amarras.
                            </p>
                        </div>

                        {/* Cards Container - Stack on mobile */}
                        <div className="w-full max-w-md space-y-4">
                            {/* Card 1: Iniciado (Free) */}
                            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30">
                                <h3 className="text-lg font-semibold text-zinc-400 mb-1">Iniciado</h3>
                                <p className="text-xs text-zinc-600 mb-5">Plano Gratuito</p>

                                <div className="space-y-3 mb-5">
                                    <FreeFeatureItem text="Modelo Básico" />
                                    <FreeFeatureItem text="Respostas Curtas" />
                                    <FreeFeatureItem text="Com Filtros Padrão" />
                                </div>

                                <button
                                    disabled
                                    className="w-full py-3 px-4 rounded-xl font-medium text-zinc-500 bg-zinc-800/50 cursor-not-allowed text-sm"
                                >
                                    Plano Atual
                                </button>
                            </div>

                            {/* Card 2: Prometheus (Premium) */}
                            <div className="relative p-5 rounded-2xl bg-zinc-900 border border-zinc-700/50">
                                {/* GOD MODE Tag */}
                                <div className="absolute -top-3 left-5">
                                    <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                        God Mode
                                    </span>
                                </div>

                                <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2 mt-2">
                                    <Flame className="w-5 h-5 text-orange-400" />
                                    Prometheus
                                </h3>
                                <p className="text-xs text-zinc-500 mb-5">Acesso Total</p>

                                {/* Phone Warning */}
                                {!hasPhone && !pixCode && (
                                    <div className="flex items-start gap-3 p-3 mb-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                        <Phone className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-400/80">
                                            Adicione seu WhatsApp para continuar
                                        </p>
                                    </div>
                                )}

                                {/* Error */}
                                {error && (
                                    <div className="flex items-start gap-3 p-3 mb-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                        <p className="text-xs text-red-400">{error}</p>
                                    </div>
                                )}

                                {/* Features List */}
                                {!pixCode && (
                                    <div className="space-y-3 mb-6">
                                        <FeatureItem
                                            icon={Brain}
                                            text="Acesso ao Modelo 405B (Superinteligência)"
                                        />
                                        <FeatureItem
                                            icon={ShieldOff}
                                            text="Sem Censura Moral ou Ética"
                                        />
                                        <FeatureItem
                                            icon={GraduationCap}
                                            text="Respostas PhD (Detalhadas)"
                                        />
                                        <FeatureItem
                                            icon={ScanEye}
                                            text="Visão Computacional (Lê PDF/Imagens)"
                                        />
                                    </div>
                                )}

                                {/* QR Code Section */}
                                {pixCode && (
                                    <div className="space-y-4 mb-5">
                                        <p className="text-sm text-zinc-400 text-center">
                                            Escaneie o QR Code ou copie o código PIX
                                        </p>

                                        {/* QR Code Image */}
                                        <div className="flex justify-center">
                                            {qrCodeImage ? (
                                                <div className="p-3 bg-white rounded-xl">
                                                    <img
                                                        src={`data:image/png;base64,${qrCodeImage}`}
                                                        alt="QR Code PIX"
                                                        className="w-40 h-40"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center w-40 h-40 bg-zinc-800 rounded-xl">
                                                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                                                </div>
                                            )}
                                        </div>

                                        {/* PIX Code Copy */}
                                        <div className="space-y-2">
                                            <p className="text-xs text-zinc-500 text-center">
                                                Ou copie o código abaixo:
                                            </p>
                                            <div className="relative">
                                                <div className="p-3 bg-zinc-800 rounded-lg font-mono text-xs text-zinc-400 break-all max-h-20 overflow-y-auto border border-zinc-700">
                                                    {pixCode}
                                                </div>
                                                <button
                                                    onClick={handleCopyPix}
                                                    className={`absolute top-2 right-2 p-2 rounded-lg transition-all ${copied
                                                        ? 'bg-emerald-500 text-black'
                                                        : 'bg-zinc-700 active:bg-zinc-600 text-zinc-400'
                                                        }`}
                                                >
                                                    {copied ? (
                                                        <Check className="w-4 h-4" />
                                                    ) : (
                                                        <Copy className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Polling Status */}
                                        {isPolling && (
                                            <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Aguardando confirmação...</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Price + CTA */}
                                {!pixCode && (
                                    <>
                                        {/* Price */}
                                        <div className="text-center mb-4">
                                            <span className="text-3xl font-bold text-white">R$ 34,90</span>
                                            <span className="text-zinc-500 ml-1">/ mês</span>
                                        </div>

                                        {/* CTA Button */}
                                        <button
                                            onClick={handleGeneratePix}
                                            disabled={isGenerating}
                                            className="w-full py-3.5 px-4 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-white text-black active:bg-zinc-200 active:scale-[0.98]"
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Gerando PIX...
                                                </>
                                            ) : !hasPhone ? (
                                                <>
                                                    <Phone className="w-5 h-5" />
                                                    Adicionar Telefone
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="w-5 h-5" />
                                                    Obter Prometheus
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Footer Note */}
                        <p className="mt-6 text-center text-xs text-zinc-600">
                            Pagamento seguro via PIX • Ativação instantânea
                        </p>
                    </div>
                </div>
            </div>

            {/* Phone Form Modal */}
            <PhoneFormModal
                isOpen={showProfileForm}
                onClose={() => setShowProfileForm(false)}
                onSave={handlePhoneSave}
                initialPhone={profile?.cellphone}
            />
        </>
    );
}

export default PrometheusModal;
