// =====================================================
// PrometheusModal - Fullscreen Premium Subscription Modal
// =====================================================
// RESPONSIVE VERSION:
// - Desktop: Original layout with MatrixLogo, animations, 2-column grid
// - Mobile: Optimized layout without heavy animations
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
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
    Flame
} from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { PhoneFormModal } from './ProfileFormModal';
import { MatrixLogo } from './MatrixLogo';

interface PrometheusModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onSuccess?: () => void;
}

// Matrix Rain Character Component - DESKTOP ONLY
function MatrixRainChar({ delay, left }: { delay: number; left: number }) {
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ';
    const [char, setChar] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            setChar(chars[Math.floor(Math.random() * chars.length)]);
        }, 100);
        return () => clearInterval(interval);
    }, []);

    return (
        <span
            className="absolute text-xs font-mono opacity-20 text-emerald-500 pointer-events-none animate-fall"
            style={{
                left: `${left}%`,
                animationDelay: `${delay}s`,
                animationDuration: '3s',
            }}
        >
            {char}
        </span>
    );
}

// Feature Item with Matrix-style bullet
function FeatureItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
    return (
        <div className="flex items-center gap-3 group">
            <div className="flex-shrink-0 w-6 h-6 md:w-7 md:h-7 rounded flex items-center justify-center bg-zinc-800/50 group-hover:bg-zinc-700/50 transition-colors">
                <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500/80" />
            </div>
            <span className="text-sm text-zinc-300 group-hover:text-zinc-200 transition-colors">
                {text}
            </span>
        </div>
    );
}

