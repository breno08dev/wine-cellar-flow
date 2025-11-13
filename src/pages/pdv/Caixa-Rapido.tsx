// src/pages/pdv/CaixaRapido.tsx
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Minus, X, Search, ShoppingCart, CreditCard, Landmark, Wallet, DollarSign } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";

// --- Definição dos Tipos ---
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type Product = ProductRow & {
  categories: { nome: string } | null;
};
type CartItem = Product & {
  quantidade_venda: number;
};
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

// NOVO TIPO - Status do Caixa
type CaixaStatus = "aberto" | "fechado" | "loading";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
};

export default function CaixaRapido() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- LÓGICA DE ABERTURA DE CAIXA ---
  const [isCaixaModalOpen, setIsCaixaModalOpen] = useState(false);
  const [valorAbertura, setValorAbertura] = useState("");
  const [caixaStatus, setCaixaStatus] = useState<CaixaStatus>("loading");
  const [isSubmittingCaixa, setIsSubmittingCaixa] = useState(false);

  // Efeito para carregar produtos e categorias
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data: prodData, error: prodErr } = await supabase
          .from('products')
          .select('*, categories(nome)')
          .order('nome');

        if (prodErr) throw prodErr; 

        const { data: catData, error: catErr } = await supabase
          .from('categories')
          .select('*')
          .order('nome');

        if (catErr) throw catErr;

        setProducts(prodData as Product[]);
        setCategories(catData);

      } catch (error: any) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao carregar produtos ou categorias", {
          description: error.message || "Verifique sua conexão ou permissões (RLS)."
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []); 

  // --- EFEITO: Verificar Status do Caixa (Lendo da tabela 'caixas') ---
  const checkCaixaStatus = async () => {
    if (!user) {
      setCaixaStatus("fechado");
      return;
    }
    
    setCaixaStatus("loading");
    try {
      // Esta chamada falha com 406 se a POLÍTICA DE SELECT não existir
      const { data, error } = await supabase
        .from("caixas")
        .select("id")
        .eq("colaborador_id", user.id)
        .eq("status", "aberto")
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = "no rows found"
        throw error;
      }
      
      if (data) {
        setCaixaStatus("aberto");
      } else {
        setCaixaStatus("fechado");
      }
    } catch (error: any) {
      console.error("Erro ao verificar status do caixa (RLS?):", error);
      // Não mostramos toast aqui, pois o erro 406 (sem permissão) é comum
      // e o usuário não precisa ser notificado toda vez.
      setCaixaStatus("fechado");
    }
  };

  useEffect(() => {
    // Roda a verificação de status quando o usuário é carregado
    checkCaixaStatus();
  }, [user]);


  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.categoria_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantidade_venda: item.quantidade_venda + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantidade_venda: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, amount: number) => {
    setCart(prevCart => {
      const newAmount = Math.max(0, amount);
      if (newAmount === 0) {
        return prevCart.filter(item => item.id !== productId);
      }
      return prevCart.map(item =>
        item.id === productId
          ? { ...item, quantidade_venda: newAmount }
          : item
      );
    });
  };

  const totalCompra = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.preco_venda) * item.quantidade_venda), 0);
  }, [cart]);

  // --- Função Principal: Finalizar a Venda ---
  const handleFinalizeSale = async () => {
    if (!user) return toast.error("Usuário não encontrado. Faça login.");
    if (cart.length === 0) return toast.error("Carrinho vazio.");
    if (!paymentMethod) return toast.error("Escolha um método de pagamento.");
    
    if (caixaStatus !== 'aberto') {
      return toast.error("O caixa está fechado!", {
        description: "Você precisa abrir o caixa antes de registrar uma venda."
      });
    }

    setIsSubmitting(true);

    try {
      // 1. Criar a Venda (sales)
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          colaborador_id: user.id,
          status: 'finalizada', 
          metodo_pagamento: paymentMethod,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Preparar os Itens da Venda (sale_items)
      const saleItems = cart.map(item => ({
        venda_id: saleData.id,
        produto_id: item.id,
        quantidade: item.quantidade_venda,
        preco_unitario: Number(item.preco_venda),
        subtotal: Number(item.preco_venda) * item.quantidade_venda,
      }));

      // 3. Inserir os Itens (Isso vai disparar o trigger)
      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) {
        await supabase.from('sales').delete().eq('id', saleData.id);
        throw itemsError;
      }
      
      // 4. Sucesso: Limpar tudo
      toast.success("Venda finalizada com sucesso!");
      setCart([]);
      setPaymentMethod("");
      setIsPaymentModalOpen(false);
      
    } catch (error: any) {
      console.error("Erro ao finalizar venda:", error);
      toast.error("Erro ao finalizar venda", { description: error.message });
    } finally {
      setIsSubmitting(false); 
    }
  };

  // --- FUNÇÃO DE ABRIR CAIXA (ATUALIZADA) ---
  // Salva na tabela 'caixas' (para status) E na tabela 'movements' (para o histórico)
  const handleOpenCaixa = async () => {
    if (!user) return toast.error("Usuário não encontrado. Faça login.");
    
    const valorNum = parseFloat(valorAbertura.replace(",", "."));
    if (isNaN(valorNum) || valorNum < 0) {
      return toast.error("Valor de abertura inválido.");
    }

    if (caixaStatus === 'aberto') {
      return toast.error("O caixa já está aberto.");
    }

    setIsSubmittingCaixa(true);
    try {
      // --- ETAPA 1: Criar o registro do caixa (para status) ---
      // Esta chamada falha se a POLÍTICA DE INSERT não existir
      const { data: caixaData, error: caixaError } = await supabase
        .from("caixas")
        .insert({
          colaborador_id: user.id,
          valor_abertura: valorNum,
          status: "aberto"
          // data_abertura é definida por 'default now()' no banco
        })
        .select()
        .single();

      if (caixaError) {
        console.error("Erro ao inserir na tabela caixas (RLS?):", caixaError);
        throw new Error(`Falha ao abrir caixa (status): ${caixaError.message}`);
      }
      
      console.log("Caixa (status) aberto com sucesso:", caixaData);

      // --- ETAPA 2: Criar o movimento (para o histórico) ---
      // (created_at é automático, mas usamos data_abertura para linkar)
      const { error: movementError } = await supabase
        .from("movements")
        .insert({
          responsavel_id: user.id,
          tipo: "entrada", // Tipo 'entrada' = Suprimento
          descricao: 'Abertura de Caixa', // History.tsx procura por esta string
          valor: valorNum,
          // Garante que o movimento tenha o mesmo timestamp do caixa
          created_at: caixaData.data_abertura 
        });

      if (movementError) {
        // Se o movimento falhar, precisamos reverter a abertura do caixa
        console.error("Erro ao criar movimento no histórico (RLS?):", movementError);
        await supabase.from("caixas").delete().eq("id", caixaData.id);
        throw new Error(`Falha ao registrar histórico (movimento): ${movementError.message}`);
      }
      
      console.log("Movimento de abertura registrado no histórico.");
      
      toast.success("Caixa aberto com sucesso!");
      setCaixaStatus("aberto"); // Atualiza o estado local
      setIsCaixaModalOpen(false); // Fecha o modal
      setValorAbertura(""); // Limpa o input
      
    } catch (error: any) {
      console.error("Erro ao abrir caixa:", error);
      toast.error("Erro ao abrir caixa", {
        description: error.message || "Verifique suas permissões (RLS) ou a conexão."
      });
    } finally {
      setIsSubmittingCaixa(false);
    }
  };


  // --- Renderização da UI ---
  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))]">
      {/* Coluna Esquerda: Vitrine de Produtos */}
      <div className="w-1/2 flex flex-col p-4 border-r">
        <h1 className="text-2xl font-bold">Produtos</h1>
        
        <div className="flex gap-2 my-4">
          <Input 
            placeholder="Buscar produto..." 
            className="flex-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading && <div className="text-center mt-8">Carregando produtos...</div>}

        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
          {filteredProducts.map(product => (
            <Card key={product.id} className="flex flex-col">
              <CardHeader className="p-3">
                <CardTitle className="text-base">{product.nome}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-3">
                <p className="text-sm text-muted-foreground">{product.categories?.nome || "--"}</p>
                <p className="text-lg font-bold mt-2">R$ {Number(product.preco_venda).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Estoque: {product.quantidade}</p>
              </CardContent>
              <Button 
                className="m-3" 
                onClick={() => addToCart(product)}
                disabled={product.quantidade <= 0 || caixaStatus !== 'aberto'} // Desabilita se o caixa estiver fechado
              >
                {product.quantidade <= 0 ? "Esgotado" : "Adicionar"}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Coluna Direita: Carrinho e Resumo */}
      <div className="w-1/2 flex flex-col p-4">
        
        {/* --- CARD DE CONTROLE DE CAIXA --- */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <CardTitle className="text-lg">Controle de Caixa</CardTitle>
            <Button 
              onClick={() => setIsCaixaModalOpen(true)}
              disabled={caixaStatus !== 'fechado'} // Desabilita se o caixa NÃO estiver fechado
            >
              <DollarSign className="h-4 w-4 mr-2" />
              {caixaStatus === 'loading' ? "Verificando..." : caixaStatus === 'aberto' ? "Caixa Aberto" : "Abrir Caixa"}
            </Button>
          </CardHeader>
        </Card>

        {/* Card de Resumo da Compra */}
        <Card className="flex-1 flex flex-col">
          <CardHeader className="p-4">
            <CardTitle>Resumo da Compra</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <ShoppingCart className="mx-auto h-12 w-12" />
                <p className="mt-2">Carrinho vazio</p>
                {caixaStatus !== 'aberto' && (
                  <p className="text-sm text-destructive mt-2">Abra o caixa para iniciar as vendas.</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Qtd.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-[50px]"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.nome}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartQuantity(item.id, item.quantidade_venda - 1)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center">{item.quantidade_venda}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartQuantity(item.id, item.quantidade_venda + 1)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {(Number(item.preco_venda) * item.quantidade_venda).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => updateCartQuantity(item.id, 0)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <div className="p-4 border-t">
            <div className="flex justify-between items-center text-2xl font-bold mb-4">
              <span>Total</span>
              <span>R$ {totalCompra.toFixed(2)}</span>
            </div>
            <Button 
              className="w-full h-12 text-lg" 
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={cart.length === 0 || isSubmitting || caixaStatus !== 'aberto'} // Desabilita se o caixa estiver fechado
            >
              {caixaStatus !== 'aberto' ? "Caixa Fechado" : "Finalizar Venda"}
            </Button>
          </div>
        </Card>
      </div>

      {/* Modal de Pagamento */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar Venda</DialogTitle>
            <DialogDescription>
              Total da Compra: <span className="font-bold text-primary text-lg">R$ {totalCompra.toFixed(2)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Método de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger> 
              <SelectContent>
                <SelectItem value="dinheiro"><Wallet className="inline h-4 w-4 mr-2" />Dinheiro</SelectItem>
                <SelectItem value="pix"><Landmark className="inline h-4 w-4 mr-2" />Pix</SelectItem>
                <SelectItem value="cartao_debito"><CreditCard className="inline h-4 w-4 mr-2" />Cartão de Débito</SelectItem>
                <SelectItem value="cartao_credito"><CreditCard className="inline h-4 w-4 mr-2" />Cartão de Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleFinalizeSale} disabled={isSubmitting}>
              {isSubmitting ? "Finalizando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL DE ABERTURA DE CAIXA --- */}
      <Dialog open={isCaixaModalOpen} onOpenChange={setIsCaixaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Caixa</DialogTitle>
            <DialogDescription>
              Insira o valor inicial (suprimento) para abrir o caixa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label htmlFor="valorAbertura">Valor de Abertura (R$)</Label>
            <Input 
              id="valorAbertura"
              type="number"
              placeholder="0,00"
              value={valorAbertura}
              onChange={(e) => setValorAbertura(e.target.value)}
              disabled={isSubmittingCaixa}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCaixaModalOpen(false)} disabled={isSubmittingCaixa}>
              Cancelar
            </Button>
            <Button onClick={handleOpenCaixa} disabled={isSubmittingCaixa}>
              {isSubmittingCaixa ? "Abrindo..." : "Confirmar Abertura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}