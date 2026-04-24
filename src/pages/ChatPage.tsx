// =====================================================
// ChatPage - Página principal do chat
// =====================================================
// Integra Sidebar, MessageList e ChatInput com AuthContext
// VISION PROXY: Suporta análise de imagens com modelo dedicado
// =====================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChats } from '../hooks/useChats';
import { useMessages } from '../hooks/useMessages';
import { useOpenRouter } from '../hooks/useOpenRouter';
import { useAppSettings } from '../hooks/useAppSettings';
import { useSubscription } from '../hooks/useSubscription';
import { useMemory } from '../hooks/useMemory';
import { useRAG } from '../hooks/useRAG';
import { useFollowups } from '../hooks/useFollowups';
import { generateChatTitle } from '../lib/openrouter';
import { supabase } from '../lib/supabase';
import { env } from '../config/env';
import type { OpenRouterMessage } from '../types/chat';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { MobileHeader } from '../components/MobileHeader';
import { MessageList } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';
import { PrometheusModal } from '../components/PrometheusModal';
import { GuestAuthModal } from '../components/GuestAuthModal';
import { Settings } from 'lucide-react';

const ADMIN_EMAIL = 'contato@3virgulas.com';

function generateInitialTitle(content: string, maxWords = 5): string {
    const words = content.trim().split(/\s+/);
    const truncated = words.slice(0, maxWords).join(' ');
    return truncated.length > 50 ? truncated.slice(0, 47) + '...' : truncated || 'Nova Conversa';
}

