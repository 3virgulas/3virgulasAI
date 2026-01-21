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
import { generateChatTitle } from '../lib/openrouter';
import { env } from '../config/env';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { MobileHeader } from '../components/MobileHeader';
import { MessageList } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';
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
    const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const streamingContentRef = useRef('');
    const activeChatIdRef = useRef<string | undefined>(currentChatId);

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

    const { getSettings, refreshSettings } = useAppSettings();

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
    } = useOpenRouter({
        apiKey: env.OPENROUTER_API_KEY,
        onToken: (token) => {
            streamingContentRef.current += token;
            updateStreamingContent(streamingContentRef.current);
        },
        onComplete: async (fullResponse) => {
            const chatId = activeChatIdRef.current;

            if (chatId) {
                await addAssistantMessage(fullResponse, chatId);
            }

            streamingContentRef.current = '';

            const persistedMessages = messages.filter((m) => !m.id.startsWith('streaming-'));
            if (persistedMessages.length === 1 && chatId) {
                await autoGenerateTitle(chatId, persistedMessages[0].content);
            }
        },
        onError: (error) => {
            console.error('Erro no OpenRouter:', error);
            alert(`Erro: ${error.message}`);
            cancelStreaming();
            streamingContentRef.current = '';
            setIsAnalyzing(false);
        },
    });

    const isAdmin = user?.email === ADMIN_EMAIL;

    const handleNewChat = useCallback(async () => {
        const newChat = await createChat();
        if (newChat) {
            setCurrentChatId(newChat.id);
        }
    }, [createChat]);

    const handleSelectChat = useCallback((chatId: string) => {
        setCurrentChatId(chatId);
    }, []);

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
    // handleSendMessage - Vision Proxy Integration
    // =====================================================
    const handleSendMessage = useCallback(
        async (content: string, imageBase64?: string) => {
            await refreshSettings();
            const { selected_model, system_instruction, vision_model } = getSettings();

            let activeChatId = currentChatId;

            // Criar chat se não existir
            if (!activeChatId) {
                const initialTitle = generateInitialTitle(content || 'Análise de Imagem');
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

            // ===== VISION PROXY FLOW =====
            let finalContent = content;

            if (imageBase64) {
                try {
                    setIsAnalyzing(true);

                    // Fase 1: Modelo de Visão analisa a imagem
                    const visualDescription = await analyzeImage(imageBase64, vision_model);

                    // Fase 2: Formatar mensagem para IA principal
                    if (visualDescription) {
                        finalContent = `[SYSTEM INFO: The user attached an image. Visual Description: "${visualDescription}"]\n\nUser Question: "${content || 'Descreva esta imagem'}"`;
                    }

                    setIsAnalyzing(false);
                } catch (error) {
                    console.error('Erro na análise de imagem:', error);
                    setIsAnalyzing(false);
                    // Continuar mesmo sem descrição visual
                    finalContent = content || 'Descreva esta imagem';
                }
            }

            // Salvar mensagem do usuário (texto original, não o formatado)
            const displayContent = imageBase64
                ? `📷 ${content || '[Imagem anexada]'}`
                : content;

            const userMessage = await addUserMessage(displayContent, activeChatId);
            if (!userMessage) {
                console.error('Falha ao salvar mensagem do usuário');
                return;
            }

            // Iniciar streaming
            startStreaming(activeChatId);
            streamingContentRef.current = '';

            // Preparar histórico para API (usar conteúdo formatado com descrição visual)
            const persistedMessages = messages.filter((m) => !m.id.startsWith('streaming-'));
            const apiMessages = persistedMessages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            // Adicionar a mensagem atual com descrição visual
            apiMessages.push({
                role: 'user' as const,
                content: finalContent,
            });

            try {
                await sendMessage(apiMessages, {
                    model: selected_model,
                    systemPrompt: system_instruction,
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
        ]
    );

    const autoGenerateTitle = async (chatId: string, firstMessage: string) => {
        try {
            setIsGeneratingTitle(true);
            const { selected_model } = getSettings();
            const title = await generateChatTitle(env.OPENROUTER_API_KEY, firstMessage, selected_model);
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
        setIsAnalyzing(false);
    }, [abortStream, cancelStreaming]);

    // Combinar estados de loading
    const isProcessing = isStreaming || messagesStreaming || isAnalyzing || isAnalyzingImage;

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
                    isAnalyzingImage={isAnalyzing || isAnalyzingImage}
                    isReconnecting={isReconnecting}
                    reconnectAttempt={reconnectAttempt}
                />

                {/* ChatInput com padding extra para safe area no mobile */}
                <div className="pb-4 md:pb-0">
                    <ChatInput
                        onSendMessage={handleSendMessage}
                        onStop={handleStop}
                        isStreaming={isProcessing}
                        disabled={messagesLoading}
                    />
                </div>
            </div>
        </div>
    );
}

export default ChatPage;
