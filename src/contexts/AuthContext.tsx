import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

// Interface (sem alterações)
interface AuthContextType {
  user: User | null;
  session: Session | null;
  userType: "admin" | "colaborador" | null;
  userName: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    nome: string,
    tipo: "admin" | "colaborador"
  ) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Um componente de tela de carregamento simples.
 * Ele será exibido enquanto o app verifica se você está logado (ao dar F5).
 */
function AuthLoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userType, setUserType] = useState<"admin" | "colaborador" | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Começa true
  const navigate = useNavigate();

  // --- LÓGICA DE CARREGAMENTO (SIMPLES E CORRETA) ---
  // Este useEffect roda APENAS UMA VEZ quando o app carrega (F5).
  // Ele serve para "manter o usuário logado".
  useEffect(() => {
    // 1. Pega a sessão atual (se houver)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      // 2. Se tinha sessão, busca o perfil
      if (session?.user) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("tipo, nome")
            .eq("id", session.user.id)
            .single();
          
          if (profile) {
            setUserType(profile.tipo);
            setUserName(profile.nome);
          }
        } catch (e) {
          console.error("Falha ao buscar perfil na sessão:", e);
          // Se falhar (ex: RLS), desloga o usuário para segurança
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
        }
      }
      
      // 3. GARANTE que o loading termine, não importa o que aconteça.
      setLoading(false);
    });

  }, []); // Array vazio. Não tem loop.

  // --- LÓGICA DE LOGIN (SIMPLES E CORRETA) ---
  // Esta função agora faz o login, busca o perfil, ATUALIZA O ESTADO e redireciona.
  const signIn = async (email: string, password: string) => {
    
    // 1. Tenta fazer o login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error }; // Falha no login (senha errada)
    }

    // 2. Login OK! Busca o perfil IMEDIATAMENTE.
    if (data.user) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("tipo, nome")
          .eq("id", data.user.id)
          .single();

        if (profileError) throw profileError; // Falha (ex: RLS, perfil não existe)

        // 3. ATUALIZA O ESTADO (O PONTO MAIS IMPORTANTE)
        if (profile) {
          setUser(data.user);
          setSession(data.session);
          setUserName(profile.nome);
          setUserType(profile.tipo);

          // 4. Redireciona para a página certa.
          if (profile.tipo === 'admin') {
            navigate("/admin"); // Rota de Admin
          } else if (profile.tipo === 'colaborador') {
            navigate("/pdv/caixa-rapido"); // Rota de Colaborador
          } else {
            navigate("/"); // Rota padrão
          }
        }
        return { error: null }; // Sucesso!

      } catch (e) {
        console.error("Sucesso no login, mas falha ao buscar perfil:", e);
        await supabase.auth.signOut(); // Desloga se não achou o perfil
        return { error: e };
      }
    }
    return { error: new Error("Usuário não encontrado após login.") };
  };

  // --- CADASTRO ---
  const signUp = async (
    email: string,
    password: string,
    nome: string,
    tipo: "admin" | "colaborador"
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome, tipo } },
    });
    return { error };
  };

  // --- LOGOUT ---
  const signOut = async () => {
    await supabase.auth.signOut();
    // Limpa o estado manualmente
    setUser(null);
    setSession(null);
    setUserType(null);
    setUserName(null);
    navigate("/auth"); 
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userType,
        userName,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
     
      {loading ? <AuthLoadingScreen /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
   
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}