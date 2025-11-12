// src/pages/admin/Sales.tsx
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar as CalendarIcon, 
  DollarSign,
  Landmark,
  Wallet,
  CreditCard
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

// Tipos
// --- CORREÇÃO APLICADA AQUI ---
// 1. Pegamos a linha base da tabela 'sales'
type SalesRow = Database["public"]["Tables"]["sales"]["Row"];

// 2. Criamos nosso tipo 'Sale' personalizado
type Sale = Omit<SalesRow, 'profiles'> & { // Omit<...> remove a coluna 'profiles' original
  profiles: { nome: string } | null;       // E aqui adicionamos a nova definição correta
};
// --- FIM DA CORREÇÃO ---

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

// Mapa para formatar os nomes dos pagamentos
const paymentMethodLabels: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
};

export default function AdminSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  useEffect(() => {
    loadSales();
  }, [date]);

  const loadSales = async () => {
    if (!date?.from || !date?.to) {
      setSales([]);
      return;
    }

    setLoading(true);
    const dateTo = new Date(date.to);
    dateTo.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('sales')
      .select('*, profiles(nome)')
      .eq('status', 'finalizada')
      .gte('updated_at', date.from.toISOString())
      .lte('updated_at', dateTo.toISOString())
      .order('updated_at', { ascending: false });
    
    if (data) {
      // Agora o 'data' corresponde perfeitamente ao tipo 'Sale[]'
      setSales(data as Sale[]); 
    }
    if (error) {
      toast.error("Erro ao carregar vendas", { description: error.message });
    }
    setLoading(false);
  };

  // --- Cálculo dos Totais usando useMemo ---
  const salesTotals = useMemo(() => {
    const totals = {
      totalGeral: 0,
      porMetodo: {
        dinheiro: 0,
        pix: 0,
        cartao_credito: 0,
        cartao_debito: 0,
        naoInformado: 0,
      } as Record<PaymentMethod | "naoInformado", number>,
    };

    for (const sale of sales) {
      // Com o tipo correto, sale.total é reconhecido
      const totalVenda = Number(sale.total) || 0; 
      totals.totalGeral += totalVenda;

      if (sale.metodo_pagamento && paymentMethodLabels[sale.metodo_pagamento]) {
        totals.porMetodo[sale.metodo_pagamento] += totalVenda;
      } else {
        totals.porMetodo.naoInformado += totalVenda;
      }
    }

    return totals;
  }, [sales]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center text-muted-foreground p-8">
          Carregando vendas...
        </div>
      );
    }

    if (sales.length === 0) {
      return (
        <div className="text-center text-muted-foreground p-8">
          Nenhuma venda finalizada neste período.
        </div>
      );
    }

    return (
      <>
        {/* --- VISÃO MOBILE (LISTA DE CARDS) --- */}
        <div className="md:hidden space-y-4">
          {sales.map((sale) => (
            <Card key={sale.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="font-medium">{sale.nome_cliente || "Cliente não informado"}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(sale.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {/* Agora 'sale.profiles' é do tipo correto e '.nome' funciona */}
                    Colab: {sale.profiles?.nome || "N/A"} 
                  </p>
                </div>
                <div className="text-right">
                  {/* E 'sale.total' também funciona */}
                  <p className="text-lg font-bold text-primary">R$ {Number(sale.total).toFixed(2)}</p>
                  <Badge variant="outline" className="mt-1">
                    {sale.metodo_pagamento ? paymentMethodLabels[sale.metodo_pagamento] : "N/A"}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* --- VISÃO DESKTOP (TABELA) --- */}
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Data / Hora</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>
                  {format(new Date(sale.updated_at), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </TableCell>
                <TableCell>{sale.nome_cliente || "--"}</TableCell>
                {/* Agora 'sale.profiles' é do tipo correto e '.nome' funciona */}
                <TableCell>{sale.profiles?.nome || "N/A"}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {sale.metodo_pagamento ? paymentMethodLabels[sale.metodo_pagamento] : "N/A"}
                  </Badge>
                </TableCell>
                {/* E 'sale.total' também funciona */}
                <TableCell className="text-right font-medium">
                  R$ {Number(sale.total).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* --- HEADER JÁ RESPONSIVO --- */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Histórico de Vendas</h1>
          <p className="text-muted-foreground">Vendas finalizadas por período</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full sm:w-[300px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                    {format(date.to, "dd/MM/yy", { locale: ptBR })}
                  </>
                ) : (
                  format(date.from, "dd/MM/yy", { locale: ptBR })
                )
              ) : (
                <span>Escolha um período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* --- CARDS DE TOTAIS --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {salesTotals.totalGeral.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total de {sales.length} venda(s) no período
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dinheiro</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {salesTotals.porMetodo.dinheiro.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pix</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {salesTotals.porMetodo.pix.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cartões</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {(salesTotals.porMetodo.cartao_credito + salesTotals.porMetodo.cartao_debito).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Crédito: R$ {salesTotals.porMetodo.cartao_credito.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              Débito: R$ {salesTotals.porMetodo.cartao_debito.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendas Finalizadas</CardTitle>
          <CardDescription>
            Exibindo {sales.length} venda(s) para o período selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}