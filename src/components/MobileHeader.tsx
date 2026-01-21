// =====================================================
// MobileHeader - Header fixo para dispositivos móveis
// =====================================================
// Visível apenas em telas pequenas (md:hidden)
// Contém: Menu hambúrguer, Logo, Novo Chat
// =====================================================

import { Menu, Plus, MessageCircle } from 'lucide-react';

interface MobileHeaderProps {
    onMenuClick: () => void;
    onNewChat: () => void;
    currentChatTitle?: string;
}

export function MobileHeader({ onMenuClick, onNewChat, currentChatTitle }: MobileHeaderProps) {
    return (
        <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-dark-bg border-b border-matrix-primary/30 flex items-center justify-between px-4">
            {/* Esquerda: Botão Hambúrguer */}
            <button
                onClick={onMenuClick}
                className="p-2 text-dark-text-secondary hover:text-matrix-primary hover:bg-dark-hover rounded-lg transition-all"
                aria-label="Abrir menu"
            >
                <Menu className="w-6 h-6" />
            </button>

            {/* Centro: Logo ou Título */}
            <div className="flex-1 flex items-center justify-center gap-2 min-w-0 px-2">
                <MessageCircle className="w-5 h-5 text-matrix-primary flex-shrink-0" />
                <span className="text-sm font-mono text-dark-text-primary truncate">
                    {currentChatTitle || '3Vírgulas'}
                </span>
            </div>

            {/* Direita: Novo Chat */}
            <button
                onClick={onNewChat}
                className="p-2 text-matrix-primary hover:bg-matrix-primary/10 rounded-lg transition-all"
                aria-label="Novo chat"
            >
                <Plus className="w-6 h-6" />
            </button>
        </header>
    );
}

export default MobileHeader;
