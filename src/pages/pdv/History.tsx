// src/pages/pdv/History.tsx
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger, // Corrigido da última vez
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Download } from "lucide-react"; // Importa o ícone de download

// --- NOVAS IMPORTAÇÕES PARA PDF ---
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Tipos locais
type Caixa = Database["public"]["Tables"]["caixas"]["Row"];
type Sale = Database["public"]["Tables"]["sales"]["Row"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

// Mapa para formatar os nomes dos pagamentos
const paymentMethodLabels: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
};

export default function CollaboratorHistory() {
  const { user, userName } = useAuth(); // Pega o userName para o PDF
  const [loading, setLoading] = useState(true);
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  
  const [isAberturaModalOpen, setIsAberturaModalOpen] = useState(false);
  const [valorAbertura, setValorAbertura] = useState("");
  const [isFechamentoModalOpen, setIsFechamentoModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      checkCaixaAberto();
    }
  }, [user]);

  // 1. Verifica se o colaborador tem um caixa 'aberto' HOJE
  const checkCaixaAberto = async () => {
    if (!user) return;
    setLoading(true);

    const hoje = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('caixas')
      .select('*')
      .eq('colaborador_id', user.id)
      .eq('status', 'aberto')
      .gte('data_abertura', `${hoje}T00:00:00Z`)
      .lte('data_abertura', `${hoje}T23:59:59Z`)
      .single();
    
    if (data) {
      setCaixaAberto(data);
      loadSales(data.data_abertura);
    } else {
      setIsAberturaModalOpen(true);
      setLoading(false);
    }

    if (error && error.code !== 'PGRST116') {
      toast.error("Erro ao verificar caixa", { description: error.message });
    }
  };

  // 2. Carrega as vendas do dia (a partir da abertura)
  const loadSales = async (dataAbertura: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('colaborador_id', user.id)
      .eq('status', 'finalizada')
      .gte('updated_at', dataAbertura)
      .order('created_at', { ascending: false });
    
    if (data) {
      setSales(data);
    }
    if (error) {
      toast.error("Erro ao carregar vendas", { description: error.message });
    }
    setLoading(false);
  };

  // 3. Função para abrir o caixa (chamada pelo modal)
  const handleAbrirCaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const valor = parseFloat(valorAbertura);
    if (isNaN(valor) || valor < 0) {
      toast.error("Valor inválido", { description: "Por favor, insira um valor positivo."});
      return;
    }

    const { data, error } = await supabase
      .from('caixas')
      .insert({
        colaborador_id: user.id,
        valor_abertura: valor
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao abrir caixa", { description: error.message });
    } else if (data) {
      toast.success("Caixa aberto com sucesso!");
      setCaixaAberto(data);
      setIsAberturaModalOpen(false);
      setValorAbertura("");
      loadSales(data.data_abertura);
    }
  };

  // --- CÁLCULOS PARA O RESUMO ---
  // Calcula o total de vendas (R$ 30,00 na sua imagem)
  const totalVendas = useMemo(() => {
    return sales.reduce((acc, sale) => acc + sale.total, 0);
  }, [sales]);

  // NOVO: Calcula o detalhamento por forma de pagamento
  const paymentBreakdown = useMemo(() => {
    const breakdown = {
      dinheiro: 0,
      pix: 0,
      cartao_credito: 0,
      cartao_debito: 0,
    };

    sales.forEach(sale => {
      if (sale.metodo_pagamento) {
        breakdown[sale.metodo_pagamento] += sale.total;
      }
    });
    return breakdown;
  }, [sales]);

  // Calcula o valor final em caixa (R$ 230,00 na sua imagem)
  const valorTotalEmCaixa = useMemo(() => {
    if (!caixaAberto) return 0;
    return caixaAberto.valor_abertura + totalVendas;
  }, [caixaAberto, totalVendas]);


  // 4. Função para fechar o caixa
  const handleFecharCaixa = async () => {
    if (!caixaAberto) return;

    const { error } = await supabase
      .from('caixas')
      .update({
        status: 'fechado',
        data_fechamento: new Date().toISOString(),
        valor_fechamento: valorTotalEmCaixa // Salva o valor total calculado
      })
      .eq('id', caixaAberto.id);
    
    if (error) {
      toast.error("Erro ao fechar o caixa", { description: error.message });
    } else {
      toast.success("Caixa fechado com sucesso!");
      setCaixaAberto(null);
      setSales([]);
      setIsFechamentoModalOpen(false);
      setIsAberturaModalOpen(true);
    }
  };

  // --- NOVA FUNÇÃO: Exportar PDF ---
  const handleExportPDF = () => {
    if (!caixaAberto) return;

    const doc = new jsPDF();
    const dataFormatada = format(new Date(), "dd/MM/yyyy HH:mm");

    // Título
    doc.setFontSize(18);
    doc.text("Relatório de Fechamento de Caixa", 14, 22);

    // Informações
    doc.setFontSize(11);
    doc.text(`Colaborador: ${userName || user?.email || 'N/A'}`, 14, 32);
    doc.text(`Data de Fechamento: ${dataFormatada}`, 14, 38);
    doc.text(`Caixa Aberto em: ${format(new Date(caixaAberto.data_abertura), "dd/MM/yyyy HH:mm")}`, 14, 44);

    // Tabela com o resumo
    const tableData = [
      ["Valor Abertura:", `R$ ${Number(caixaAberto.valor_abertura).toFixed(2)}`],
      ["Vendas (Dinheiro):", `R$ ${Number(paymentBreakdown.dinheiro).toFixed(2)}`],
      ["Vendas (Pix):", `R$ ${Number(paymentBreakdown.pix).toFixed(2)}`],
      ["Vendas (Débito):", `R$ ${Number(paymentBreakdown.cartao_debito).toFixed(2)}`],
      ["Vendas (Crédito):", `R$ ${Number(paymentBreakdown.cartao_credito).toFixed(2)}`],
      ["Total de Vendas:", `R$ ${Number(totalVendas).toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: 54,
      head: [['Descrição', 'Valor']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] }, // Cor azul (primary)
    });

    // Total Final
    const finalY = (doc as any).lastAutoTable.finalY || 100; // Pega a posição final da tabela
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Valor Total em Caixa:", 14, finalY + 15);
    doc.text(`R$ ${Number(valorTotalEmCaixa).toFixed(2)}`, 100, finalY + 15);

    // Salva o arquivo
    doc.save(`fechamento_caixa_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
  };

  // --- Renderização ---
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Modal de Abertura
  if (!caixaAberto) {
    return (
      <Dialog open={isAberturaModalOpen} onOpenChange={setIsAberturaModalOpen}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <form onSubmit={handleAbrirCaixa}>
            <DialogHeader>
              <DialogTitle>Abrir Caixa</DialogTitle>
              <DialogDescription>
                Você precisa informar o valor inicial do seu caixa para começar o dia.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="valor-abertura">Valor de Abertura (Fundo de Caixa)</Label>
              <Input
                id="valor-abertura"
                type="number"
                step="0.01"
                placeholder="R$ 200,00"
                value={valorAbertura}
                onChange={(e) => setValorAbertura(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit">Abrir Caixa</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // Página de Histórico
  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meu Caixa do Dia</h1>
            <p className="text-muted-foreground">
              Caixa aberto às {format(new Date(caixaAberto.data_abertura), "HH:mm")} com R$ {Number(caixaAberto.valor_abertura).toFixed(2)}
            </p>
          </div>
          <Dialog open={isFechamentoModalOpen} onOpenChange={setIsFechamentoModalOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">Fechar Caixa</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirmar Fechamento de Caixa</DialogTitle>
                <DialogDescription>
                  Confira os valores e confirme o fechamento. Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              
              {/* --- CONTEÚDO DO MODAL ATUALIZADO --- */}
              <div className="py-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Valor Abertura:</span>
                  <span className="font-medium">R$ {Number(caixaAberto.valor_abertura).toFixed(2)}</span>
                </div>
                
                <hr />
                <p className="text-sm font-medium text-muted-foreground">Vendas Recebidas:</p>
                
                <div className="pl-4 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Dinheiro:</span>
                    <span className="font-medium">R$ {Number(paymentBreakdown.dinheiro).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Pix:</span>
                    <span className="font-medium">R$ {Number(paymentBreakdown.pix).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Débito:</span>
                    <span className="font-medium">R$ {Number(paymentBreakdown.cartao_debito).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Crédito:</span>
                    <span className="font-medium">R$ {Number(paymentBreakdown.cartao_credito).toFixed(2)}</span>
                  </div>
                </div>
                
                <hr />
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total de Vendas:</span>
                  <span className="font-medium">R$ {Number(totalVendas).toFixed(2)}</span>
                </div>
                
                <hr />

                <div className="flex justify-between items-center text-lg">
                  <span className="font-bold">Valor Total em Caixa:</span>
                  <span className="font-bold text-primary">R$ {Number(valorTotalEmCaixa).toFixed(2)}</span>
                </div>
              </div>
              {/* --- FIM DA ATUALIZAÇÃO DO MODAL --- */}

              <DialogFooter className="sm:justify-between">
                {/* --- NOVO BOTÃO PDF --- */}
                <Button type="button" variant="ghost" onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Salvar PDF
                </Button>
                
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsFechamentoModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" variant="destructive" onClick={handleFecharCaixa}>
                    Confirmar Fechamento
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vendas Realizadas Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horário</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhuma venda finalizada após a abertura do caixa.
                    </TableCell>
                  </TableRow>
                )}
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      {format(new Date(sale.created_at), "HH:mm:ss", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>{sale.nome_cliente || "--"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {sale.metodo_pagamento ? paymentMethodLabels[sale.metodo_pagamento] : "N/A"}
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
      </div>
    </>
  );
}