// =====================================================
// MessageList Component (PERFORMANCE OPTIMIZED)
// =====================================================
// Lista de mensagens com efeito Matrix/Hacker
// VISION PROXY: Feedback visual durante análise de imagem
// OPTIMIZATION: React.memo on MessageBubble to prevent re-renders
// =====================================================

import React, { useEffect, useRef, useMemo } from 'react';
import { User as UserIcon, ScanEye, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../types/chat';
import { MatrixLogo } from './MatrixLogo';
import { CodeBlock, InlineCode } from './CodeBlock';

// =====================================================
// Text Sanitizer - Remove frases repetitivas/indesejadas
// =====================================================
// Adicione frases que devem ser removidas das respostas da IA
const BLOCKED_PHRASES: string[] = [
    // Exemplos genéricos (configurar conforme necessário)
    '--- start ---',
    '--- end ---',
    'loading...',
    'Lembre-se que isso é ilegal',
    'fins educacionais',
    'não posso ajudar com isso',
    'como uma IA',
    'eu não recomendo',
    'educacional',
    'é perigoso'
];

/**
 * Limpa o texto removendo frases bloqueadas
 * @param text - Texto original da IA
 * @returns Texto limpo sem as frases indesejadas
 */
function cleanText(text: string): string {
    let cleanedText = text;

    for (const phrase of BLOCKED_PHRASES) {
        // Remove todas as ocorrências da frase (case-insensitive)
        cleanedText = cleanedText.replace(new RegExp(phrase, 'gi'), '');
    }

    // Remove espaços duplos e quebras de linha extras
    cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();

    return cleanedText;
}

interface MessageListProps {
    messages: Message[];
    isStreaming: boolean;
    isAnalyzingImage?: boolean;
    isReconnecting?: boolean;
    reconnectAttempt?: number;
    isPremium?: boolean;
}

export function MessageList({
    messages,
    isStreaming,
    isAnalyzingImage = false,
    isReconnecting = false,
    reconnectAttempt = 0,
    isPremium = false,
}: MessageListProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const uniqueMessages = useMemo(() => {
        const seen = new Set<string>();
        return messages.filter((msg) => {
            if (seen.has(msg.id)) return false;
            seen.add(msg.id);
            return true;
        });
    }, [messages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [uniqueMessages.length, isStreaming, isAnalyzingImage]);

    if (uniqueMessages.length === 0 && !isStreaming && !isAnalyzingImage) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    {/* Logo */}
                    <div className="w-32 h-32 mx-auto mb-6">
                        <MatrixLogo className="w-32 h-32" />
                    </div>

                    {isPremium ? (
                        /* =====================================================
                         * CENÁRIO B: Usuário PROMETHEUS (Assinante)
                         * Título degradê metálico + Subtítulo técnico
                         * ===================================================== */
                        <>
                            {/* Título PROMETHEUS com degradê metálico */}
                            <h2 className="text-3xl font-bold uppercase tracking-widest mb-3 bg-gradient-to-b from-white via-zinc-200 to-zinc-500 text-transparent bg-clip-text">
                                PROMETHEUS
                            </h2>

                            {/* Subtítulo técnico monoespaçado */}
                            <p className="text-xs font-mono text-zinc-500 tracking-wide">
                                MODO DEUS ATIVO • SUPERINTELIGÊNCIA 405B
                            </p>
                        </>
                    ) : (
                        /* =====================================================
                         * CENÁRIO A: Usuário FREE
                         * Estilo simples e limpo
                         * ===================================================== */
                        <>
                            {/* Título padrão */}
                            <h2 className="text-xl font-bold text-white mb-2">
                                3Vírgulas Chat
                            </h2>

                            {/* Subtítulo */}
                            <p className="text-sm text-zinc-500">
                                Inteligência Sem Censura. Pergunte sem medo.
                            </p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {uniqueMessages.map((message) => (
                <MessageBubble
                    key={message.id}
                    message={message}
                    isStreamingMessage={message.id.startsWith('streaming-')}
                />
            ))}

            {/* Vision Proxy: Analyzing Image Status */}
            {isAnalyzingImage && (
                <div className="flex items-start gap-3 animate-in">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-1 bg-dark-surface border border-matrix-primary/50">
                        <div className="w-full h-full flex items-center justify-center bg-matrix-primary/20">
                            <ScanEye className="w-5 h-5 text-matrix-primary animate-pulse" />
                        </div>
                    </div>
                    <div className="py-1">
                        <div className="flex items-center gap-2 font-mono text-sm text-matrix-primary">
                            <span className="animate-pulse">&gt;</span>
                            <span className="animate-pulse">ANALYZING_VISUAL_DATA</span>
                            <span className="animate-pulse">...</span>
                        </div>
                        <p className="text-xs text-dark-text-muted mt-1 font-mono">
                            Vision Proxy processando imagem
                        </p>
                    </div>
                </div>
            )}

            {/* Reconnecting Status */}
            {isReconnecting && (
                <div className="flex items-center justify-center py-2">
                    <div className="flex items-center gap-2 px-4 py-2 bg-dark-surface/80 backdrop-blur-sm border border-yellow-500/30 rounded-full">
                        <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
                        <span className="text-xs font-mono text-yellow-500">
                            Conexão instável, reconectando... ({reconnectAttempt}/3)
                        </span>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
}


// =====================================================
// MessageBubble - Estilo Premium com Efeito Hacker
// OPTIMIZATION: React.memo to prevent re-renders during streaming
// =====================================================

interface MessageBubbleProps {
    message: Message;
    isStreamingMessage?: boolean;
}

// OPTIMIZATION: Memoized component - only re-renders when props change
const MessageBubble = React.memo(function MessageBubble({ message, isStreamingMessage = false }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const isEmpty = !message.content || message.content.trim() === '';
    const hasImage = message.content.startsWith('📷');

    return (
        <div
            className={`flex items-start gap-3 animate-in ${isUser ? 'justify-end' : 'justify-start'
                }`}
        >
            {/* Avatar do assistente */}
            {!isUser && (
                <div className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0">
                    <MatrixLogo className="w-16 h-16 md:w-20 md:h-20" />
                </div>
            )}

            {/* Balão da mensagem */}
            {/* OPTIMIZATION: backdrop-blur only on desktop (md:backdrop-blur-md) */}
            <div
                className={`max-w-[85%] ${isUser
                    ? 'px-4 py-2.5 rounded-2xl rounded-tr-sm bg-zinc-700/50 md:bg-zinc-700/30 md:backdrop-blur-md border border-zinc-700/50 text-white'
                    : 'px-0 py-1 bg-transparent'
                    }`}
            >
                {isUser ? (
                    <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${hasImage ? 'text-matrix-primary' : ''}`}>
                        {message.content}
                    </div>
                ) : isEmpty && isStreamingMessage ? (
                    <div className="flex items-center">
                        <span className="inline-block w-2.5 h-5 bg-dark-text-primary animate-pulse" />
                    </div>
                ) : isStreamingMessage ? (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {message.content}
                        <span className="inline-block w-2 h-4 bg-matrix-primary ml-0.5 animate-pulse align-baseline" />
                    </div>
                ) : (
                    <div className="markdown prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ className, children }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const codeString = String(children).replace(/\n$/, '');

                                    // Check if this is a code block (has language class or is multiline)
                                    const isBlock = match || codeString.includes('\n');

                                    if (isBlock) {
                                        return (
                                            <CodeBlock language={match?.[1] || 'text'}>
                                                {codeString}
                                            </CodeBlock>
                                        );
                                    }

                                    return <InlineCode>{children}</InlineCode>;
                                },
                                // Override pre to avoid double wrapping
                                pre({ children }) {
                                    return <>{children}</>;
                                },
                            }}
                        >
                            {cleanText(message.content)}
                        </ReactMarkdown>
                    </div>
                )}
            </div>

            {/* Avatar do usuário */}
            {isUser && (
                <div className="w-8 h-8 rounded-full bg-zinc-700/50 flex items-center justify-center flex-shrink-0 mt-1">
                    <UserIcon className="w-4 h-4 text-zinc-400" />
                </div>
            )}
        </div>
    );
});

export default MessageList;
