import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppSettings } from '../hooks/useAppSettings';
import { supabase } from '../lib/supabase';
import {
    Settings, Save, Loader2, ArrowLeft, Sparkles, Bot, ImageIcon, Eye, Cpu,
    Crown, Users, Zap, RefreshCw, Plus, Minus, Check, Ban,
    Phone, Mail, Calendar, Hash, Trash2
} from 'lucide-react';
import type { Subscription } from '../types/subscription';

// =====================================================
// AdminPage V3 - Gestão de Assinantes
// =====================================================
// Painel administrativo com:
// 1. Configuração da IA (padrão)
// 2. Configuração Premium
// 3. Assinantes Premium (com gestão completa)
// 4. Todos os Usuários (Gestão total)
// =====================================================

const ADMIN_EMAIL = 'contato@3virgulas.com';
const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/bottts/svg?seed=3virgulas&backgroundColor=22c55e';

type TabId = 'ai' | 'premium-config' | 'subscribers' | 'users';

interface SubscriberInfo extends Subscription {
    email?: string;
    cellphone?: string;
}

interface UserInfo {
    id: string;
    email?: string;
    full_name?: string;
    cellphone?: string;
    tax_id?: string;
    created_at: string;
    status: 'premium' | 'free';
    subscription_expires_at?: string | null;
}

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-up ${type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
            }`}>
            {type === 'success' ? <Check className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
            <span className="font-medium">{message}</span>
        </div>
    );
}

export function AdminPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { settings, loading, updateSettings } = useAppSettings();

    // Tab state
    const [activeTab, setActiveTab] = useState<TabId>('ai');

    // AI Config state
    const [model, setModel] = useState('');
    const [visionModel, setVisionModel] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarError, setAvatarError] = useState(false);

    // Premium Config state
    const [premiumModel, setPremiumModel] = useState('');
    const [premiumPrompt, setPremiumPrompt] = useState('');

    // Subscribers state
    const [subscribers, setSubscribers] = useState<SubscriberInfo[]>([]);
    const [loadingSubscribers, setLoadingSubscribers] = useState(false);

    // Users state
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [grantModalOpen, setGrantModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [grantDays, setGrantDays] = useState(30);

    // Common state
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const isAdmin = user?.email === ADMIN_EMAIL;

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    useEffect(() => {
        if (!loading && !isAdmin) {
            navigate('/');
        }
    }, [isAdmin, loading, navigate]);

    useEffect(() => {
        if (settings) {
            setModel(settings.selected_model);
            setVisionModel(settings.vision_model || 'google/gemini-2.0-flash-exp:free');
            setSystemPrompt(settings.system_instruction);
            setAvatarUrl(settings.ai_avatar_url || '');
            setPremiumModel(settings.premium_model || 'anthropic/claude-3.5-sonnet');
            setPremiumPrompt(settings.premium_system_instruction || '');
        }
    }, [settings]);

    // Load subscribers when tab is selected
    useEffect(() => {
        if (activeTab === 'subscribers') {
            loadSubscribers();
        } else if (activeTab === 'users') {
            loadUsers();
        }
    }, [activeTab]);

    const loadSubscribers = async () => {
        setLoadingSubscribers(true);
        try {
            // Buscar assinaturas
            const { data: subscriptionsData, error: subError } = await supabase
                .from('subscriptions')
                .select('*')
                .order('updated_at', { ascending: false });

            if (subError) throw subError;

            // Buscar perfis para obter email e telefone
            const userIds = (subscriptionsData || []).map((s: any) => s.user_id);

            let profilesMap: Record<string, { email: string; cellphone: string | null }> = {};

            if (userIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, email, cellphone')
                    .in('id', userIds);

                if (!profilesError && profilesData) {
                    profilesData.forEach((profile: any) => {
                        profilesMap[profile.id] = {
                            email: profile.email || 'N/A',
                            cellphone: profile.cellphone || null
                        };
                    });
                }
            }

            // Combinar dados
            const mapped = (subscriptionsData || []).map((sub: any) => ({
                ...sub,
                email: profilesMap[sub.user_id]?.email || 'N/A',
                cellphone: profilesMap[sub.user_id]?.cellphone || null
            }));

            setSubscribers(mapped);
        } catch (err) {
            console.error('Erro ao carregar assinantes:', err);
            showToast('Erro ao carregar assinantes', 'error');
        } finally {
            setLoadingSubscribers(false);
        }
    };

    const loadUsers = async () => {
        setLoadingUsers(true);
        try {
            // Buscar perfis
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (profilesError) throw profilesError;

            // Buscar assinaturas
            const { data: subscriptions, error: subError } = await supabase
                .from('subscriptions')
                .select('*');

            if (subError) throw subError;

            // Criar mapa de assinaturas
            const subMap: Record<string, any> = {};
            subscriptions?.forEach((sub: any) => {
                const isActive = ['active'].includes(sub.status) && new Date(sub.subscription_expires_at) > new Date();
                subMap[sub.user_id] = {
                    status: isActive ? 'premium' : 'free',
                    expires: sub.subscription_expires_at
                };
            });

            // Combinar
            const combined: UserInfo[] = (profiles || []).map((p: any) => ({
                ...p,
                status: subMap[p.id]?.status || 'free',
                subscription_expires_at: subMap[p.id]?.expires
            }));

            setUsers(combined);
        } catch (err) {
            console.error('Erro ao carregar usuários:', err);
            showToast('Erro ao carregar usuários', 'error');
        } finally {
            setLoadingUsers(false);
        }
    };

    // Filtered users
    const filteredUsers = users.filter(user => {
        const search = userSearch.toLowerCase();
        return (
            (user.full_name?.toLowerCase() || '').includes(search) ||
            (user.email?.toLowerCase() || '').includes(search) ||
            (user.tax_id || '').includes(search)
        );
    });

    // =====================================================
    // AÇÕES DE GESTÃO (via Edge Function)
    // =====================================================

    const callAdminAction = async (action: string, subscriptionId: string, extraData?: Record<string, any>) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Não autenticado');

        const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-subscription`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    action,
                    subscriptionId,
                    ...extraData
                }),
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Erro na operação');
        }

        return result;
    };

    const handleGrantPremium = async () => {
        if (!selectedUserId) return;
        setActionLoading(selectedUserId);

        try {
            await callAdminAction('grant_premium', '', { userId: selectedUserId, days: grantDays });
            showToast(`Premium concedido por ${grantDays} dias`, 'success');
            setGrantModalOpen(false);
            loadUsers();
        } catch (err) {
            console.error(err);
            showToast(err instanceof Error ? err.message : 'Erro ao conceder premium', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Tem certeza ABSOLUTA que deseja deletar este usuário? Esta ação é irreversível e apagará TODOS os dados do usuário, incluindo conversas e histórico.')) return;

        setActionLoading(userId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Não autenticado');

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ userId }),
                }
            );

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Erro ao deletar usuário');
            }

            showToast('Usuário deletado com sucesso', 'success');
            setUsers(users.filter(u => u.id !== userId));
        } catch (err) {
            console.error(err);
            showToast(err instanceof Error ? err.message : 'Erro ao deletar usuário', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleAddDays = async (subscriptionId: string, days: number) => {
        setActionLoading(subscriptionId);
        try {
            const action = days > 0 ? 'add_days' : 'subtract_days';
            await callAdminAction(action, subscriptionId, { days: Math.abs(days) });

            showToast(`${days > 0 ? '+' : '-'}${Math.abs(days)} dias aplicados`, 'success');
            await loadSubscribers();
        } catch (err) {
            console.error('Erro:', err);
            showToast(err instanceof Error ? err.message : 'Erro ao modificar assinatura', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleActivateManually = async (subscriptionId: string) => {
        setActionLoading(subscriptionId);
        try {
            await callAdminAction('activate', subscriptionId);

            showToast('Assinatura ativada (31 dias)', 'success');
            await loadSubscribers();
        } catch (err) {
            console.error('Erro:', err);
            showToast(err instanceof Error ? err.message : 'Erro ao ativar', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancelSubscription = async (subscriptionId: string, status: 'canceled' | 'banned') => {
        setActionLoading(subscriptionId);
        try {
            await callAdminAction(status === 'banned' ? 'ban' : 'cancel', subscriptionId);

            showToast(`Assinatura ${status === 'banned' ? 'banida' : 'cancelada'}`, 'success');
            await loadSubscribers();
        } catch (err) {
            console.error('Erro:', err);
            showToast(err instanceof Error ? err.message : 'Erro ao cancelar', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleAvatarUrlChange = (url: string) => {
        setAvatarUrl(url);
        setAvatarError(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        const success = await updateSettings({
            selected_model: model,
            vision_model: visionModel,
            system_instruction: systemPrompt,
            ai_avatar_url: avatarUrl || null,
            premium_model: premiumModel,
            premium_system_instruction: premiumPrompt,
        });

        setIsSaving(false);

        if (success) {
            setSaveSuccess(true);
            showToast('Configurações salvas', 'success');
            setTimeout(() => setSaveSuccess(false), 3000);
        } else {
            showToast('Erro ao salvar configurações', 'error');
        }
    };

    // Format phone for display
    const formatPhone = (phone: string | null | undefined) => {
        if (!phone) return '—';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        }
        return phone;
    };

    // Status badge
    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { label: string; color: string }> = {
            active: { label: 'ATIVO', color: 'bg-green-500/20 text-green-400' },
            pending: { label: 'PENDENTE', color: 'bg-yellow-500/20 text-yellow-400' },
            expired: { label: 'EXPIRADO', color: 'bg-gray-500/20 text-gray-400' },
            canceled: { label: 'CANCELADO', color: 'bg-red-500/20 text-red-400' },
            banned: { label: 'BANIDO', color: 'bg-red-600/30 text-red-300' },
        };
        const config = statusConfig[status] || { label: status.toUpperCase(), color: 'bg-gray-500/20 text-gray-400' };
        return (
            <span className={`px-2 py-1 text-xs font-bold rounded ${config.color}`}>
                {config.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-bg">
                <Loader2 className="w-8 h-8 animate-spin text-matrix-primary" />
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    const previewUrl = avatarError || !avatarUrl ? DEFAULT_AVATAR : avatarUrl;

    const tabs = [
        { id: 'ai' as TabId, label: 'Configuração IA', icon: Cpu },
        { id: 'premium-config' as TabId, label: 'Config. Premium', icon: Crown },
        { id: 'subscribers' as TabId, label: 'Assinantes', icon: Crown },
        { id: 'users' as TabId, label: 'Todos Usuários', icon: Users },
    ];

    return (
        <div className="min-h-screen bg-dark-bg p-4 md:p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-dark-text-secondary" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-dark-text-primary flex items-center gap-2">
                            <Settings className="w-6 h-6 text-matrix-primary" />
                            Admin Panel V3
                        </h1>
                        <p className="text-dark-text-muted text-sm font-mono">
                            Configure IA, Premium e gerencie usuários
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 bg-dark-surface p-1 rounded-lg overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-matrix-primary/20 text-matrix-primary'
                                : 'text-dark-text-muted hover:text-dark-text-primary hover:bg-dark-hover'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="bg-dark-surface border border-dark-border rounded-xl p-4 md:p-6">

                    {/* AI Configuration Tab */}
                    {activeTab === 'ai' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-dark-text-primary">
                                <Bot className="w-5 h-5 text-matrix-primary" />
                                <h2 className="text-lg font-semibold">Configuração da IA Standard</h2>
                            </div>

                            {/* Model */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-dark-text-secondary">
                                    <Sparkles className="w-4 h-4" />
                                    Modelo de IA (Texto)
                                </label>
                                <input
                                    type="text"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full px-4 py-3 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary font-mono text-sm focus:outline-none focus:border-matrix-primary/50 transition-colors"
                                    placeholder="google/gemini-2.0-flash-exp:free"
                                />
                            </div>

                            {/* Vision Model */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-dark-text-secondary">
                                    <Eye className="w-4 h-4" />
                                    Modelo de Visão
                                </label>
                                <input
                                    type="text"
                                    value={visionModel}
                                    onChange={(e) => setVisionModel(e.target.value)}
                                    className="w-full px-4 py-3 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary font-mono text-sm focus:outline-none focus:border-matrix-primary/50 transition-colors"
                                    placeholder="google/gemini-2.0-flash-exp:free"
                                />
                            </div>

                            {/* System Prompt */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-dark-text-secondary">
                                    <Bot className="w-4 h-4" />
                                    Prompt do Sistema
                                </label>
                                <textarea
                                    value={systemPrompt}
                                    onChange={(e) => setSystemPrompt(e.target.value)}
                                    rows={6}
                                    className="w-full px-4 py-3 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary text-sm focus:outline-none focus:border-matrix-primary/50 transition-colors resize-none"
                                    placeholder="Você é um assistente..."
                                />
                            </div>

                            {/* Avatar URL */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-dark-text-secondary">
                                    <ImageIcon className="w-4 h-4" />
                                    Avatar da IA (URL)
                                </label>
                                <div className="flex gap-4 items-start">
                                    <input
                                        type="url"
                                        value={avatarUrl}
                                        onChange={(e) => handleAvatarUrlChange(e.target.value)}
                                        className="flex-1 px-4 py-3 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary text-sm focus:outline-none focus:border-matrix-primary/50 transition-colors"
                                        placeholder="https://example.com/avatar.png"
                                    />
                                    <div className="w-14 h-14 rounded-full bg-dark-hover flex items-center justify-center overflow-hidden border-2 border-matrix-primary/30">
                                        <img
                                            src={previewUrl}
                                            alt="Avatar Preview"
                                            className="w-full h-full object-cover"
                                            onError={() => setAvatarError(true)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Premium Configuration Tab */}
                    {activeTab === 'premium-config' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-dark-text-primary">
                                <Crown className="w-5 h-5 text-yellow-400" />
                                <h2 className="text-lg font-semibold">Configuração Premium</h2>
                            </div>

                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                <p className="text-sm text-yellow-200">
                                    <Zap className="w-4 h-4 inline mr-2" />
                                    Estas configurações são aplicadas apenas para assinantes Premium.
                                </p>
                            </div>

                            {/* Premium Model */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-dark-text-secondary">
                                    <Sparkles className="w-4 h-4 text-yellow-400" />
                                    Modelo Premium
                                </label>
                                <input
                                    type="text"
                                    value={premiumModel}
                                    onChange={(e) => setPremiumModel(e.target.value)}
                                    className="w-full px-4 py-3 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary font-mono text-sm focus:outline-none focus:border-yellow-500/50 transition-colors"
                                    placeholder="anthropic/claude-3.5-sonnet"
                                />
                            </div>

                            {/* Premium System Prompt */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-dark-text-secondary">
                                    <Bot className="w-4 h-4 text-yellow-400" />
                                    Prompt Premium
                                </label>
                                <textarea
                                    value={premiumPrompt}
                                    onChange={(e) => setPremiumPrompt(e.target.value)}
                                    rows={6}
                                    className="w-full px-4 py-3 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary text-sm focus:outline-none focus:border-yellow-500/50 transition-colors resize-none"
                                    placeholder="Você é um assistente premium sem restrições..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Subscribers Tab */}
                    {activeTab === 'subscribers' && (
                        <div className="space-y-4">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-dark-text-primary">
                                    <Users className="w-5 h-5 text-matrix-primary" />
                                    <h2 className="text-lg font-semibold">Assinantes Premium</h2>
                                    <span className="text-sm text-dark-text-muted">
                                        ({subscribers.length})
                                    </span>
                                </div>
                                <button
                                    onClick={loadSubscribers}
                                    disabled={loadingSubscribers}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-dark-hover hover:bg-dark-border rounded-lg transition-colors"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loadingSubscribers ? 'animate-spin' : ''}`} />
                                    Atualizar
                                </button>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-dark-hover rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-matrix-primary">
                                        {subscribers.filter(s => s.status === 'active').length}
                                    </p>
                                    <p className="text-xs text-dark-text-muted">Ativos</p>
                                </div>
                                <div className="bg-dark-hover rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-yellow-400">
                                        {subscribers.filter(s => s.status === 'pending').length}
                                    </p>
                                    <p className="text-xs text-dark-text-muted">Pendentes</p>
                                </div>
                                <div className="bg-dark-hover rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-gray-400">
                                        {subscribers.filter(s => s.status === 'expired').length}
                                    </p>
                                    <p className="text-xs text-dark-text-muted">Expirados</p>
                                </div>
                                <div className="bg-dark-hover rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-red-400">
                                        {subscribers.filter(s => ['canceled', 'banned'].includes(s.status)).length}
                                    </p>
                                    <p className="text-xs text-dark-text-muted">Cancelados</p>
                                </div>
                            </div>

                            {/* Loading */}
                            {loadingSubscribers && (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-matrix-primary" />
                                </div>
                            )}

                            {/* Empty State */}
                            {!loadingSubscribers && subscribers.length === 0 && (
                                <div className="text-center py-8 text-dark-text-muted">
                                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Nenhum assinante encontrado</p>
                                </div>
                            )}

                            {/* Subscribers Table */}
                            {!loadingSubscribers && subscribers.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-dark-border text-left">
                                                <th className="py-3 px-2 text-dark-text-muted font-medium">
                                                    <Mail className="w-4 h-4 inline mr-1" />
                                                    Email
                                                </th>
                                                <th className="py-3 px-2 text-dark-text-muted font-medium hidden md:table-cell">
                                                    <Phone className="w-4 h-4 inline mr-1" />
                                                    WhatsApp
                                                </th>
                                                <th className="py-3 px-2 text-dark-text-muted font-medium">
                                                    Status
                                                </th>
                                                <th className="py-3 px-2 text-dark-text-muted font-medium hidden sm:table-cell">
                                                    <Calendar className="w-4 h-4 inline mr-1" />
                                                    Expira
                                                </th>
                                                <th className="py-3 px-2 text-dark-text-muted font-medium hidden lg:table-cell">
                                                    <Hash className="w-4 h-4 inline mr-1" />
                                                    Transação
                                                </th>
                                                <th className="py-3 px-2 text-dark-text-muted font-medium text-right">
                                                    Ações
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {subscribers.map((sub) => (
                                                <tr
                                                    key={sub.id}
                                                    className="border-b border-dark-border/50 hover:bg-dark-hover/50 transition-colors"
                                                >
                                                    <td className="py-3 px-2">
                                                        <p className="text-dark-text-primary font-medium truncate max-w-[180px]">
                                                            {sub.email}
                                                        </p>
                                                        <p className="text-xs text-dark-text-muted md:hidden">
                                                            {formatPhone(sub.cellphone)}
                                                        </p>
                                                    </td>
                                                    <td className="py-3 px-2 hidden md:table-cell text-dark-text-secondary">
                                                        {formatPhone(sub.cellphone)}
                                                    </td>
                                                    <td className="py-3 px-2">
                                                        {getStatusBadge(sub.status)}
                                                    </td>
                                                    <td className="py-3 px-2 hidden sm:table-cell text-dark-text-secondary">
                                                        {sub.subscription_expires_at
                                                            ? new Date(sub.subscription_expires_at).toLocaleDateString('pt-BR')
                                                            : '—'}
                                                    </td>
                                                    <td className="py-3 px-2 hidden lg:table-cell">
                                                        <span className="text-xs text-dark-text-muted font-mono truncate block max-w-[100px]">
                                                            {sub.transacao_id || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-2">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {actionLoading === sub.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin text-matrix-primary" />
                                                            ) : (
                                                                <>
                                                                    {/* +30 dias */}
                                                                    <button
                                                                        onClick={() => handleAddDays(sub.id, 30)}
                                                                        className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                                                                        title="Adicionar 30 dias"
                                                                    >
                                                                        <Plus className="w-4 h-4" />
                                                                    </button>

                                                                    {/* -7 dias */}
                                                                    <button
                                                                        onClick={() => handleAddDays(sub.id, -7)}
                                                                        className="p-1.5 text-yellow-400 hover:bg-yellow-500/20 rounded transition-colors"
                                                                        title="Remover 7 dias"
                                                                    >
                                                                        <Minus className="w-4 h-4" />
                                                                    </button>

                                                                    {/* Ativar */}
                                                                    {sub.status !== 'active' && (
                                                                        <button
                                                                            onClick={() => handleActivateManually(sub.id)}
                                                                            className="p-1.5 text-matrix-primary hover:bg-matrix-primary/20 rounded transition-colors"
                                                                            title="Ativar manualmente"
                                                                        >
                                                                            <Check className="w-4 h-4" />
                                                                        </button>
                                                                    )}

                                                                    {/* Cancelar/Banir */}
                                                                    {sub.status !== 'banned' && (
                                                                        <button
                                                                            onClick={() => handleCancelSubscription(sub.id, 'canceled')}
                                                                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                                                            title="Cancelar assinatura"
                                                                        >
                                                                            <Ban className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-2 text-dark-text-primary">
                                    <Users className="w-5 h-5 text-matrix-primary" />
                                    <h2 className="text-lg font-semibold">Todos os Usuários</h2>
                                    <span className="text-sm text-dark-text-muted">
                                        ({filteredUsers.length})
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <div className="relative flex-1 md:w-64">
                                        <input
                                            type="text"
                                            placeholder="Buscar..."
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                            className="w-full pl-3 pr-3 py-1.5 bg-dark-hover border border-dark-border rounded-lg text-sm text-dark-text-primary focus:outline-none focus:border-matrix-primary/50"
                                        />
                                    </div>
                                    <button
                                        onClick={loadUsers}
                                        disabled={loadingUsers}
                                        className="flex items-center justify-center w-8 h-8 bg-dark-hover hover:bg-dark-border rounded-lg transition-colors"
                                        title="Atualizar"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {loadingUsers ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-matrix-primary" />
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="text-center py-8 text-dark-text-muted">
                                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Nenhum usuário encontrado</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-dark-border text-left">
                                                <th className="py-3 px-2 text-dark-text-muted font-medium">Usuário</th>
                                                <th className="py-3 px-2 text-dark-text-muted font-medium">Contatos</th>
                                                <th className="py-3 px-2 text-dark-text-muted font-medium">Status / Cadastro</th>
                                                <th className="py-3 px-2 text-dark-text-muted font-medium text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map((u) => (
                                                <tr
                                                    key={u.id}
                                                    className="border-b border-dark-border/50 hover:bg-dark-hover/50 transition-colors"
                                                >
                                                    <td className="py-3 px-2">
                                                        <p className="text-dark-text-primary font-medium">{u.full_name || 'Usuário Sem Nome'}</p>
                                                        <p className="text-xs text-dark-text-muted truncate max-w-[200px]" title={u.id}>
                                                            {u.id}
                                                        </p>
                                                    </td>
                                                    <td className="py-3 px-2">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1 text-dark-text-secondary" title={u.email}>
                                                                <Mail className="w-3 h-3 flex-shrink-0" />
                                                                <span className="truncate max-w-[150px]">{u.email}</span>
                                                            </div>
                                                            {u.cellphone && (
                                                                <a
                                                                    href={`https://wa.me/55${u.cellphone.replace(/\D/g, '')}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-matrix-primary hover:underline flex items-center gap-1 text-xs"
                                                                >
                                                                    <Phone className="w-3 h-3" /> {formatPhone(u.cellphone)}
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-2">
                                                        <div className="space-y-1">
                                                            {u.status === 'premium' ? (
                                                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-green-500/20 text-green-400 border border-green-500/20">PREMIUM</span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-500/20 text-gray-400 border border-gray-500/20">FREE</span>
                                                            )}
                                                            <p className="text-xs text-dark-text-muted">
                                                                {new Date(u.created_at).toLocaleDateString('pt-BR')}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-2">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {actionLoading === u.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin text-matrix-primary" />
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedUserId(u.id);
                                                                            setGrantModalOpen(true);
                                                                        }}
                                                                        className="p-1.5 text-matrix-primary hover:bg-matrix-primary/20 rounded transition-colors"
                                                                        title="Conceder Premium"
                                                                    >
                                                                        <Plus className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteUser(u.id)}
                                                                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                                                        title="Excluir Usuário"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Save Button - only for config tabs */}
                    {(activeTab === 'ai' || activeTab === 'premium-config') && (
                        <div className="mt-6 pt-6 border-t border-dark-border">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${saveSuccess
                                    ? 'bg-matrix-primary text-dark-bg'
                                    : 'border border-matrix-primary text-matrix-primary hover:bg-matrix-primary/10'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isSaving ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : saveSuccess ? (
                                    <>✓ Salvo</>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Salvar Configurações
                                    </>
                                )}
                            </button>

                            {settings?.updated_at && (
                                <p className="text-center text-[10px] text-dark-text-muted font-mono mt-3">
                                    Última atualização: {new Date(settings.updated_at).toLocaleString('pt-BR')}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Grant Premium Modal */}
            {grantModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-dark-surface border border-dark-border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative overflow-hidden">
                        {/* Glow effect */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-matrix-primary/10 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-matrix-primary/10 rounded-lg">
                                    <Crown className="w-6 h-6 text-matrix-primary" />
                                </div>
                                <h3 className="text-lg font-bold text-dark-text-primary">Conceder Premium</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-dark-text-secondary mb-2 block">
                                        Dias de acesso:
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={grantDays}
                                            onChange={(e) => setGrantDays(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary focus:outline-none focus:border-matrix-primary/50 transition-colors"
                                            min="1"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-dark-text-muted pointer-events-none">
                                            dias
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2 justify-end pt-2">
                                    <button
                                        onClick={() => setGrantModalOpen(false)}
                                        className="px-4 py-2 text-sm font-medium text-dark-text-muted hover:text-dark-text-primary transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleGrantPremium}
                                        className="px-4 py-2 bg-matrix-primary text-dark-bg font-bold rounded-lg hover:bg-matrix-secondary transition-colors"
                                    >
                                        Confirmar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}

export default AdminPage;
