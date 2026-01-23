// =====================================================
// Sidebar - Dark Prometheus Control Panel
// =====================================================
// Desktop (md:): Sempre visível, posição relativa
// Mobile: Drawer (gaveta) com overlay e transição
// Estética: Painel de controle avançado (cinza/preto)
// =====================================================

import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Trash2, LogOut, Loader2, X, User } from 'lucide-react';
import { Chat } from '../types/chat';
import { PrometheusCard } from './PremiumCard';

interface SidebarProps {
    chats: Chat[];
    currentChatId?: string;
    onSelectChat: (chatId: string) => void;
    onNewChat: () => void;
    onDeleteChat: (chatId: string) => void;
    onLogout: () => void;
    loading?: boolean;
    // Premium props
    isPremium?: boolean;
    onUpgrade?: () => void;
    // Mobile drawer props
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({
    chats,
    currentChatId,
    onSelectChat,
    onNewChat,
    onDeleteChat,
    onLogout,
    loading,
    isPremium = false,
    onUpgrade,
    isOpen = true,
    onClose,
}: SidebarProps) {
    const navigate = useNavigate();

    const handleDelete = (e: React.MouseEvent, chatId: string) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja excluir esta conversa?')) {
            onDeleteChat(chatId);
        }
    };

    const handleSelectChat = (chatId: string) => {
        onSelectChat(chatId);
        onClose?.();
    };

    const handleNewChat = () => {
        onNewChat();
        onClose?.();
    };

    return (
        <>
            {/* Backdrop/Overlay - apenas mobile */}
            <div
                className={`
                    md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm
                    transition-opacity duration-300
                    ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                `}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sidebar - Dark Control Panel */}
            <aside
                className={`
                    w-64 h-full bg-black border-r border-zinc-800/50 flex flex-col flex-shrink-0
                    
                    /* Mobile: Fixed drawer com transição */
                    fixed inset-y-0 left-0 z-50
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                    
                    /* Desktop: Posição relativa, sempre visível */
                    md:relative md:translate-x-0 md:z-auto
                `}
            >
                {/* Header Section */}
                <div className="p-3 space-y-2">
                    {/* Mobile Close Button */}
                    <div className="flex items-center justify-end md:hidden">
                        <button
                            onClick={onClose}
                            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                            aria-label="Fechar menu"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Prometheus Card - TOP POSITION (apenas para não-assinantes) */}
                    {!isPremium && onUpgrade && (
                        <PrometheusCard onUpgrade={onUpgrade} />
                    )}

                    {/* New Chat Button - Redesigned */}
                    <div className="px-2">
                        <button
                            onClick={handleNewChat}
                            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:bg-zinc-800 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] active:scale-[0.98] border border-zinc-800 hover:border-zinc-700"
                        >
                            <Plus className="w-4 h-4" />
                            Nova Conversa
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="mx-4 border-t border-zinc-800/50" />

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                        </div>
                    ) : chats.length === 0 ? (
                        <div className="text-center p-4 text-zinc-600 text-sm">
                            Nenhuma conversa ainda.
                        </div>
                    ) : (
                        chats.map((chat) => (
                            <div
                                key={chat.id}
                                onClick={() => handleSelectChat(chat.id)}
                                className={`group flex items-center gap-3 w-full p-3 rounded-lg cursor-pointer transition-all ${currentChatId === chat.id
                                    ? 'bg-zinc-800/80 text-white border-l-2 border-zinc-400'
                                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                                    }`}
                            >
                                <MessageSquare className={`w-4 h-4 flex-shrink-0 ${currentChatId === chat.id ? 'text-zinc-300' : 'opacity-50'}`} />
                                <span className="flex-1 text-sm truncate">{chat.title}</span>
                                <button
                                    onClick={(e) => handleDelete(e, chat.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-400 rounded transition-all"
                                    title="Excluir conversa"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-zinc-800/50">
                    <button
                        onClick={() => navigate('/profile')}
                        className="flex items-center gap-2 w-full p-2.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition-all text-sm"
                    >
                        <User className="w-4 h-4" />
                        Meu Perfil
                    </button>
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 w-full p-2.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition-all text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair
                    </button>
                    <div className="mt-3 text-center">
                        <p className="text-[9px] text-zinc-600 uppercase tracking-[0.15em] font-mono">
                            3Vírgulas • Prometheus
                        </p>
                    </div>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
