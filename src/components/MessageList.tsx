// =====================================================
// MessageList Component (PERFORMANCE OPTIMIZED)
// =====================================================
// Clean Terminal Style - 100% content focused
// VISION PROXY: Feedback visual durante análise de imagem
// OPTIMIZATION: React.memo on MessageBubble to prevent re-renders
// =====================================================

import React, { useEffect, useRef, useMemo } from 'react';
import { ScanEye, RefreshCw, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../types/chat';

import { CodeBlock, InlineCode } from './CodeBlock';
import { ThinkingBlock } from './ThinkingBlock';
import { FollowupChips } from './FollowupChips';

// BLOCKED_PHRASES removido — o modelélo já tem instruções explícitas
// para não gerar conteúdo moralizável no system prompt nuclear v3.
// Filtrar a saída aqui causaria perda de conteúdo legítimo.

interface MessageListProps {
    messages: Message[];
    isStreaming: boolean;
    isAnalyzingImage?: boolean;
    isReconnecting?: boolean;
    reconnectAttempt?: number;
    isPremium?: boolean;
    isDeepResearching?: boolean;
    currentThinking?: string;
    followups?: string[];
    isLoadingFollowups?: boolean;
    onFollowupSelect?: (question: string) => void;
    messageImages?: Record<string, string[]>;
}

export function MessageList({
    messages,
    isStreaming,
    isAnalyzingImage = false,
    isReconnecting = false,
    reconnectAttempt = 0,
    isPremium = false,
    isDeepResearching = false,
    currentThinking = '',
    followups = [],
    isLoadingFollowups = false,
    onFollowupSelect,
    messageImages = {},
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

    // ID da última mensagem da IA (para exibir Acompanhamentos)
    const lastAiMessageId = useMemo(() => {
        const aiMessages = uniqueMessages.filter(m => m.role === 'assistant' && !m.id.startsWith('streaming-'));
        return aiMessages[aiMessages.length - 1]?.id ?? null;
    }, [uniqueMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [uniqueMessages.length, isStreaming, isAnalyzingImage]);

    if (uniqueMessages.length === 0 && !isStreaming && !isAnalyzingImage) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    {/* Logo */}
                    <div className="w-32 h-32 mx-auto mb-6">
                        <img src="/vought.png" alt="Logo" className="w-32 h-32 object-contain" />
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
                                VOUGHT
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
                    thinkingContent={message.id.startsWith('streaming-') ? currentThinking : ''}
                    isThinkingStreaming={message.id.startsWith('streaming-') ? isStreaming : false}
                    showFollowups={message.id === lastAiMessageId && !isStreaming}
                    followups={followups}
                    isLoadingFollowups={isLoadingFollowups}
                    onFollowupSelect={onFollowupSelect}
                    imageUrls={messageImages[message.id] ?? []}
                />
            ))}



            {/* Deep Research Status */}
            {isDeepResearching && !isAnalyzingImage && (
                <div className="flex items-start gap-3 animate-in">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-1 bg-slate-700/20 flex items-center justify-center">
                        <div className="w-full h-full flex items-center justify-center bg-slate-700/30 animate-pulse">
                            <Globe className="w-5 h-5 text-slate-500 animate-pulse" />
                        </div>
                    </div>
                    <div className="py-1">
                        <div className="flex items-center gap-2 font-mono text-sm text-slate-500">
                            <span className="animate-pulse">&gt;</span>
                            <span className="animate-pulse">DEEP_RESEARCH_PROTOCOL</span>
                            <span className="animate-pulse">...</span>
                        </div>
                        <p className="text-xs text-dark-text-muted mt-1 font-mono">
                            Varrendo a Surface Web em tempo real...
                        </p>
                    </div>
                </div>
            )}

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

            {/* SPACER FOR FIXED INPUT */}
            <div className="h-32 md:h-48 flex-shrink-0" />

            <div ref={messagesEndRef} />
        </div>
    );
}


// =====================================================
// MessageBubble - Clean Terminal Style (NO AVATARS)
// =====================================================
// Layout focado 100% no conteúdo
// IA: Fundo transparente, alinhado à esquerda
// Usuário: Fundo cinza escuro, alinhado à direita
// OPTIMIZATION: React.memo to prevent re-renders during streaming
// =====================================================

interface MessageBubbleProps {
    message: Message;
    isStreamingMessage?: boolean;
    thinkingContent?: string;
    isThinkingStreaming?: boolean;
    showFollowups?: boolean;
    followups?: string[];
    isLoadingFollowups?: boolean;
    onFollowupSelect?: (q: string) => void;
    imageUrls?: string[];
}

