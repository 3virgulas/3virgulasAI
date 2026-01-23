// =====================================================
// Sidebar - Navegação lateral responsiva
// =====================================================
// Desktop (md:): Sempre visível, posição relativa
// Mobile: Drawer (gaveta) com overlay e transição
// =====================================================

import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Trash2, LogOut, Loader2, X, User } from 'lucide-react';
import { Chat } from '../types/chat';
import { PremiumCard } from './PremiumCard';

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
        // Fecha a sidebar no mobile após selecionar um chat
        onClose?.();
    };

    const handleNewChat = () => {
        onNewChat();
        // Fecha a sidebar no mobile após criar novo chat
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

            {/* Sidebar */}
            <aside
                className={`
                    w-64 h-full bg-dark-bg border-r border-dark-border flex flex-col flex-shrink-0
                    
                    /* Mobile: Fixed drawer com transição */
                    fixed inset-y-0 left-0 z-50
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                    
                    /* Desktop: Posição relativa, sempre visível */
                    md:relative md:translate-x-0 md:z-auto
                `}
            >
                {/* Header com botão de fechar (mobile only) */}
                <div className="p-4 flex items-center justify-between md:justify-center">
                    <button
                        onClick={handleNewChat}
                        className="flex-1 flex items-center justify-center gap-2 bg-transparent border border-matrix-primary text-matrix-primary py-3 px-4 rounded-lg font-medium transition-all hover:bg-matrix-primary/10 hover:shadow-[0_0_15px_rgba(34,197,94,0.15)] active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Novo Chat
                    </button>

                    {/* Botão fechar - apenas mobile */}
                    <button
                        onClick={onClose}
                        className="md:hidden ml-3 p-2 text-dark-text-muted hover:text-matrix-primary hover:bg-dark-hover rounded-lg transition-all"
                        aria-label="Fechar menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="w-5 h-5 animate-spin text-matrix-primary" />
                        </div>
                    ) : chats.length === 0 ? (
                        <div className="text-center p-4 text-dark-text-muted text-sm">
                            Nenhuma conversa ainda.
                        </div>
                    ) : (
                        chats.map((chat) => (
                            <div
                                key={chat.id}
                                onClick={() => handleSelectChat(chat.id)}
                                className={`group flex items-center gap-3 w-full p-3 rounded-lg cursor-pointer transition-all ${currentChatId === chat.id
                                    ? 'bg-matrix-primary/10 text-matrix-primary border-l-2 border-matrix-primary'
                                    : 'text-dark-text-secondary hover:bg-dark-hover hover:text-dark-text-primary'
                                    }`}
                            >
                                <MessageSquare className={`w-4 h-4 flex-shrink-0 ${currentChatId === chat.id ? 'text-matrix-primary' : 'opacity-50'}`} />
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

                {/* Premium Card - apenas para não-premium */}
                {!isPremium && onUpgrade && (
                    <PremiumCard onUpgrade={onUpgrade} />
                )}

                {/* Footer */}
                <div className="p-4 border-t border-dark-border">
                    <button
                        onClick={() => navigate('/profile')}
                        className="flex items-center gap-2 w-full p-2 text-dark-text-muted hover:text-dark-text-primary hover:bg-dark-hover rounded-lg transition-all text-sm mb-1"
                    >
                        <User className="w-4 h-4" />
                        Meu Perfil
                    </button>
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 w-full p-2 text-dark-text-muted hover:text-red-400 hover:bg-dark-hover rounded-lg transition-all text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair da Conta
                    </button>
                    <div className="mt-3 text-center">
                        <p className="text-[10px] text-matrix-primary/50 uppercase tracking-widest font-mono">
                            3Vírgulas • Uncensored
                        </p>
                    </div>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;

