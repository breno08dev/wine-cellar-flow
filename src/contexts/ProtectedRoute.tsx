import { useAuth } from "@/contexts/AuthContext"; // Ajuste o caminho se mover o AuthContext
import { Navigate, Outlet } from "react-router-dom";

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  // O AuthProvider já está mostrando uma tela de carregamento (AuthLoadingScreen)
  // se o 'loading' for true.
  // Apenas esperamos o 'loading' ser false.
  if (loading) {
    return null; // O AuthContext já mostra o spinner
  }

  // Se não está carregando E NÃO HÁ usuário, redireciona para o login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Se não está carregando E HÁ usuário, permite o acesso
  return <Outlet />;
}