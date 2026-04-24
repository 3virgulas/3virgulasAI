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
        <div className="mb-3 overflow-hidden transition-all duration-300">
            {/* Header — clicável */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center gap-2 px-1 py-1.5 text-left transition-colors duration-200 group"
            >
                {/* Ícone com pulso durante streaming */}
                <div className={`w-4 h-4 flex-shrink-0 ${isStreaming ? 'animate-pulse' : ''}`}>
                    <Brain className="w-4 h-4 text-slate-500" />
                </div>

                {/* Label + contagem */}
                <div className="flex-1 min-w-0">
                    {isStreaming ? (
                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                            <span className="animate-pulse">Raciocinando</span>
                            <span className="flex gap-0.5">
                                <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                        </span>
                    ) : (
                        <span className="text-xs font-mono text-slate-500 group-hover:text-slate-400 transition-colors">
                            Ver raciocínio
                            {wordCount > 0 && (
                                <span className="ml-2 text-slate-600">
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
                    <div className="flex-shrink-0 text-slate-600 group-hover:text-slate-400 transition-colors">
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
                        px-1 pb-3 pt-0.5
                        max-h-52 overflow-y-auto
                        border-t border-slate-700/30
                        ${isStreaming ? 'scroll-smooth' : ''}
                    `}
                    style={{ scrollBehavior: isStreaming ? 'smooth' : 'auto' }}
                >
                    <pre className="text-xs text-slate-600 font-mono whitespace-pre-wrap break-words leading-relaxed mt-2">
                        {thinking || '…'}
                    </pre>
                </div>
            )}
        </div>
    );
}

export default ThinkingBlock;
