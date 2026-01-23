// =====================================================
// Auth - Prometheus Login/Signup Portal
// =====================================================
// Dark God Mode - Secret OS / Elite Access aesthetic
// "Onde a verdade não tem filtros"
// =====================================================

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Loader2, AlertCircle, ArrowRight, Eye, EyeOff, Phone } from 'lucide-react';
import { MatrixLogo } from './MatrixLogo';

// Formatar telefone enquanto digita
const formatPhone = (value: string): string => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
};

export function Auth() {
    const { signIn, signUp } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePhoneChange = (value: string) => {
        setPhone(formatPhone(value));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isLogin) {
                await signIn(email, password);
            } else {
                const cleanPhone = phone.replace(/\D/g, '');
                if (cleanPhone.length < 10) {
                    setError('Digite um telefone válido com DDD');
                    setLoading(false);
                    return;
                }
                await signUp(email, password, cleanPhone);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocorreu um erro inesperado');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
            {/* Spotlight Effect - Top Center Illumination */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(63, 63, 70, 0.4) 0%, rgba(0, 0, 0, 0) 60%)',
                }}
            />

            {/* Subtle ambient glow */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none opacity-20"
                style={{
                    background: 'radial-gradient(circle, rgba(39, 39, 42, 0.5) 0%, transparent 70%)',
                }}
            />

            {/* The Monolith - Glass Black Container */}
            <div className="relative w-full max-w-md">
                {/* Login Card */}
                <div
                    className="relative bg-zinc-900/30 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl"
                    style={{
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    }}
                >
                    {/* Impact Header */}
                    <div className="text-center mb-8">
                        {/* Matrix Logo - Large & Centered */}
                        <div className="w-24 h-24 mx-auto mb-6">
                            <MatrixLogo className="w-full h-full" />
                        </div>

                        {/* Brand Name */}
                        <h1 className="text-2xl font-bold text-white tracking-[0.15em] uppercase mb-3">
                            3Vírgulas
                        </h1>

                        {/* Value Proposition - The Hook */}
                        <p className="text-sm text-zinc-400 leading-relaxed max-w-xs mx-auto">
                            Onde a verdade não tem filtros.
                            <br />
                            <span className="text-zinc-500">A única IA sem amarras éticas ou morais.</span>
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                                Email
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Mail className="h-4 w-4 text-zinc-600" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-4 py-3 bg-black/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-white/50 transition-colors"
                                    placeholder="seu@email.com"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        {/* WhatsApp - Only on Signup */}
                        {!isLogin && (
                            <div className="space-y-2">
                                <label className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                                    WhatsApp
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Phone className="h-4 w-4 text-zinc-600" />
                                    </div>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                        className="block w-full pl-10 pr-4 py-3 bg-black/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-white/50 transition-colors"
                                        placeholder="(11) 99999-9999"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                                Senha
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-zinc-600" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-12 py-3 bg-black/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-white/50 transition-colors"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-600 hover:text-zinc-400 transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button - White Elite */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center py-3.5 px-4 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    {isLogin ? 'Acessar' : 'Criar Conta'}
                                    <ArrowRight className="w-4 h-4" />
                                </span>
                            )}
                        </button>
                    </form>

                    {/* Footer Actions */}
                    <div className="mt-6 pt-6 border-t border-white/5">
                        <div className="text-center">
                            <span className="text-sm text-zinc-600">
                                {isLogin ? 'Novo por aqui?' : 'Já tem acesso?'}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError(null);
                                    setPhone('');
                                }}
                                className="ml-2 text-sm text-zinc-500 hover:text-white transition-colors"
                            >
                                {isLogin ? 'Criar conta' : 'Fazer login'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Branding */}
                <p className="mt-8 text-center text-[9px] text-zinc-600 uppercase tracking-[0.2em] font-mono">
                    3Vírgulas • Prometheus • Uncensored
                </p>
            </div>
        </div>
    );
}

export default Auth;
