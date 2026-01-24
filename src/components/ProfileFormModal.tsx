// =====================================================
// PhoneFormModal - Modal para adicionar telefone
// =====================================================
// Solicita apenas o número de telefone antes de gerar PIX
// TRANSLATION PROTECTION: translate="no" to prevent React portal breaks
// =====================================================

import { useState } from 'react';
import { X, Phone, Loader2, AlertCircle } from 'lucide-react';

interface PhoneFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { cellphone: string }) => Promise<boolean>;
    initialPhone?: string | null;
}

// Formatar telefone enquanto digita
const formatPhone = (value: string): string => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
};

export function PhoneFormModal({
    isOpen,
    onClose,
    onSave,
    initialPhone
}: PhoneFormModalProps) {
    const [cellphone, setCellphone] = useState(initialPhone ? formatPhone(initialPhone) : '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePhoneChange = (value: string) => {
        setCellphone(formatPhone(value));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const cleanPhone = cellphone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            setError('Telefone inválido. Use formato (XX) XXXXX-XXXX');
            return;
        }

        setIsSaving(true);

        try {
            const success = await onSave({
                cellphone: cleanPhone,
            });

            if (success) {
                onClose();
            } else {
                setError('Erro ao salvar. Tente novamente.');
            }
        } catch {
            setError('Erro inesperado. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 notranslate"
            translate="no"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm bg-dark-surface border border-dark-border rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-dark-border">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-dark-text-muted hover:text-white hover:bg-dark-hover rounded-lg transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <h2 className="text-xl font-bold text-dark-text-primary flex items-center gap-2">
                        <Phone className="w-5 h-5 text-matrix-primary" />
                        Seu Telefone
                    </h2>
                    <p className="text-sm text-dark-text-muted mt-1">
                        Precisamos do seu WhatsApp para contato
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Telefone */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-dark-text-secondary">
                            Telefone (WhatsApp)
                        </label>
                        <input
                            type="tel"
                            value={cellphone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            placeholder="(11) 99999-9999"
                            className="w-full px-4 py-3 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:border-matrix-primary/50 transition-colors font-mono text-lg text-center"
                            autoFocus
                        />
                    </div>

                    {/* Erro */}
                    {error && (
                        <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-3.5 px-4 rounded-xl font-bold text-dark-bg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{
                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        }}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            'Continuar'
                        )}
                    </button>

                    <p className="text-center text-[10px] text-dark-text-muted">
                        Usamos apenas para suporte e novidades
                    </p>
                </form>
            </div>
        </div>
    );
}

export default PhoneFormModal;
