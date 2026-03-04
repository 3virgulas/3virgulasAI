// =====================================================
// ThinkingBlock — Colapsável "🧠 Ver raciocínio"
// =====================================================
// Exibe o conteúdo interno <think> do Hermes-4.
// Disponível para todos os usuários (starter e premium).
// Durante o streaming: mostra "Raciocinando..." animado.
// Após completar: colapsável com o raciocínio completo.
// =====================================================

import { useState, useEffect, useRef } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface ThinkingBlockProps {
    thinking: string;      // Conteúdo do <think>
    isStreaming: boolean;  // Ainda está gerando?
}

export function ThinkingBlock({ thinking, isStreaming }: ThinkingBlockProps) {
    const [isOpen, setIsOpen] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Auto-abre durante streaming para dar feedback visual
    useEffect(() => {
        if (isStreaming && thinking.length > 0) {
            setIsOpen(true);
        }
    }, [isStreaming, thinking.length]);

    // Mantém aberto se o raciocínio for substancial (> 50 palavras)
    useEffect(() => {
        if (!isStreaming && thinking.length > 0) {
            const words = thinking.trim().split(/\s+/).filter(Boolean).length;
            if (words < 50) {
                const timer = setTimeout(() => setIsOpen(false), 1200);
                return () => clearTimeout(timer);
            }
            // Raciocínio substancial: mantém aberto para o usuário ver
        }
    }, [isStreaming, thinking]);

    // Auto-scroll durante streaming
    useEffect(() => {
        if (isOpen && isStreaming && contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [thinking, isOpen, isStreaming]);

    if (!thinking && !isStreaming) return null;

    const wordCount = thinking.trim().split(/\s+/).filter(Boolean).length;

    return (
        <div className="mb-3 rounded-xl border border-violet-500/25 bg-violet-950/20 overflow-hidden transition-all duration-300">
            {/* Header — clicável */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-violet-500/10 transition-colors duration-200 group"
            >
                {/* Ícone com pulso durante streaming */}
                <div className={`w-5 h-5 flex-shrink-0 ${isStreaming ? 'animate-pulse' : ''}`}>
                    <Brain className="w-5 h-5 text-violet-400" />
                </div>

                {/* Label + contagem */}
                <div className="flex-1 min-w-0">
                    {isStreaming ? (
                        <span className="text-xs font-mono text-violet-400 flex items-center gap-1.5">
                            <span className="animate-pulse">Raciocinando</span>
                            <span className="flex gap-0.5">
                                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                        </span>
                    ) : (
                        <span className="text-xs font-mono text-violet-400">
                            🧠 Ver raciocínio
                            {wordCount > 0 && (
                                <span className="ml-2 text-violet-500/70">
                                    {(() => {
                                        const stepCount = thinking.match(/\d+\.\s|Etapa|Step|Passo|INTENT|SCOPE|STRUCTURE|GAPS|DEEP INTENT|KNOWLEDGE|MULTI-ANGLE|ANTI-GAPS/gi)?.length ?? 0;
                                        return stepCount > 1 ? `${stepCount} etapas • ` : '';
                                    })()}{wordCount} palavras
                                </span>
                            )}
                        </span>
                    )}
                </div>

                {/* Chevron */}
                {!isStreaming && (
                    <div className="flex-shrink-0 text-violet-500/60 group-hover:text-violet-400 transition-colors">
                        {isOpen
                            ? <ChevronUp className="w-3.5 h-3.5" />
                            : <ChevronDown className="w-3.5 h-3.5" />
                        }
                    </div>
                )}
            </button>

            {/* Conteúdo expansível */}
            {isOpen && (
                <div
                    ref={contentRef}
                    className={`
                        px-3.5 pb-3 pt-0.5
                        max-h-52 overflow-y-auto
                        border-t border-violet-500/15
                        ${isStreaming ? 'scroll-smooth' : ''}
                    `}
                    style={{ scrollBehavior: isStreaming ? 'smooth' : 'auto' }}
                >
                    <pre className="text-xs text-violet-300/70 font-mono whitespace-pre-wrap break-words leading-relaxed mt-2">
                        {thinking || '…'}
                    </pre>
                </div>
            )}
        </div>
    );
}

export default ThinkingBlock;
