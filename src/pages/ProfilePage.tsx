import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, Mail, Phone, Shield, CreditCard,
    LogOut, ChevronLeft, Loader2, Sparkles, CheckCircle2,
    Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { PremiumPaymentModal } from '../components/PremiumPaymentModal';

export function ProfilePage() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const {
        profile,
        isPremium,
        daysRemaining,
        refreshProfile,
        loading: loadingSubscription
    } = useSubscription(user?.id);

    const [isPaymentOpen, setIsPaymentOpen] = useState(false);

    const handleLogout = async () => {
        await signOut();
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    };

    const formatPhone = (phone?: string) => {
        if (!phone) return '—';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        }
        return phone;
    };

    return (
        <div className="min-h-screen bg-dark-bg p-6 pb-20 md:pb-6">
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 -ml-2 text-dark-text-muted hover:text-dark-text-primary hover:bg-dark-hover rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold text-dark-text-primary">Meu Perfil</h1>
                </div>

                {/* Profile Card */}
                <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-matrix-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-dark-hover border-2 border-dark-border flex items-center justify-center">
                                <User className="w-8 h-8 text-dark-text-secondary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-dark-text-primary">
                                    {profile?.full_name || 'Usuário'}
                                </h2>
                                <p className="text-sm text-dark-text-muted">
                                    Membro desde {formatDate(user?.created_at)}
                                </p>
                            </div>
                        </div>
                        {isPremium && (
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-matrix-primary/10 border border-matrix-primary/20 rounded-full">
                                <Shield className="w-4 h-4 text-matrix-primary" />
                                <span className="text-sm font-medium text-matrix-primary">Premium Ativo</span>
                            </div>
                        )}
                    </div>

                    {/* Info Grid */}
                    <div className="grid gap-4 md:grid-cols-2 relative z-10">
                        <div className="p-4 bg-dark-hover rounded-xl space-y-1">
                            <div className="flex items-center gap-2 text-dark-text-muted text-xs uppercase tracking-wider font-medium">
                                <Mail className="w-3 h-3" /> Email
                            </div>
                            <p className="text-dark-text-primary truncate" title={user?.email}>
                                {user?.email}
                            </p>
                        </div>
                        <div className="p-4 bg-dark-hover rounded-xl space-y-1">
                            <div className="flex items-center gap-2 text-dark-text-muted text-xs uppercase tracking-wider font-medium">
                                <Phone className="w-3 h-3" /> WhatsApp
                            </div>
                            <p className="text-dark-text-primary font-mono">
                                {formatPhone(profile?.cellphone || '')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Subscription Status */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-dark-text-primary flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-matrix-primary" />
                        Assinatura
                    </h3>

                    {loadingSubscription ? (
                        <div className="h-32 bg-dark-surface border border-dark-border rounded-2xl flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-dark-text-muted" />
                        </div>
                    ) : isPremium ? (
                        <div className="bg-gradient-to-br from-dark-surface to-dark-surface via-matrix-primary/5 border border-matrix-primary/20 rounded-2xl p-6 relative overflow-hidden">
                            <div className="flex items-start justify-between relative z-10">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm font-medium text-matrix-primary mb-1 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" /> Plano Premium
                                        </p>
                                        <h4 className="text-2xl font-bold text-dark-text-primary">
                                            Assinatura Ativa
                                        </h4>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="px-3 py-1.5 bg-green-500/10 rounded-lg flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-green-500" />
                                            <span className="text-sm font-medium text-green-500">
                                                {daysRemaining} dias restantes
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <CheckCircle2 className="w-12 h-12 text-matrix-primary opacity-20" />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 relative overflow-hidden group hover:border-matrix-primary/50 transition-colors">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                                <div className="space-y-2 text-center sm:text-left">
                                    <h4 className="text-xl font-bold text-dark-text-primary">
                                        Seja Premium
                                    </h4>
                                    <p className="text-sm text-dark-text-muted max-w-sm">
                                        Desbloqueie todo o potencial da IA sem limites e com acesso prioritário.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsPaymentOpen(true)}
                                    className="px-6 py-3 bg-matrix-primary text-dark-bg font-bold rounded-xl hover:bg-matrix-secondary transition-all shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:-translate-y-0.5"
                                >
                                    Assinar Agora
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="pt-8 border-t border-dark-border">
                    <button
                        onClick={handleLogout}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        Sair da Conta
                    </button>
                    <p className="text-center text-xs text-dark-text-muted mt-6">
                        3Vírgulas AI v1.0.0
                    </p>
                </div>
            </div>

            {/* Modal de Pagamento */}
            {user && (
                <PremiumPaymentModal
                    isOpen={isPaymentOpen}
                    onClose={() => setIsPaymentOpen(false)}
                    userId={user.id}
                    onSuccess={() => {
                        setIsPaymentOpen(false);
                        refreshProfile();
                    }}
                />
            )}
        </div>
    );
}

export default ProfilePage;
