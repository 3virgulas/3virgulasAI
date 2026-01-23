// =====================================================
// PremiumCard - Card promocional na Sidebar
// =====================================================
// Exibe CTA para upgrade Premium quando usuário não é assinante
// Design Matrix com gradiente verde e animação
// =====================================================

import { Zap, Crown } from 'lucide-react';

interface PremiumCardProps {
    onUpgrade: () => void;
}

export function PremiumCard({ onUpgrade }: PremiumCardProps) {
    return (
        <div className="mx-2 mb-2">
            <div
                onClick={onUpgrade}
                className="relative overflow-hidden rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group"
                style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.1) 50%, rgba(5, 150, 105, 0.15) 100%)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                }}
            >
                {/* Efeito de brilho animado */}
                <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                        background: 'linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.1), transparent)',
                        animation: 'shimmer 2s infinite',
                    }}
                />

                {/* Conteúdo */}
                <div className="relative z-10">
                    {/* Header com ícone */}
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-matrix-primary/20">
                            <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        </div>
                        <span className="text-xs font-bold text-matrix-primary uppercase tracking-wider">
                            Premium
                        </span>
                    </div>

                    {/* Título */}
                    <h3 className="text-sm font-bold text-dark-text-primary mb-1 flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-yellow-400" />
                        EVOLUA PARA O PREMIUM
                    </h3>

                    {/* Descrição */}
                    <p className="text-xs text-dark-text-muted mb-3 leading-relaxed">
                        IA de elite sem censura, respostas mais rápidas e completas
                    </p>

                    {/* CTA */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-matrix-primary font-mono">
                            R$ 34,90/mês
                        </span>
                        <span className="text-xs text-matrix-primary font-medium group-hover:translate-x-1 transition-transform">
                            Assinar →
                        </span>
                    </div>
                </div>

                {/* Decoração de fundo */}
                <div
                    className="absolute -bottom-4 -right-4 w-20 h-20 opacity-5"
                    style={{
                        background: 'radial-gradient(circle, rgba(34, 197, 94, 1) 0%, transparent 70%)',
                    }}
                />
            </div>

            {/* CSS para animação shimmer */}
            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}

export default PremiumCard;
