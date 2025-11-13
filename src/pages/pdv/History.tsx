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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Download, Lock, ChevronDown } from "lucide-react"; 

// Importações para o PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Definição dos Tipos (Usando o que já existe) ---
type Sale = Database["public"]["Tables"]["sales"]["Row"];
type Movement = Database["public"]["Tables"]["movements"]["Row"];
type SaleItem = Database["public"]["Tables"]["sale_items"]["Row"] & {
  products: { nome: string } | null;
};
type MovementType = Database["public"]["Enums"]["movement_type"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

// Mapa para formatar os nomes dos pagamentos
const paymentMethodLabels: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
};

// --- MODAL DE MOVIMENTAÇÃO (EXPORTADO) ---
// (Usado pelo CaixaRapido.tsx para "Abrir Caixa")
interface MovementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMovementRegistered: () => void;
}
export function MovementsModal({ isOpen, onClose, onMovementRegistered }: MovementsModalProps) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<MovementType | "">("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tipo || !valor) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("movements").insert({
      tipo: tipo,
      valor: parseFloat(valor),
      descricao: descricao || (tipo === 'entrada' ? 'Abertura de Caixa' : 'Fechamento de Caixa'),
      responsavel_id: user.id,
    });

    setLoading(false);
    if (error) {
      toast.error("Erro ao registrar movimento", { description: error.message });
    } else {
      toast.success("Movimento registrado com sucesso!");
      onMovementRegistered(); 
      onClose();
      setTipo("");
      setValor("");
      setDescricao("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Movimento de Caixa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as MovementType)}>
              <SelectTrigger id="tipo">
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada (Abertura)</SelectItem>
                <SelectItem value="saida">Saída (Fechamento/Sangria)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (Opcional)</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Abertura, Sangria, etc."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
// --- FIM DO MODAL ---


export default function CollaboratorHistory() {
  const { user, userName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]); 
  
  // Guarda a data/hora da última abertura de caixa
  const [dataAbertura, setDataAbertura] = useState<string | null>(null);

  const [isCloseCaixaAlertOpen, setIsCloseCaixaAlertOpen] = useState(false);

  useEffect(() => {
    if (user) {
      checkCaixaAberto();
    }
  }, [user]);

  // Função para verificar o estado do caixa (aberto ou fechado)
  const checkCaixaAberto = async () => {
    if (!user) return;
    setLoading(true);

    const hoje = new Date().toISOString().split('T')[0];
    const inicioDoDia = `${hoje}T00:00:00Z`;

    // 1. Encontra a última ABERTURA (entrada) do dia
    const { data: lastEntradaData } = await supabase
      .from('movements')
      .select('created_at')
      .eq('responsavel_id', user.id)
      .eq('tipo', 'entrada')
      .gte('created_at', inicioDoDia)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastEntradaData) {
      // Nenhuma abertura de caixa hoje
      setLoading(false);
      setDataAbertura(null);
      setSales([]);
      setMovements([]);
      return;
    }

    // 2. Encontra o último FECHAMENTO (saida) do dia
    const { data: lastSaidaData } = await supabase
      .from('movements')
      .select('created_at')
      .eq('responsavel_id', user.id)
      .eq('tipo', 'saida')
      .gte('created_at', inicioDoDia)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 3. Compara
    // O caixa está aberto se:
    // A) Houve uma entrada E (B) não houve saida
    // OU
    // C) A última entrada for MAIS RECENTE que a última saída
    const isAberto = lastEntradaData && 
                     (!lastSaidaData || new Date(lastEntradaData.created_at) > new Date(lastSaidaData.created_at));

    if (isAberto) {
      const dataInicio = lastEntradaData.created_at;
      setDataAbertura(dataInicio);
      loadSales(dataInicio);
      loadMovements(dataInicio);
    } else {
      // O caixa está fechado
      setLoading(false);
      setDataAbertura(null);
      setSales([]);
      setMovements([]);
    }
  };

  // Carrega vendas desde a data de abertura
  const loadSales = async (dataInicio: string) => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('colaborador_id', user.id)
      .eq('status', 'finalizada') 
      .gte('updated_at', dataInicio) // A partir da abertura
      .order('created_at', { ascending: false });
    
    if (data) setSales(data);
    if (error) toast.error("Erro ao carregar vendas", { description: error.message });
    setLoading(false);
  };

  // Carrega movimentos desde a data de abertura
  const loadMovements = async (dataInicio: string) => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('movements')
      .select('*')
      .eq('responsavel_id', user.id) 
      .gte('created_at', dataInicio) // A partir da abertura
      .order('created_at', { ascending: false });
    
    if (data) setMovements(data);
    if (error) toast.error("Erro ao carregar movimentos", { description: error.message });
    setLoading(false);
  };

  // --- CÁLCULOS PARA O RESUMO ---
  const { totalVendas, totalEntradas, totalSaidas } = useMemo(() => {
    const totalVendas = sales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0);
    
    let totalEntradas = 0;
    let totalSaidas = 0;
    movements.forEach(mov => {
      if (mov.tipo === 'entrada') {
        totalEntradas += Number(mov.valor);
      } else {
        totalSaidas += Number(mov.valor);
      }
    });

    return { totalVendas, totalEntradas, totalSaidas };
  }, [sales, movements]);

  // --- LÓGICA DE GERAÇÃO DE PDF ATUALIZADA ---
  const generatePDF = () => {
    if (!dataAbertura) return;

    const doc = new jsPDF();
    const today = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    
    doc.text("Relatório de Caixa", 14, 16);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${today}`, 14, 22);
    doc.text(`Colaborador: ${userName || user?.email}`, 14, 28);
    doc.text(`Período de: ${format(new Date(dataAbertura), "dd/MM/yy HH:mm")}`, 14, 34);

    // 1. Tabela de Vendas (SEM ID)
    let totalVendasCalc = 0;
    const salesBody = sales.map(sale => {
      const total = Number(sale.total) || 0; 
      totalVendasCalc += total;
      return [
        format(new Date(sale.updated_at || sale.created_at), "dd/MM HH:mm", { locale: ptBR }),
        // Coluna "ID Venda" removida
        sale.metodo_pagamento ? paymentMethodLabels[sale.metodo_pagamento] : 'N/A',
        `R$ ${total.toFixed(2)}`
      ];
    });
    
    doc.setFontSize(12);
    doc.text("Vendas Finalizadas", 14, 46);
    autoTable(doc, {
      startY: 48,
      head: [['Data', 'Pagamento', 'Total']], // Header atualizado
      body: salesBody,
      foot: [['Total de Vendas', '', `R$ ${totalVendasCalc.toFixed(2)}`]], // Footer atualizado
      theme: 'striped',
      headStyles: { fillColor: [38, 38, 38] },
    });

    // 2. Tabela de Movimentações
    let totalEntradasCalc = 0;
    let totalSaidasCalc = 0;
    const movementsBody = movements.map(mov => {
      const valor = Number(mov.valor) || 0;
      if (mov.tipo === 'entrada') totalEntradasCalc += valor;
      else totalSaidasCalc += valor;
      return [
        format(new Date(mov.created_at), "dd/MM HH:mm", { locale: ptBR }),
        mov.tipo === 'entrada' ? 'Entrada' : 'Saída',
        mov.descricao,
        `R$ ${valor.toFixed(2)}`
      ];
    });

    const lastTableY = (doc as any).lastAutoTable.finalY || 80;
    doc.setFontSize(12);
    doc.text("Movimentações de Caixa", 14, lastTableY + 15);
    autoTable(doc, {
      startY: lastTableY + 17,
      head: [['Data', 'Tipo', 'Descrição', 'Valor']],
      body: movementsBody,
      theme: 'striped',
      headStyles: { fillColor: [38, 38, 38] },
    });

    // 3. Resumo Final (SEM A+B-C)
    const finalTableY = (doc as any).lastAutoTable.finalY || 120;
    
    doc.setFontSize(12);
    doc.text("Resumo do Caixa", 14, finalTableY + 15);
    autoTable(doc, {
      startY: finalTableY + 17,
      body: [
        ['Total de Vendas', `R$ ${totalVendasCalc.toFixed(2)}`],
        ['Total de Entradas', `R$ ${totalEntradasCalc.toFixed(2)}`],
        ['Total de Saídas', `R$ ${totalSaidasCalc.toFixed(2)}`],
      ],
      theme: 'grid',
      bodyStyles: { fontStyle: 'bold' }
    });

    doc.save(`Relatorio_Caixa_${userName || 'colaborador'}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const handleGenerateReport = () => {
    if (sales.length === 0 && movements.length === 0) {
      toast.info("Não há dados para gerar o relatório.");
      return;
    }
    generatePDF();
    toast.success("Relatório gerado!");
  };
  
  // --- Ação de Fechar o Caixa ---
  const handleConfirmCloseCaixa = async () => {
    if (!user) return;

    // Calcula o valor final em caixa (Dinheiro das vendas + Entradas - Saídas)
    // O valor de abertura JÁ ESTÁ nas "totalEntradas"
    const valorFechamento = totalVendas + totalEntradas - totalSaidas;

    // Cria o movimento de SAÍDA que marca o fechamento
    const { error } = await supabase
      .from('movements')
      .insert({
        responsavel_id: user.id,
        tipo: 'saida',
        valor: valorFechamento, // Registra o valor total que saiu do caixa
        descricao: 'Fechamento de Caixa'
      });
    
    if (error) {
      toast.error("Erro ao fechar o caixa", { description: error.message });
    } else {
      toast.success("Caixa fechado com sucesso!");
      setIsCloseCaixaAlertOpen(false); // Fecha o alerta
      checkCaixaAberto(); // Re-executa a verificação, que vai limpar a tela
    }
  };

  // --- Renderização ---
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se o caixa ESTIVER FECHADO (dataAbertura é null)
  if (!dataAbertura) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Caixa Fechado</h1>
        <Card>
          <CardHeader>
            <CardTitle>Nenhum caixa aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Vá para a tela de **Caixa Rápido** para registrar uma "Abertura de Caixa" (movimento de entrada) e começar o dia.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se o caixa ESTIVER ABERTO
  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meu Caixa do Dia</h1>
            <p className="text-muted-foreground">
              Caixa aberto às {format(new Date(dataAbertura), "dd/MM/yy HH:mm")}
            </p>
          </div>
          
          <AlertDialog open={isCloseCaixaAlertOpen} onOpenChange={setIsCloseCaixaAlertOpen}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="destructive">
                  Opções de Fechamento
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleGenerateReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Gerar Relatório (PDF)
                </DropdownMenuItem>
                
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <Lock className="h-4 w-4 mr-2" />
                    Fechar Caixa
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Modal de Confirmação para Fechar Caixa */}
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza que deseja fechar o caixa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá registrar um movimento de saída com o valor total em caixa 
                  (R$ { (totalVendas + totalEntradas - totalSaidas).toFixed(2)} ) e limpará esta tela.
                  Você deverá abrir um novo caixa no próximo turno.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmCloseCaixa}>
                  Sim, Fechar o Caixa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Card de Vendas */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas Realizadas (Caixa Atual)</CardTitle>
            <CardDescription>
              Vendas finalizadas desde a abertura deste caixa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horário</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Nenhuma venda finalizada neste caixa.
                    </TableCell>
                  </TableRow>
                )}
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      {format(new Date(sale.updated_at || sale.created_at), "HH:mm:ss")}
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
                    <TableCell>
                      <SaleDetailsDialog saleId={sale.id} />
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


// --- Componente de Detalhes da Venda (Sem alteração) ---
function SaleDetailsDialog({ saleId }: { saleId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDetails = async () => {
    if (!isOpen) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('sale_items')
      .select('*, products(nome)')
      .eq('venda_id', saleId);
    
    if (error) {
      toast.error("Erro ao buscar detalhes", { description: error.message });
    } else {
      setItems(data as SaleItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDetails();
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Ver Detalhes</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalhes da Venda</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div>Carregando...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Qtd.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell>{item.products?.nome || "Produto removido"}</TableCell>
                  <TableCell>{item.quantidade}</TableCell>
                  <TableCell className="text-right">R$ {Number(item.subtotal).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}