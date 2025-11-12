import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  List,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";
import { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { toast } from "sonner";

// -------------------- Tipos --------------------
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type SaleStatus = Database["public"]["Enums"]["sale_status"];

export type RecentSale = Pick<
  Database["public"]["Tables"]["sales"]["Row"],
  "id" | "created_at" | "total" | "nome_cliente" | "metodo_pagamento" | "status"
> & {
  profiles: { nome: string } | null;
};

// -------------------- Labels --------------------
const paymentMethodLabels: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
};

const statusLabels: Record<SaleStatus, string> = {
  aberta: "Aberta",
  finalizada: "Finalizada",
};

const COLORS = {
  dinheiro: "#10B981",
  pix: "#3B82F6",
  cartao_debito: "#F59E0B",
  cartao_credito: "#EF4444",
};

// -------------------- Componente Principal --------------------
export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpiStats, setKpiStats] = useState({
    totalVendas: 0,
    vendasHoje: 0,
    produtosCatalogo: 0,
    estoqueTotal: 0,
    comandasAbertas: 0,
    caixasAbertos: 0,
  });
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    const hoje = new Date().toISOString().split("T")[0];
    const inicioHoje = `${hoje}T00:00:00Z`;
    const fimHoje = `${hoje}T23:59:59Z`;

    try {
      const [
        vendasHojeData,
        vendasTotaisData,
        produtosData,
        comandasAbertasData,
        caixasAbertosData,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("total, metodo_pagamento")
          .eq("status", "finalizada")
          .gte("updated_at", inicioHoje)
          .lte("updated_at", fimHoje),
        supabase
          .from("sales")
          .select("total", { count: "exact" })
          .eq("status", "finalizada"),
        supabase.from("products").select("quantidade", { count: "exact" }),
        supabase
          .from("sales")
          .select("id", { count: "exact" })
          .eq("status", "aberta"),
        supabase
          .from("caixas")
          .select("id", { count: "exact" })
          .eq("status", "aberto"),
      ]);

      const { data: recentSalesData, error: recentSalesError } = (await supabase
        .from("sales")
        .select(
          "id, created_at, total, nome_cliente, metodo_pagamento, status, profiles(nome)"
        )
        .gte("created_at", inicioHoje)
        .lte("created_at", fimHoje)
        .order("created_at", { ascending: false })) as {
        data: RecentSale[] | null;
        error: any;
      };

      if (recentSalesError) throw recentSalesError;

      const totalVendas =
        vendasTotaisData.data?.reduce((acc, v) => acc + Number(v.total), 0) || 0;
      const vendasHoje =
        vendasHojeData.data?.reduce((acc, v) => acc + Number(v.total), 0) || 0;
      const estoqueTotal =
        produtosData.data?.reduce((acc, p) => acc + p.quantidade, 0) || 0;

      setKpiStats({
        totalVendas,
        vendasHoje,
        produtosCatalogo: produtosData.count || 0,
        estoqueTotal,
        comandasAbertas: comandasAbertasData.count || 0,
        caixasAbertos: caixasAbertosData.count || 0,
      });

      const breakdown = (vendasHojeData.data || []).reduce((acc, sale) => {
        const method = sale.metodo_pagamento || "pix";
        acc[method] = (acc[method] || 0) + sale.total;
        return acc;
      }, {} as Record<PaymentMethod, number>);

      const chartData = Object.keys(breakdown)
        .map((key) => ({
          name: paymentMethodLabels[key as PaymentMethod],
          value: breakdown[key as PaymentMethod],
          color: COLORS[key as PaymentMethod],
        }))
        .sort((a, b) => a.value - b.value);

      setPaymentData(chartData);
      setRecentSales(recentSalesData ?? []);
    } catch (error: any) {
      toast.error("Erro ao carregar o dashboard", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema em tempo real
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {kpiStats.vendasHoje.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Vendas finalizadas hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Comandas Abertas
            </CardTitle>
            <List className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiStats.comandasAbertas}</div>
            <p className="text-xs text-muted-foreground">
              Em atendimento agora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Status dos Caixas
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold">-</div>
            ) : kpiStats.caixasAbertos > 0 ? (
              <>
                <div className="text-2xl font-bold flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  {kpiStats.caixasAbertos}
                </div>
                <p className="text-xs text-muted-foreground">
                  Caixa(s) aberto(s) agora
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  Fechado
                </div>
                <p className="text-xs text-muted-foreground">
                  Nenhum caixa aberto
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpiStats.produtosCatalogo}
            </div>
            <p className="text-xs text-muted-foreground">Itens no catálogo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Total</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiStats.estoqueTotal}</div>
            <p className="text-xs text-muted-foreground">Total de unidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vendas (Total)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {kpiStats.totalVendas.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Vendas (histórico)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabelas e gráficos */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Comandas do Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horário</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && recentSales.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      Nenhuma comanda criada hoje.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  recentSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {format(new Date(sale.created_at), "HH:mm")}
                      </TableCell>
                      <TableCell>{sale.nome_cliente || "--"}</TableCell>
                      <TableCell>{sale.profiles?.nome || "N/A"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            sale.status === "finalizada"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {statusLabels[sale.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {Number(sale.total).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Pagamentos (Hoje)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                Carregando...
              </div>
            )}
            {!loading && paymentData.length === 0 && (
              <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                Nenhum pagamento finalizado hoje.
              </div>
            )}
            {!loading && paymentData.length > 0 && (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={paymentData}
                    layout="vertical"
                    margin={{ left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      dx={-10}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: number) =>
                        `R$ ${value.toFixed(2)}`
                      }
                      cursor={{ fill: "transparent" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
