import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// Removido 'Tabs' e 'Select' dos imports
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Wine } from "lucide-react";

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  // Removido 'signUp' do useAuth
  const { signIn, user, userType } = useAuth();
  const navigate = useNavigate();

  // Apenas Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Removido Signup state

  useEffect(() => {
    if (user && userType) {
      // Redirecionar usuário logado para página apropriada
      if (userType === 'admin') {
        navigate("/admin");
      } else {
        navigate("/pdv");
      }
    }
  }, [user, userType, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(loginEmail, loginPassword);
      
      if (error) {
        toast.error("Erro ao fazer login", {
          description: error.message,
        });
      } else {
        toast.success("Login realizado com sucesso!");
      }
    } catch (error) {
      toast.error("Erro inesperado ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  // Removido handleSignup

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <img src="/conectnew.logo.png" alt="Logo da Empresa" className="h-38 w-36 object-contain" />
        </div>
        <Card className="border-border shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Sistema de Gestão</CardTitle>
         
            <CardDescription className="text-center">
              Acesse sua conta
            </CardDescription>
          </CardHeader>
          
          {/* Estrutura de Tabs removida */}
          <CardContent>
            {/* Formulário de login direto */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">E-mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
            {/* Fim da estrutura de Tabs */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}