export function ChatPage() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [currentChatId, setCurrentChatId] = useState<string | undefined>();
    const [_isGeneratingTitle, setIsGeneratingTitle] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showPrometheusModal, setShowPrometheusModal] = useState(false);
    const [showGuestModal, setShowGuestModal] = useState(false);
    const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
    const [isSearchingWeb, setIsSearchingWeb] = useState(false);
    // Imagens associadas a mensagens — armazenadas localmente para exibição no chat
    // (não vão ao banco — são apenas para UI deste session)
    const [messageImages, setMessageImages] = useState<Record<string, string[]>>({});

    const streamingContentRef = useRef('');
    const activeChatIdRef = useRef<string | undefined>(currentChatId);
    const hasSentPendingRef = useRef(false);

    const {
        chats,
        loading: chatsLoading,
        createChat,
        deleteChat,
        refreshChats,
        updateChatTitle,
    } = useChats(user?.id);

    const {
        messages,
        loading: messagesLoading,
        addUserMessage,
        addAssistantMessage,
        startStreaming,
        updateStreamingContent,
        cancelStreaming,
        isStreaming: messagesStreaming,
    } = useMessages(currentChatId);

    // Ref sempre atualizada para evitar stale closure dentro de onComplete
    const messagesRef = useRef(messages);
    useEffect(() => {
        messagesRef.current = messages;
    });

    const { getSettings, getPremiumSettings, refreshSettings } = useAppSettings();

    // Hook de assinatura Premium
    const { isPremium, loading: isLoadingSubscription } = useSubscription(user?.id);

    // Hook de Acompanhamentos (Follow-ups) do Skynet
    const { generateFollowups, followups, isLoadingFollowups, clearFollowups } = useFollowups();

    // Hook de memória persistente (Level 2)
    const { saveMemory } = useMemory({
        onMemorySaved: () => console.log('[Memory] 🧠 Memória da conversa salva!'),
    });

    // Hook RAG semântico (Level 3)
    const { embedMessages } = useRAG();

    useEffect(() => {
        activeChatIdRef.current = currentChatId;
    }, [currentChatId]);



    const {
        sendMessage,
        analyzeImage,
        isStreaming,
        isAnalyzingImage,
        isReconnecting,
        reconnectAttempt,
        abortStream,
        currentThinking,
    } = useOpenRouter({
        apiKey: env.VENICE_API_KEY,
        onToken: (token) => {
            streamingContentRef.current += token;
            updateStreamingContent(streamingContentRef.current);
        },
        onComplete: async (fullResponse, thinkingContent) => {
            const chatId = activeChatIdRef.current;

            if (chatId) {
                await addAssistantMessage(fullResponse, chatId);
            }

            streamingContentRef.current = '';

            if (thinkingContent) {
                console.log(`[Thinking] 💡 ${thinkingContent.length} chars de raciocínio interno`);
            }

            // RAG Level 3: embeddar user message + resposta da IA (fire-and-forget)
            const lastUserMsg = messagesRef.current
                .filter(m => m.role === 'user' && !m.id.startsWith('streaming-'))
                .slice(-1)[0];

            if (lastUserMsg?.content && fullResponse) {
                embedMessages(
                    [
                        { role: 'user', content: lastUserMsg.content },
                        { role: 'assistant', content: fullResponse },
                    ],
                    chatId
                );
            }

            // Geração de perguntas de "Acompanhamentos" (assíncrono fire-and-forget)
            if (lastUserMsg?.content && fullResponse) {
                generateFollowups(lastUserMsg.content, fullResponse);
            }

            const persistedMessages = messagesRef.current.filter((m) => !m.id.startsWith('streaming-'));
            if (persistedMessages.length === 1 && chatId) {
                await autoGenerateTitle(chatId, persistedMessages[0].content);
            }
        },
        onError: (error) => {
            console.error('Erro no OpenRouter:', error);
            alert(`Erro: ${error.message}`);
            cancelStreaming();
            streamingContentRef.current = '';
        },
    });

    const isAdmin = user?.email === ADMIN_EMAIL;

    const handleNewChat = useCallback(async () => {
        // Salvar memória da conversa atual antes de abrir nova (silencioso)
        if (messages.length >= 6) {
            const apiMessages = messages
                .filter(m => !m.id.startsWith('streaming-'))
                .map(m => ({ role: m.role, content: m.content }));
            saveMemory(apiMessages);
        }
        const newChat = await createChat();
        if (newChat) {
            setCurrentChatId(newChat.id);
        }
    }, [createChat, messages, saveMemory]);

    const handleSelectChat = useCallback((chatId: string) => {
        // Salvar memória da conversa atual antes de trocar (silencioso)
        if (chatId !== currentChatId && messages.length >= 6) {
            const apiMessages = messages
                .filter(m => !m.id.startsWith('streaming-'))
                .map(m => ({ role: m.role, content: m.content }));
            saveMemory(apiMessages);
        }
        setCurrentChatId(chatId);
    }, [currentChatId, messages, saveMemory]);

    const handleDeleteChat = useCallback(
        async (chatId: string) => {
            await deleteChat(chatId);
            if (chatId === currentChatId) {
                setCurrentChatId(undefined);
            }
        },
        [deleteChat, currentChatId]
    );

    // =====================================================
    // handleToggleWebSearch - Ativa/Desativa Deep Research
    // =====================================================
    const handleToggleWebSearch = useCallback(() => {
        if (!isPremium) {
            setShowPrometheusModal(true);
            return;
        }
        setIsWebSearchEnabled(prev => !prev);
    }, [isPremium]);

    // =====================================================
    // handleSendMessage - Vision Proxy & Deep Research Integration
    // =====================================================
    const handleSendMessage = useCallback(
        async (content: string, imagesBase64?: string[], parsedFile?: import('../lib/fileParser').ParsedFile) => {
            // Limpa chips de follow-up imediatamente ao iniciar novo prompt
            clearFollowups();
            // INTERCEPTOR: Se não estiver logado, salvar mensagem e pedir login
            if (!user) {
                // Salvar mensagem pendente
                const pendingData = {
                    content,
                    imagesBase64,
                    parsedFile
                };
                sessionStorage.setItem('pending_message', JSON.stringify(pendingData));
                setShowGuestModal(true);
                return;
            }

            await refreshSettings();

            // Usar configurações Premium se for assinante ativo
            const settings = isPremium ? getPremiumSettings() : getSettings();
            const { selected_model, system_instruction } = settings;

            let activeChatId = currentChatId;

            // Criar chat se não existir
            if (!activeChatId) {
                const initialTitle = generateInitialTitle(
                    content || parsedFile?.fileName || 'Análise de Imagem'
                );
                const newChat = await createChat(initialTitle);
                if (!newChat) {
                    console.error('Falha ao criar novo chat');
                    return;
                }
                activeChatId = newChat.id;
                setCurrentChatId(activeChatId);
                activeChatIdRef.current = activeChatId;
                await refreshChats();
            }

            // ===== DEEP RESEARCH FLOW =====
            let searchContext = '';
            if (isWebSearchEnabled) {
                try {
                    setIsSearchingWeb(true);
                    console.log('Modo Deep Research Ativo: Buscando dados...');

                    const { data, error } = await supabase.functions.invoke('deep-research', {
                        body: { query: content }
                    });

                    console.log("🔍 [DEBUG] Resposta Deep Research:", data);

                    if (error) {
                        const isLimitError = error && (
                            error.code === 403 ||
                            error.context?.response?.status === 403 ||
                            (error.message && error.message.includes('Limite')) ||
                            (error.message && error.message.includes('300'))
                        );

                        if (isLimitError) {
                            alert("Você atingiu seu limite de 300 pesquisas mensais.");
                            setIsWebSearchEnabled(false);
                        }

                        throw error;
                    }

                    if (data && data.context) {
                        searchContext = data.context;
                    }
                } catch (err) {
                    console.error('Deep Search failed:', err);
                } finally {
                    setIsSearchingWeb(false);
                }
            }

            // ===== VISION DIRECT MULTIMODAL / DOCUMENT FLOW =====
            let finalContent = content;
            const hasImages = imagesBase64 && imagesBase64.length > 0;

            if (hasImages) {
                finalContent = content || 'Descreva esta imagem';
            } else if (parsedFile) {
                const { formatFileContentForAI } = await import('../lib/fileParser');
                finalContent = formatFileContentForAI(parsedFile, content);
            }

            const userMessage = await addUserMessage(finalContent, activeChatId);
            if (!userMessage) {
                console.error('Falha ao salvar mensagem do usuário');
                return;
            }

            // Associar imagens à mensagem para exibição local
            if (hasImages && userMessage?.id) {
                setMessageImages(prev => ({ ...prev, [userMessage.id]: imagesBase64! }));
            }

            // Iniciar streaming
            startStreaming(activeChatId);
            streamingContentRef.current = '';

            const persistedMessages = messages.filter((m) => !m.id.startsWith('streaming-'));
            const apiMessages: OpenRouterMessage[] = persistedMessages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            if (hasImages) {
                const imageContent = imagesBase64!.map(url => ({ type: 'image_url' as const, image_url: { url } }));
                const multimodalMsg: OpenRouterMessage = {
                    role: 'user',
                    content: [
                        ...imageContent,
                        { type: 'text', text: searchContext ? `${finalContent}\n\n${searchContext}` : finalContent },
                    ],
                };
                apiMessages.push(multimodalMsg);
            } else {
                apiMessages.push({
                    role: 'user' as const,
                    content: searchContext ? `${finalContent}\n\n${searchContext}` : finalContent,
                });
            }

            try {
                await sendMessage(apiMessages, {
                    model: selected_model,
                    systemPrompt: system_instruction,
                    isPremium, // Ativa modo detalhado para Premium
                    chatId: activeChatId, // Escopo RAG: busca semântica apenas neste chat
                });
            } catch (error) {
                console.error('Erro ao enviar mensagem:', error);
                cancelStreaming();
                streamingContentRef.current = '';
            }
        },
        [
            currentChatId,
            messages,
            createChat,
            addUserMessage,
            startStreaming,
            cancelStreaming,
            sendMessage,
            analyzeImage,
            refreshSettings,
            getSettings,
            refreshChats,
            isPremium,
            isWebSearchEnabled,
        ]
    );

    const autoGenerateTitle = async (chatId: string, firstMessage: string) => {
        try {
            setIsGeneratingTitle(true);
            const { selected_model } = getSettings();
            const title = await generateChatTitle(env.VENICE_API_KEY, firstMessage, selected_model);
            await updateChatTitle(chatId, title);
        } catch (error) {
            console.error('Erro ao gerar título:', error);
        } finally {
            setIsGeneratingTitle(false);
        }
    };

    const handleStop = useCallback(() => {
        abortStream();
        cancelStreaming();
        streamingContentRef.current = '';
    }, [abortStream, cancelStreaming]);

    // =====================================================
    // AUTO-SEND: Verificar mensagem pendente após login
    // =====================================================
    useEffect(() => {
        const pendingMsg = sessionStorage.getItem('pending_message');

        // O Portão de Segurança:
        // Só entra se o usuário existe, se tem mensagem E (CRUCIAL) se a assinatura JÁ CARREGOU (!loading).
        if (user && pendingMsg && !hasSentPendingRef.current && !isLoadingSubscription) {
            try {
                // 1. TRAVA IMEDIATAMENTE para evitar disparos duplos
                hasSentPendingRef.current = true;

                // 2. Limpa o storage AGORA (antes mesmo de enviar)
                sessionStorage.removeItem('pending_message');

                // 3. Recupera dados e envia
                const { content, imagesBase64, parsedFile } = JSON.parse(pendingMsg);

                // Pequeno delay para garantir que tudo carregou
                setTimeout(() => {
                    handleSendMessage(content, imagesBase64, parsedFile);
                }, 500);
            } catch (e) {
                console.error('Erro ao recuperar mensagem pendente', e);
            }
        }
    }, [user, handleSendMessage, isLoadingSubscription]);

    // Combinar estados de loading
    const isProcessing = isStreaming || messagesStreaming || isAnalyzingImage || isSearchingWeb;

    // Obter título do chat atual para o header mobile
    const currentChatTitle = chats.find((c) => c.id === currentChatId)?.title;

    return (
        <div className="h-screen flex bg-dark-bg">
            {/* Mobile Header - visível apenas em mobile */}
            <MobileHeader
                onMenuClick={() => setIsSidebarOpen(true)}
                onNewChat={handleNewChat}
                currentChatTitle={currentChatTitle}
            />

            {/* Sidebar - drawer no mobile, fixo no desktop */}
            <Sidebar
                chats={chats}
                currentChatId={currentChatId}
                onSelectChat={handleSelectChat}
                onNewChat={handleNewChat}
                onDeleteChat={handleDeleteChat}
                onLogout={signOut}
                loading={chatsLoading}
                isPremium={isPremium}
                isGuest={!user}
                onUpgrade={() => setShowPrometheusModal(true)}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            {/* Área principal do chat */}
            <div className="flex-1 flex flex-col overflow-hidden w-full pt-14 md:pt-0">
                {isAdmin && (
                    <div className="flex-shrink-0 p-2 border-b border-dark-border bg-dark-surface/50">
                        <button
                            onClick={() => navigate('/admin')}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs text-dark-text-muted hover:text-matrix-primary hover:bg-dark-hover rounded-lg transition-all font-mono"
                        >
                            <Settings className="w-4 h-4" />
                            Admin
                        </button>
                    </div>
                )}

                <MessageList
                    messages={messages}
                    isStreaming={isProcessing}
                    isAnalyzingImage={isAnalyzingImage}
                    isReconnecting={isReconnecting}
                    reconnectAttempt={reconnectAttempt}
                    isPremium={isPremium}
                    isDeepResearching={isSearchingWeb}
                    currentThinking={currentThinking}
                    followups={followups}
                    isLoadingFollowups={isLoadingFollowups}
                    messageImages={messageImages}
                    onFollowupSelect={(q) => {
                        // Quando clica em um "Acompanhamento", envia como nova mensagem
                        handleSendMessage(q);
                    }}
                />

                {/* ChatInput com padding extra para safe area no mobile */}
                <div className="pb-4 md:pb-0">
                    <ChatInput
                        onSendMessage={handleSendMessage}
                        onStop={handleStop}
                        isStreaming={isProcessing}
                        disabled={messagesLoading}
                        isWebSearchEnabled={isWebSearchEnabled}
                        onToggleWebSearch={handleToggleWebSearch}
                    />
                </div>
            </div>

            {/* Modal Prometheus */}
            {user && (
                <PrometheusModal
                    isOpen={showPrometheusModal}
                    onClose={() => setShowPrometheusModal(false)}
                    userId={user.id}
                    onSuccess={() => {
                        setShowPrometheusModal(false);
                        alert('🔥 PROMETHEUS ATIVADO! O fogo do conhecimento é seu.');
                    }}
                />
            )}

            {/* Modal Guest Auth */}
            <GuestAuthModal
                isOpen={showGuestModal}
                onClose={() => setShowGuestModal(false)}
            />
        </div>
    );
}

export default ChatPage;