// Free tier feature item
function FreeFeatureItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-6 h-6 md:w-7 md:h-7 rounded flex items-center justify-center bg-zinc-800/30">
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

    // Matrix rain characters - DESKTOP ONLY
    const rainChars = useRef(
        Array.from({ length: 20 }, (_, i) => ({
            id: i,
            delay: Math.random() * 5,
            left: Math.random() * 100
        }))
    ).current;

    // Check if phone is registered
    const hasPhone = !!profile?.cellphone;

    // MOBILE: Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            // Only apply body lock on mobile
            const isMobile = window.innerWidth < 768;
            if (isMobile) {
                document.body.style.overflow = 'hidden';
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
                document.body.style.top = `-${window.scrollY}px`;
            }
        } else {
            const scrollY = document.body.style.top;
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
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
            {/* Fullscreen Overlay - TRANSLATION PROTECTION */}
            <div
                className="fixed inset-0 z-50 bg-black overflow-y-auto md:overflow-y-auto notranslate"
                translate="no"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {/* Subtle Spotlight Effect - DESKTOP */}
                <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none hidden md:block"
                    style={{
                        background: 'radial-gradient(ellipse at center top, rgba(63, 63, 70, 0.15) 0%, transparent 60%)',
                    }}
                />

                {/* Mobile gradient - simpler */}
                <div
                    className="absolute inset-0 pointer-events-none md:hidden"
                    style={{
                        background: 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(16, 185, 129, 0.08) 0%, transparent 50%)',
                    }}
                />

                {/* Matrix Rain Background - DESKTOP ONLY */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30 hidden md:block">
                    {rainChars.map((rain) => (
                        <MatrixRainChar key={rain.id} delay={rain.delay} left={rain.left} />
                    ))}
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="fixed top-4 right-4 md:top-6 md:right-6 z-50 p-3 text-zinc-500 hover:text-white hover:bg-zinc-800/50 active:bg-zinc-800/50 rounded-full transition-all duration-200"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Content Container */}
                <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16 pb-24 md:pb-16">
                    {/* =====================================================
                     * HEADER
                     * Desktop: MatrixLogo animada
                     * Mobile: Apenas título com degradê metálico
                     * ===================================================== */}
                    <div className="text-center mb-8 md:mb-12">
                        {/* Mobile: Spacer only */}
                        <div className="h-16 mb-5 md:hidden" />

                        {/* Desktop: MatrixLogo */}
                        <div className="hidden md:block w-24 h-24 mx-auto mb-6">
                            <MatrixLogo className="w-full h-full" />
                        </div>

                        {/* Title - Different styles for mobile/desktop */}
                        {/* Mobile: Metallic gradient */}
                        <h1 className="md:hidden text-3xl font-bold uppercase tracking-widest mb-3 bg-gradient-to-b from-white via-zinc-200 to-zinc-600 text-transparent bg-clip-text">
                            PROMETHEUS
                        </h1>
                        {/* Desktop: Original white */}
                        <h1 className="hidden md:block text-4xl md:text-5xl font-bold text-white tracking-tight mb-3">
                            Prometheus
                        </h1>

                        {/* Subtitle */}
                        <p className="text-base md:text-lg text-zinc-400 font-light">
                            O Fogo do Conhecimento. Sem Filtros. Sem Amarras.
                        </p>
                    </div>

                    {/* =====================================================
                     * CARDS CONTAINER
                     * Desktop: Grid 2 colunas
                     * Mobile: Stack vertical
                     * ===================================================== */}
                    <div className="w-full max-w-md md:max-w-4xl space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6 mb-8">
                        {/* Card 1: Iniciado (Free) */}
                        <div className="relative p-5 md:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 md:bg-transparent">
                            <h3 className="text-lg md:text-xl font-semibold text-zinc-400 mb-1">Iniciado</h3>
                            <p className="text-xs md:text-sm text-zinc-600 mb-5 md:mb-6">Plano Gratuito</p>

                            <div className="space-y-3 md:space-y-4 mb-5 md:mb-8">
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
                        <div
                            className="relative p-5 md:p-6 rounded-2xl bg-zinc-900 md:bg-[#111] border border-zinc-700/50 md:border-zinc-800/50"
                            style={{
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 80px -20px rgba(16, 185, 129, 0.1)',
                            }}
                        >
                            {/* GOD MODE Tag */}
                            <div className="absolute -top-3 left-5 md:left-6">
                                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                    God Mode
                                </span>
                            </div>

                            <h3 className="text-lg md:text-xl font-semibold text-white mb-1 flex items-center gap-2 mt-2">
                                <Flame className="w-5 h-5 text-orange-400" />
                                Prometheus
                            </h3>
                            <p className="text-xs md:text-sm text-zinc-500 mb-5 md:mb-6">Acesso Total</p>

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
                                <div className="space-y-3 mb-6 md:mb-8">
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
                                <div className="space-y-4 mb-5 md:mb-6">
                                    <p className="text-sm text-zinc-400 text-center">
                                        Escaneie o QR Code ou copie o código PIX
                                    </p>

                                    {/* QR Code Image */}
                                    <div className="flex justify-center">
                                        {qrCodeImage ? (
                                            <div className="p-3 md:p-4 bg-white rounded-xl">
                                                <img
                                                    src={`data:image/png;base64,${qrCodeImage}`}
                                                    alt="QR Code PIX"
                                                    className="w-40 h-40 md:w-48 md:h-48"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center w-40 h-40 md:w-48 md:h-48 bg-zinc-800 rounded-xl">
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
                                            <div className="p-3 bg-zinc-900 md:bg-zinc-900 rounded-lg font-mono text-xs text-zinc-400 break-all max-h-20 overflow-y-auto border border-zinc-800">
                                                {pixCode}
                                            </div>
                                            <button
                                                onClick={handleCopyPix}
                                                className={`absolute top-2 right-2 p-2 rounded-lg transition-all ${copied
                                                    ? 'bg-emerald-500 text-black'
                                                    : 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-400'
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
                                        className="w-full py-3.5 px-4 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-100 active:scale-[0.98]"
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
                    <p className="text-center text-xs text-zinc-600">
                        Pagamento seguro via PIX • Ativação instantânea
                    </p>
                </div>
            </div>

            {/* Phone Form Modal */}
            <PhoneFormModal
                isOpen={showProfileForm}
                onClose={() => setShowProfileForm(false)}
                onSave={handlePhoneSave}
                initialPhone={profile?.cellphone}
            />

            {/* CSS Animations - DESKTOP ONLY */}
            <style>{`
                @keyframes fall {
                    0% {
                        transform: translateY(-100vh);
                        opacity: 0;
                    }
                    10% {
                        opacity: 0.3;
                    }
                    90% {
                        opacity: 0.3;
                    }
                    100% {
                        transform: translateY(100vh);
                        opacity: 0;
                    }
                }
                .animate-fall {
                    animation: fall linear infinite;
                }
            `}</style>
        </>
    );
}

export default PrometheusModal;
