// =====================================================
// PremiumPaymentModal - Modal de pagamento PIX
// =====================================================
// Modal completo para assinatura Premium via PIX
// Inclui verificação de perfil, geração de QR Code e Realtime updates
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import {
    X,
    Zap,
    Bot,
    Sparkles,
    Eye,
    Loader2,
    Copy,
    Check,
    AlertCircle,
    Crown,
    Phone
} from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { PhoneFormModal } from './ProfileFormModal';

interface PremiumPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onSuccess?: () => void;
}

export function PremiumPaymentModal({
    isOpen,
    onClose,
    userId,
    onSuccess
}: PremiumPaymentModalProps) {
    const {
        profile,
        isPremium,
        generatePixPayment,
        checkPaymentStatus,
        updateProfile,
        refreshProfile
    } = useSubscription(userId);

    // Estados do pagamento
    const [isGenerating, setIsGenerating] = useState(false);
    const [pixCode, setPixCode] = useState<string | null>(null);
    const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [showProfileForm, setShowProfileForm] = useState(false);

    // Verificar se tem telefone cadastrado (único campo obrigatório agora)
    const hasPhone = !!profile?.cellphone;

    // Resetar estado quando modal fecha
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

    // Detectar quando assinatura é ativada (via Realtime)
    useEffect(() => {
        if (isPremium && isOpen && pixCode) {
            // Pagamento confirmado!
            onSuccess?.();
            onClose();
        }
    }, [isPremium, isOpen, pixCode, onSuccess, onClose]);

    // Gerar PIX
    const handleGeneratePix = async () => {
        // Verificar se tem telefone primeiro
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

                // Iniciar polling como fallback
                startPolling(result.transaction_id || null);
            } else {
                // Verificar se é erro de telefone faltando
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

    // Callback quando telefone é salvo
    const handlePhoneSave = async (data: { cellphone: string }) => {
        const success = await updateProfile(data);
        if (success) {
            await refreshProfile();
            setShowProfileForm(false);
            // Agora gera PIX automaticamente
            handleGeneratePix();
        }
        return success;
    };

    // Polling fallback (intervalo maior para evitar rate limiting)
    const startPolling = useCallback((txId: string | null) => {
        if (!txId) return;

        setIsPolling(true);
        let attempts = 0;
        const maxAttempts = 30; // 5 minutos com intervalo de 10s
        const interval = 10000; // 10 segundos

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

        // Primeira verificação após 10s
        setTimeout(poll, 10000);
    }, [checkPaymentStatus, onSuccess, onClose]);

    // Copiar código PIX
    const handleCopyPix = async () => {
        if (!pixCode) return;

        try {
            await navigator.clipboard.writeText(pixCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback para browsers antigos
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
            {/* Modal Container - TRANSLATION PROTECTION */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 notranslate" translate="no">
                {/* Backdrop */}
                {/* PERFORMANCE: Fundo sólido sem blur */}
                <div
                    className="absolute inset-0 bg-black/90"
                    onClick={onClose}
                />

                {/* Modal */}
                <div className="relative w-full max-w-md bg-dark-surface border border-dark-border rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header com gradiente */}
                    <div
                        className="relative p-6 pb-4"
                        style={{
                            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
                        }}
                    >
                        {/* Botão fechar */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-dark-text-muted hover:text-white hover:bg-dark-hover rounded-lg transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Título */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-matrix-primary/20">
                                <Zap className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-dark-text-primary flex items-center gap-2">
                                    <Crown className="w-5 h-5 text-yellow-400" />
                                    PREMIUM
                                </h2>
                                <p className="text-sm text-matrix-primary font-mono">
                                    R$ 34,90/mês
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="p-6 pt-4 space-y-5">
                        {/* Aviso de telefone faltando */}
                        {!hasPhone && !pixCode && (
                            <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                <Phone className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-yellow-200 font-medium">
                                        Adicione seu telefone
                                    </p>
                                    <p className="text-xs text-yellow-200/70">
                                        Precisamos do seu WhatsApp para continuar
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Vantagens */}
                        {!pixCode && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-dark-text-secondary uppercase tracking-wide">
                                    Vantagens Premium
                                </h3>

                                <div className="space-y-2.5">
                                    <div className="flex items-start gap-3 p-3 bg-dark-hover/50 rounded-lg">
                                        <Bot className="w-5 h-5 text-matrix-primary flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-dark-text-primary">
                                                Modelo de IA de Elite
                                            </p>
                                            <p className="text-xs text-dark-text-muted">
                                                Sem censura total, respostas sem restrições
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 bg-dark-hover/50 rounded-lg">
                                        <Sparkles className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-dark-text-primary">
                                                Respostas Mais Rápidas
                                            </p>
                                            <p className="text-xs text-dark-text-muted">
                                                Prioridade no processamento de mensagens
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 bg-dark-hover/50 rounded-lg">
                                        <Eye className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-dark-text-primary">
                                                Visão Computacional Avançada
                                            </p>
                                            <p className="text-xs text-dark-text-muted">
                                                Análise de imagens detalhada e precisa
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Erro */}
                        {error && (
                            <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        {/* QR Code */}
                        {pixCode && (
                            <div className="space-y-4">
                                <div className="text-center">
                                    <p className="text-sm text-dark-text-secondary mb-3">
                                        Escaneie o QR Code ou copie o código PIX
                                    </p>

                                    {/* QR Code Image */}
                                    {qrCodeImage ? (
                                        <div className="inline-block p-4 bg-white rounded-xl">
                                            <img
                                                src={`data:image/png;base64,${qrCodeImage}`}
                                                alt="QR Code PIX"
                                                className="w-48 h-48"
                                            />
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center justify-center w-48 h-48 bg-dark-hover rounded-xl">
                                            <Loader2 className="w-8 h-8 animate-spin text-matrix-primary" />
                                        </div>
                                    )}
                                </div>

                                {/* Código PIX (copia e cola) */}
                                <div className="space-y-2">
                                    <p className="text-xs text-dark-text-muted text-center">
                                        Ou copie o código abaixo:
                                    </p>
                                    <div className="relative">
                                        <div className="p-3 bg-dark-hover rounded-lg font-mono text-xs text-dark-text-secondary break-all max-h-20 overflow-y-auto">
                                            {pixCode}
                                        </div>
                                        <button
                                            onClick={handleCopyPix}
                                            className={`absolute top-2 right-2 p-2 rounded-lg transition-all ${copied
                                                ? 'bg-matrix-primary text-dark-bg'
                                                : 'bg-dark-surface hover:bg-dark-border text-dark-text-muted'
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

                                {/* Status de polling */}
                                {isPolling && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-dark-text-muted">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Aguardando confirmação do pagamento...</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Botão de ação */}
                        {!pixCode && (
                            <button
                                onClick={handleGeneratePix}
                                disabled={isGenerating}
                                className="w-full py-3.5 px-4 rounded-xl font-bold text-dark-bg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                style={{
                                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                }}
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
                                        <Zap className="w-5 h-5 fill-current" />
                                        Gerar PIX de R$ 34,90
                                    </>
                                )}
                            </button>
                        )}

                        {/* Nota de segurança */}
                        <p className="text-center text-[10px] text-dark-text-muted">
                            Pagamento processado via PIX • SuitPay
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal de Telefone */}
            <PhoneFormModal
                isOpen={showProfileForm}
                onClose={() => setShowProfileForm(false)}
                onSave={handlePhoneSave}
                initialPhone={profile?.cellphone}
            />
        </>
    );
}

export default PremiumPaymentModal;
