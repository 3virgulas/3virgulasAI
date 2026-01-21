// =====================================================
// MessageList Component
// =====================================================
// Lista de mensagens com efeito Matrix/Hacker
// VISION PROXY: Feedback visual durante análise de imagem
// =====================================================

import { useEffect, useRef, useMemo, useState } from 'react';
import { Bot, User as UserIcon, ScanEye, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Message } from '../types/chat';
import { useSettings } from '../contexts/SettingsContext';
import { MatrixTyper } from './MatrixTyper';

interface MessageListProps {
    messages: Message[];
    isStreaming: boolean;
    isAnalyzingImage?: boolean;
    isReconnecting?: boolean;
    reconnectAttempt?: number;
}

export function MessageList({
    messages,
    isStreaming,
    isAnalyzingImage = false,
    isReconnecting = false,
    reconnectAttempt = 0,
}: MessageListProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { settings } = useSettings();

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
            <div className="flex-1 flex items-center justify-center text-dark-text-muted">
                <div className="text-center max-w-md px-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-dark-surface border border-dark-border">
                        <AvatarImage src={settings.aiAvatarUrl} />
                    </div>
                    <h2 className="text-xl font-semibold text-dark-text-primary mb-2">
                        Bem-vindo ao 3Vírgulas Chat
                    </h2>
                    <p className="text-sm">
                        Um assistente de IA sem censura. Faça qualquer pergunta e receba
                        respostas honestas e diretas.
                    </p>
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
                    avatarUrl={settings.aiAvatarUrl}
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
// AvatarImage - Com fallback para ícone
// =====================================================

function AvatarImage({ src, size = 'md' }: { src: string; size?: 'sm' | 'md' }) {
    const [hasError, setHasError] = useState(false);

    const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-20 h-20';
    const iconSize = size === 'sm' ? 'w-5 h-5' : 'w-10 h-10';

    if (hasError || !src) {
        return (
            <div className={`${sizeClasses} flex items-center justify-center bg-matrix-primary`}>
                <Bot className={`${iconSize} text-dark-bg`} />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt="Avatar da IA"
            className={`${sizeClasses} object-cover`}
            onError={() => setHasError(true)}
        />
    );
}

// =====================================================
// MessageBubble - Estilo Premium com Efeito Hacker
// =====================================================

interface MessageBubbleProps {
    message: Message;
    isStreamingMessage?: boolean;
    avatarUrl: string;
}

function MessageBubble({ message, isStreamingMessage = false, avatarUrl }: MessageBubbleProps) {
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
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-1 bg-dark-surface border border-dark-border">
                    <AvatarImage src={avatarUrl} size="sm" />
                </div>
            )}

            {/* Balão da mensagem */}
            <div
                className={`max-w-[85%] ${isUser
                    ? 'px-4 py-2.5 rounded-2xl rounded-tr-sm bg-zinc-700/30 backdrop-blur-md border border-zinc-700/50 text-white'
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
                        <MatrixTyper
                            text={message.content}
                            isStreaming={true}
                        />
                    </div>
                ) : (
                    <div className="markdown prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                        >
                            {message.content}
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
}

export default MessageList;
