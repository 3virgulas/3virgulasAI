// =====================================================
// FollowupChips v2 — "Acompanhamentos"
// 5 perguntas com ícones temáticos por tipo
// Mecanismo | Caso prático | Risco | Alternativa | Aprofundamento
// =====================================================

import { Loader2, Cog, Target, AlertTriangle, Shuffle, Layers } from 'lucide-react';

const FOLLOWUP_ICONS = [Cog, Target, AlertTriangle, Shuffle, Layers];

interface FollowupChipsProps {
    followups: string[];
    isLoading: boolean;
    onSelect: (question: string) => void;
}

export function FollowupChips({ followups, isLoading, onSelect }: FollowupChipsProps) {
    if (!isLoading && followups.length === 0) return null;

    return (
        <div className="mt-4 pt-3 border-t border-zinc-800/60">
            {/* Label */}
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-matrix-primary/60 inline-block" />
                Acompanhamentos
            </p>

            {/* Loading state */}
            {isLoading && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="font-mono">Gerando perguntas...</span>
                </div>
            )}

            {/* Chips com ícones diferenciados */}
            {!isLoading && followups.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    {followups.map((question, idx) => {
                        const Icon = FOLLOWUP_ICONS[idx] ?? Layers;
                        return (
                            <button
                                key={idx}
                                onClick={() => onSelect(question)}
                                className="
                                    group flex items-center gap-2 text-left
                                    px-3 py-2 rounded-lg
                                    border border-zinc-800/70 hover:border-matrix-primary/40
                                    bg-zinc-900/40 hover:bg-matrix-primary/5
                                    text-xs text-zinc-400 hover:text-zinc-200
                                    transition-all duration-200
                                    cursor-pointer
                                "
                            >
                                <Icon className="w-3.5 h-3.5 flex-shrink-0 text-zinc-600 group-hover:text-matrix-primary transition-colors duration-200" />
                                <span className="leading-snug">{question}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default FollowupChips;