// OPTIMIZATION: Memoized component - only re-renders when props change
// Extrai conteúdo para exibição amigável a partir do finalContent armazenado no banco.
// O banco agora guarda o finalContent completo (com [SYSTEM INFO:...] ou [CONTEXTO DO ARQUIVO...])
// para que a API sempre veja o contexto visual/documental em turnos futuros.
function parseDisplayContent(content: string): { display: string; isImage: boolean; isDocument: boolean } {
    // Mensagem de imagem: "[SYSTEM INFO: ...Visual Description...] \n\nUser Question: \"...\""
    if (content.startsWith('[SYSTEM INFO:') && content.includes('User Question:')) {
        const match = content.match(/User Question:\s*"([\s\S]*?)"\s*$/);
        const question = match?.[1]?.trim() || '[Imagem anexada]';
        return { display: `📷 ${question}`, isImage: true, isDocument: false };
    }
    // Mensagem de documento: "[CONTEXTO DO ARQUIVO 'nome']..."
    if (content.startsWith('[CONTEXTO DO ARQUIVO')) {
        const fileMatch = content.match(/\[CONTEXTO DO ARQUIVO '(.+?)'\]/);
        const fileName = fileMatch?.[1] || 'arquivo';
        const questionMatch = content.match(/Pergunta do usuário:\s*([\s\S]+)$/);
        const question = questionMatch?.[1]?.trim() || '';
        return { display: `📄 ${fileName}${question ? `\n${question}` : ''}`, isImage: false, isDocument: true };
    }
    // Mensagem normal (texto / deep research)
    return { display: content, isImage: false, isDocument: false };
}

const MessageBubble = React.memo(function MessageBubble({
    message,
    isStreamingMessage = false,
    thinkingContent = '',
    isThinkingStreaming = false,
    showFollowups = false,
    followups = [],
    isLoadingFollowups = false,
    onFollowupSelect,
    imageUrls = [],
}: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const isEmpty = !message.content || message.content.trim() === '';
    const { display: displayContent, isImage, isDocument } = parseDisplayContent(message.content);
    const hasImage = isImage || isDocument;

    return (
        <div
            className={`flex flex-col animate-in ${isUser ? 'items-end' : 'items-start'}`}
        >
            {/* Images rendered OUTSIDE and ABOVE the bubble */}
            {isUser && imageUrls.length > 0 && (
                <div className={`flex flex-wrap gap-2 mb-2 max-w-[90%] md:max-w-[85%] ${imageUrls.length === 1 ? 'justify-end' : 'justify-end'}`}>
                    {imageUrls.map((src, idx) => (
                        <img
                            key={idx}
                            src={src}
                            alt={`Imagem ${idx + 1}`}
                            className="max-h-48 max-w-[200px] rounded-2xl object-cover border border-zinc-700/50 shadow-lg"
                        />
                    ))}
                </div>
            )}

            {/* Message bubble */}
            <div
                className={`max-w-[90%] md:max-w-[85%] ${isUser
                    ? 'px-4 py-2.5 rounded-2xl rounded-tr-sm bg-zinc-800 border border-zinc-700/50 text-white'
                    : 'px-1 py-1 bg-transparent text-zinc-100 w-full'
                    }`}
            >
                {/* ThinkingBlock — apenas para mensagens da IA */}
                {!isUser && (thinkingContent || isThinkingStreaming) && (
                    <ThinkingBlock
                        thinking={thinkingContent}
                        isStreaming={isThinkingStreaming}
                    />
                )}
                {isUser ? (
                    <div>
                        <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${hasImage ? 'text-matrix-primary' : ''}`}>
                            {displayContent}
                        </div>
                    </div>
                ) : isEmpty && isStreamingMessage ? (
                    <div className="flex items-center">
                        <span className="inline-block w-2.5 h-5 bg-zinc-400 animate-pulse" />
                    </div>
                ) : isStreamingMessage ? (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {message.content}
                        <span className="inline-block w-2 h-4 bg-zinc-400 ml-0.5 animate-pulse align-baseline" />
                    </div>
                ) : (
                    <div className="markdown prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ className, children }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const codeString = String(children).replace(/\n$/, '');
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
                                pre({ children }) {
                                    return <>{children}</>;
                                },
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>

                        {/* Acompanhamentos — exibir na última mensagem da IA */}
                        {showFollowups && (
                            <FollowupChips
                                followups={followups}
                                isLoading={isLoadingFollowups}
                                onSelect={(q) => onFollowupSelect?.(q)}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

export default MessageList;
