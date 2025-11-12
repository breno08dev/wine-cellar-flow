import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-white dark:bg-gray-950">
        {/* Sidebar fixa e com fundo sólido */}
        <AppSidebar />

        <main className="flex-1 flex flex-col">
          {/* Header com cor sólida, sombra e separação */}
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-white dark:bg-gray-900 px-4 shadow-sm">
            <SidebarTrigger />
          </header>

          {/* Conteúdo principal */}
          <div className="flex-1 p-6 bg-gray-50 dark:bg-gray-950">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
