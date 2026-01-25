import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { MatrixLogo } from './MatrixLogo';

interface GuestAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function GuestAuthModal({ isOpen, onClose }: GuestAuthModalProps) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleLogin = () => {
        navigate('/auth');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with heavy blur */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-zinc-900/90 border border-white/10 rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-matrix-primary/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="text-center space-y-6 relative z-10">
                    {/* Icon */}
                    <div className="w-16 h-16 mx-auto bg-zinc-800/50 rounded-2xl flex items-center justify-center border border-white/5">
                        <Lock className="w-8 h-8 text-matrix-primary" />
                    </div>

                    {/* Text */}
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white tracking-tight">
                            Salve sua jornada
                        </h2>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            Para receber a resposta da IA e continuar essa conversa, você precisa de uma conta segura.
                        </p>
                        <p className="text-xs text-emerald-400 font-mono tracking-wider flex items-center justify-center gap-2">
                            GRÁTIS E ANÔNIMO
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3 pt-4">
                        <button
                            onClick={handleLogin}
                            className="w-full group flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Entrar / Criar Conta
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                            onClick={onClose}
                            className="text-xs text-zinc-500 hover:text-white transition-colors uppercase tracking-wider"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>

                {/* Footer Branding */}
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 opacity-50">
                    <MatrixLogo className="w-4 h-4" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                        Prometheus Security
                    </span>
                </div>
            </div>
        </div>
    );
}
