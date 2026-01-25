import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { Auth } from './components/Auth';
import { ProfilePage } from './pages/ProfilePage';
import { ChatPage } from './pages/ChatPage';
import { AdminPage } from './pages/AdminPage';

// =====================================================
// AppContent
// =====================================================
// Lógica de roteamento condicional baseada na auth
// =====================================================

// =====================================================
// AppContent
// =====================================================
// Lógica de roteamento condicional baseada na auth
// =====================================================

function AppContent() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-dark-bg">
                <div className="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <Routes>
            {/* Rota Pública (Guest Mode) */}
            <Route path="/" element={<ChatPage />} />

            {/* Rota de Autenticação */}
            <Route path="/auth" element={!user ? <Auth /> : <Navigate to="/" />} />

            {/* Rotas Protegidas */}
            <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/auth" />} />
            <Route path="/admin" element={user ? <AdminPage /> : <Navigate to="/auth" />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

// =====================================================
// App
// =====================================================

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <SettingsProvider>
                    <AppContent />
                </SettingsProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
