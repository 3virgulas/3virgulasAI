import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, Mail, Phone, Shield, CreditCard,
    LogOut, ChevronLeft, Loader2, Sparkles,
    Clock, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { PrometheusModal } from '../components/PrometheusModal';

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
        <div className="min-h-screen bg-black p-6 pb-20 md:pb-6">
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 -ml-2 text-zinc-500 hover:text-zinc-200 rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-semibold text-white tracking-tight">Meu Perfil</h1>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                                <User className="w-7 h-7 text-zinc-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    {profile?.full_name || 'Usuário'}
                                </h2>
                                <p className="text-sm text-zinc-500">
                                    Membro desde {formatDate(user?.created_at)}
                                </p>
                            </div>
                        </div>
                        {isPremium && (
                            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-full">
                                <Shield className="w-3.5 h-3.5 text-zinc-300" />
                                <span className="text-xs font-medium text-zinc-300 tracking-wide">Prometheus</span>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1">
                            <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-widest font-medium">
                                <Mail className="w-3 h-3" /> Email
                            </div>
                            <p className="text-zinc-200 text-sm truncate" title={user?.email}>
                                {user?.email}
                            </p>
                        </div>
                        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1">
                            <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-widest font-medium">
                                <Phone className="w-3 h-3" /> WhatsApp
                            </div>
                            <p className="text-zinc-200 text-sm font-mono">
                                {formatPhone(profile?.cellphone || '')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2 uppercase tracking-widest">
                        <CreditCard className="w-4 h-4" />
                        Assinatura
                    </h3>

                    {loadingSubscription ? (
                        <div className="h-28 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
                        </div>
                    ) : isPremium ? (
                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                            <div className="flex items-start justify-between">
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center gap-1.5 uppercase tracking-widest">
                                            <Sparkles className="w-3.5 h-3.5" /> Prometheus
                                        </p>
                                        <h4 className="text-xl font-semibold text-white tracking-tight">
                                            God Mode Ativo
                                        </h4>
                                    </div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg">
                                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                                        <span className="text-sm text-zinc-300">
                                            {daysRemaining} dias restantes
                                        </span>
                                    </div>
                                </div>
                                <CheckCircle2 className="w-10 h-10 text-zinc-700" />
                            </div>
                        </div>
                    ) : (daysRemaining !== null && daysRemaining <= 0) ? (
                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                            <div className="flex items-start justify-between">
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center gap-1.5 uppercase tracking-widest">
                                            <AlertTriangle className="w-3.5 h-3.5" /> Expirado
                                        </p>
                                        <h4 className="text-xl font-semibold text-white tracking-tight">
                                            Assinatura Vencida
                                        </h4>
                                    </div>
                                    <button
                                        onClick={() => setIsPaymentOpen(true)}
                                        className="px-4 py-2 bg-white hover:bg-zinc-100 text-black text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        Renovar Agora
                                    </button>
                                </div>
                                <AlertTriangle className="w-10 h-10 text-zinc-700" />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-6 transition-colors">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="space-y-1 text-center sm:text-left">
                                    <h4 className="text-lg font-semibold text-white tracking-tight">
                                        Prometheus
                                    </h4>
                                    <p className="text-sm text-zinc-500">
                                        O fogo do conhecimento. Sem filtros. Sem amarras.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsPaymentOpen(true)}
                                    className="px-5 py-2.5 bg-white hover:bg-zinc-100 text-black text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
                                >
                                    Obter Prometheus
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-zinc-900">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-xl transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair da Conta
                    </button>
                </div>
            </div>

            {user && (
                <PrometheusModal
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
