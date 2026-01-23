import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

function AppContent() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-dark-bg">
                <div className="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        return <Auth />;
    }

    return (
        <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
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
