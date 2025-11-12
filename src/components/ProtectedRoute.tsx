import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredType?: 'admin' | 'colaborador';
}

export function ProtectedRoute({ children, requiredType }: ProtectedRouteProps) {
  const { user, userType, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/auth");
      } else if (requiredType && userType !== requiredType) {
        // Redirecionar para página apropriada baseado no tipo do usuário
        if (userType === 'admin') {
          navigate("/admin");
        } else {
          navigate("/pdv");
        }
      }
    }
  }, [user, userType, loading, navigate, requiredType]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (requiredType && userType !== requiredType)) {
    return null;
  }

  return <>{children}</>;
}
