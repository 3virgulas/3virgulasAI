// =====================================================
// PrometheusCard - Elite Sidebar CTA
// =====================================================
// Dark God Mode - Compact but impactful
// Features: GOD MODE tag + Flame icon + Clean layout
// =====================================================

import { Flame } from 'lucide-react';

interface PrometheusCardProps {
    onUpgrade: () => void;
}

export function PrometheusCard({ onUpgrade }: PrometheusCardProps) {
    return (
        <div className="px-2">
            <div
                onClick={onUpgrade}
                className="relative overflow-hidden rounded-lg p-3 cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] group bg-gradient-to-b from-zinc-900 to-black border border-zinc-800 hover:border-zinc-700"
                style={{
                    boxShadow: '0 4px 20px -8px rgba(0, 0, 0, 0.8)',
                }}
            >
                {/* Subtle inner glow on hover */}
                <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-lg"
                    style={{
                        background: 'radial-gradient(ellipse at 50% 0%, rgba(251, 146, 60, 0.08) 0%, transparent 60%)',
                    }}
                />

                {/* Content */}
                <div className="relative z-10">
                    {/* Top Row: GOD MODE tag + Flame */}
                    <div className="flex items-center gap-1.5 mb-2">
                        <Flame className="w-3 h-3 text-orange-400/80" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-orange-400/70">
                            God Mode
                        </span>
                    </div>

                    {/* Main Row: PROMETHEUS + Action */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-300">
                            Prometheus
                        </span>
                        <span className="text-[10px] text-zinc-500 group-hover:text-orange-400/80 transition-colors duration-300">
                            Ativar →
                        </span>
                    </div>
                </div>

                {/* Decorative ember glow (bottom right) */}
                <div
                    className="absolute -bottom-2 -right-2 w-16 h-16 opacity-20 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none"
                    style={{
                        background: 'radial-gradient(circle, rgba(251, 146, 60, 0.4) 0%, transparent 70%)',
                    }}
                />
            </div>
        </div>
    );
}

// Keep backwards compatibility
export const PremiumCard = PrometheusCard;

export default PrometheusCard;
