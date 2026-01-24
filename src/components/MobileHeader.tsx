// =====================================================
// MobileHeader - Header fixo para dispositivos móveis
// =====================================================
// Visível apenas em telas pequenas (md:hidden)
// Estilo: Prometheus Minimalist - Vidro escuro, ícones neutros
// =====================================================

import { Menu, Plus } from 'lucide-react';
import { MatrixLogo } from './MatrixLogo';

interface MobileHeaderProps {
    onMenuClick: () => void;
    onNewChat: () => void;
    currentChatTitle?: string;
}

export function MobileHeader({ onMenuClick, onNewChat }: MobileHeaderProps) {
    return (
        <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-black/80 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-4">
            {/* Esquerda: Botão Hambúrguer */}
            <button
                onClick={onMenuClick}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                aria-label="Abrir menu"
            >
                <Menu className="w-6 h-6" />
            </button>

            {/* Centro: Logo Minimalista */}
            <div className="flex-1 flex items-center justify-center">
                <MatrixLogo className="w-8 h-8" />
            </div>

            {/* Direita: Novo Chat */}
            <button
                onClick={onNewChat}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                aria-label="Novo chat"
            >
                <Plus className="w-6 h-6" />
            </button>
        </header>
    );
}

export default MobileHeader;
