import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  History,
  LogOut,
  Zap, // 1. IMPORTAR O ÍCONE (Zap para "rápido")
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Produtos", url: "/admin/produtos", icon: Package },
  { title: "Vendas", url: "/admin/vendas", icon: History },
];

// 2. ADICIONAR O NOVO ITEM DE MENU
const colaboradorItems = [
  { title: "Caixa Rápido", url: "/pdv/caixa-rapido", icon: Zap },
  { title: "Comandas", url: "/pdv", icon: ShoppingCart },
  { title: "Histórico", url: "/pdv/historico", icon: History },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { userType, userName, signOut } = useAuth();
  const isCollapsed = state === "collapsed";

  const items = userType === "admin" ? adminItems : colaboradorItems;
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    await signOut();
    queryClient.clear();
  };

  return (
    <Sidebar
      collapsible="icon"
      // Fundo sólido no mobile, transparente no desktop
      className="bg-white dark:bg-gray-900 md:bg-transparent dark:md:bg-transparent"
    >
      {/* Header */}
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo da Adega"
            className={`${isCollapsed ? "h-6 w-6" : "h-8 w-8"} object-contain`}
          />
          {/* O ERRO ESTAVA AQUI, AGORA ESTÁ CORRIGIDO. */}
          {!isCollapsed && (
            <div>
              <h2 className="font-bold text-lg">Adega do Sheik</h2>
              <p className="text-xs text-muted-foreground">
                {userType === "admin" ? "Admin" : "Colaborador"}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Conteúdo do menu */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {isCollapsed ? "Menu" : "Navegação"}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      // `end` é importante para o NavLink da raiz ("/pdv")
                      // não ficar ativo em "/pdv/historico" ou "/pdv/caixa-rapido"
                      end={item.url === "/pdv"}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Rodapé da sidebar */}
      <SidebarFooter className="border-t border-border p-4">
        {!isCollapsed && (
          <div className="mb-3">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground">
              {userType === "admin" ? "Administrador" : "Colaborador"}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start"
          size={isCollapsed ? "icon" : "default"}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}