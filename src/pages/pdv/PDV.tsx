// src/pages/pdv/PDV.tsx
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart, User, List, Minus } from "lucide-react"; 

// --- Tipos de Dados ---
type PaymentMethod = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";

interface Product {
  id: string;
  nome: string;
  preco_venda: number;
  quantidade: number;
}

interface SaleItem {
  produto_id: string;
  nome: string; // Vindo do join com products
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

// Comanda na lista da lateral
interface OpenSale {
  id: string;
  nome_cliente: string | null;
  numero_comanda: string | null;
  total: number;
}

// Comanda que está selecionada
interface SelectedSale extends OpenSale {
  sale_items: SaleItem[];
}

export default function PDV() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [openComandas, setOpenComandas] = useState<OpenSale[]>([]);
  const [selectedComanda, setSelectedComanda] = useState<SelectedSale | null>(null);

  // State para o modal de Nova Comanda
  const [isComandaModalOpen, setIsComandaModalOpen] = useState(false);
  const [newComandaNumber, setNewComandaNumber] = useState("");
  const [newComandaName, setNewComandaName] = useState("");

  // State para o modal de Pagamento
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("dinheiro");
  const [amountPaid, setAmountPaid] = useState("");

  // --- Carregamento Inicial ---
  useEffect(() => {
    loadProducts();
    loadOpenComandas();
  }, [user]);

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, nome, preco_venda, quantidade')
      .gt('quantidade', 0)
      .order('nome');
    if (data) setProducts(data);
  };

  const loadOpenComandas = async () => {
    const { data, error } = await supabase
      .from('sales')
      .select('id, nome_cliente, numero_comanda, total')
      .eq('status', 'aberta')
      .order('created_at', { ascending: true });
    
    if (error) {
      toast.error("Erro ao carregar comandas abertas", { description: error.message });
    } else {
      setOpenComandas(data);
    }
  };

  // --- Funções de Comanda ---

  const handleSelectComanda = async (comandaId: string) => {
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*, products(nome))')
      .eq('id', comandaId)
      .single();

    if (error) {
      toast.error("Erro ao selecionar comanda", { description: error.message });
      return;
    }

    if (data) {
      const items = (data.sale_items || []).map((item: any) => ({
        produto_id: item.produto_id,
        nome: item.products?.nome || 'Produto não encontrado',
        quantidade: item.quantidade,
        preco_unitario: Number(item.preco_unitario),
        subtotal: Number(item.subtotal),
      }));
      setSelectedComanda({ ...data, sale_items: items });
    }
  };

  const refreshSelectedComanda = async (comandaId: string) => {
    await handleSelectComanda(comandaId);
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { data, error } = await supabase
      .from('sales')
      .insert([{ 
        colaborador_id: user.id, 
        nome_cliente: newComandaName || null,
        numero_comanda: newComandaNumber || null,
      }])
      .select('*, sale_items(*, products(nome))')
      .single();

    if (error) {
      toast.error("Erro ao criar comanda", { description: error.message });
    } else if (data) {
      toast.success(`Comanda ${data.numero_comanda || ''} aberta!`);
      setIsComandaModalOpen(false);
      setNewComandaName("");
      setNewComandaNumber("");
      
      const newOpenComanda: OpenSale = {
        id: data.id,
        nome_cliente: data.nome_cliente,
        numero_comanda: data.numero_comanda,
        total: data.total,
      };

      const items: SaleItem[] = (data.sale_items || []).map((item: any) => ({
        produto_id: item.produto_id,
        nome: item.products.nome,
        quantidade: item.quantidade,
        preco_unitario: Number(item.preco_unitario),
        subtotal: Number(item.subtotal),
      }));

      const newSelectedComanda: SelectedSale = {
        id: data.id,
        nome_cliente: data.nome_cliente,
        numero_comanda: data.numero_comanda,
        total: data.total,
        sale_items: items,
      };

      setOpenComandas(prev => [...prev, newOpenComanda]);
      setSelectedComanda(newSelectedComanda);
    }
  };

  // *** NOVA LÓGICA (Etapa 1 de 2 para Finalizar) ***
  const handleAttemptFinishSale = () => {
    if (!selectedComanda) return;

    // REQUERIMENTO 1: Fechar comanda vazia
    if (selectedComanda.sale_items.length === 0) {
      handleCloseEmptyComanda(selectedComanda.id);
      return;
    }

    // REQUERIMENTO 2: Abrir modal de pagamento
    setAmountPaid(""); // Limpa o valor pago anterior
    setPaymentMethod("dinheiro"); // Reseta para dinheiro
    setIsPaymentModalOpen(true);
  };

  // *** NOVA FUNÇÃO (Para Fechar Comanda Vazia) ***
  const handleCloseEmptyComanda = async (comandaId: string) => {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', comandaId);

    if (error) {
      toast.error("Erro ao fechar comanda vazia", { description: error.message });
    } else {
      toast.info("Comanda vazia fechada.");
      setSelectedComanda(null);
      loadOpenComandas(); // Atualiza a lista da esquerda
    }
  };

  // *** LÓGICA ATUALIZADA (Etapa 2 de 2 para Finalizar) ***
  const handleConfirmPayment = async () => {
    if (!selectedComanda) return;

    const { error } = await supabase
      .from('sales')
      .update({ 
        status: 'finalizada',
        metodo_pagamento: paymentMethod 
      })
      .eq('id', selectedComanda.id);

    if (error) {
      toast.error("Erro ao finalizar venda", { description: error.message });
    } else {
      toast.success("Venda finalizada com sucesso!");
      setIsPaymentModalOpen(false);
      setSelectedComanda(null);
      loadOpenComandas();   
      loadProducts();       
    }
  };

  // --- Funções de Itens ---

  const handleAddItem = async (product: Product) => {
    if (!selectedComanda) {
      toast.error("Selecione uma comanda primeiro!");
      return;
    }

    const existingItem = selectedComanda.sale_items.find(item => item.produto_id === product.id);
    
    if (existingItem) {
      await handleIncrementItem(product.id, existingItem.quantidade);
    } else {
      const subtotal = product.preco_venda;
      const { error } = await supabase
        .from('sale_items')
        .insert([{
          venda_id: selectedComanda.id,
          produto_id: product.id,
          quantidade: 1,
          preco_unitario: product.preco_venda,
          subtotal: subtotal,
        }]);

      if (error) {
         toast.error("Erro ao adicionar item", { description: error.message });
      } else {
        loadProducts(); 
        refreshSelectedComanda(selectedComanda.id);
        loadOpenComandas();
      }
    }
  };

  const handleRemoveItem = async (produtoId: string) => {
    if (!selectedComanda) return;
    const { error } = await supabase
      .from('sale_items')
      .delete()
      .eq('venda_id', selectedComanda.id)
      .eq('produto_id', produtoId);
    if (error) {
      toast.error("Erro ao remover item", { description: error.message });
    } else {
      loadProducts();
      refreshSelectedComanda(selectedComanda.id);
      loadOpenComandas();
    }
  };

  const handleIncrementItem = async (produtoId: string, currentQuantity: number) => {
    if (!selectedComanda) return;
    const item = selectedComanda.sale_items.find(i => i.produto_id === produtoId);
    if (!item) return;
    const newQuantity = currentQuantity + 1;
    const newSubtotal = newQuantity * item.preco_unitario;
    const { error } = await supabase
      .from('sale_items')
      .update({ quantidade: newQuantity, subtotal: newSubtotal })
      .eq('venda_id', selectedComanda.id)
      .eq('produto_id', produtoId);
    if (error) {
      toast.error("Erro ao adicionar item", { description: error.message });
    } else {
      loadProducts();
      refreshSelectedComanda(selectedComanda.id);
      loadOpenComandas();
    }
  };

  const handleDecrementItem = async (produtoId: string, currentQuantity: number) => {
    if (!selectedComanda) return;
    if (currentQuantity === 1) {
      handleRemoveItem(produtoId);
      return;
    }
    const item = selectedComanda.sale_items.find(i => i.produto_id === produtoId);
    if (!item) return;
    const newQuantity = currentQuantity - 1;
    const newSubtotal = newQuantity * item.preco_unitario;
    const { error } = await supabase
      .from('sale_items')
      .update({ quantidade: newQuantity, subtotal: newSubtotal })
      .eq('venda_id', selectedComanda.id)
      .eq('produto_id', produtoId);
    if (error) {
      toast.error("Erro ao remover item", { description: error.message });
    } else {
      loadProducts();
      refreshSelectedComanda(selectedComanda.id);
      loadOpenComandas();
    }
  };

  // --- Memos para Cálculo ---
  const filteredProducts = products.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const troco = useMemo(() => {
    const total = selectedComanda?.total || 0;
    const paid = parseFloat(amountPaid) || 0;
    if (paymentMethod === 'dinheiro' && paid > total) {
      return paid - total;
    }
    return 0;
  }, [amountPaid, selectedComanda?.total, paymentMethod]);


  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sistema de Comandas</h1>
          <p className="text-muted-foreground">Gerencie suas comandas</p>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Coluna 1: Comandas Abertas */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Comandas Abertas
              </CardTitle>
              <Dialog open={isComandaModalOpen} onOpenChange={setIsComandaModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleCreateSale}>
                    <DialogHeader>
                      <DialogTitle>Abrir Nova Comanda</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="comanda-numero">Número (ou Mesa)</Label>
                        <Input
                          id="comanda-numero"
                          value={newComandaNumber}
                          onChange={(e) => setNewComandaNumber(e.target.value)}
                          placeholder="Ex: Mesa 5 ou 101"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="comanda-nome">Nome do Cliente</Label>
                        <Input
                          id="comanda-nome"
                          value={newComandaName}
                          onChange={(e) => setNewComandaName(e.target.value)}
                          placeholder="Ex: João Silva"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsComandaModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">Abrir Comanda</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              {openComandas.length > 0 ? openComandas.map((comanda) => (
                <Button
                  key={comanda.id}
                  variant={selectedComanda?.id === comanda.id ? "secondary" : "ghost"}
                  className="w-full justify-between h-auto py-3"
                  onClick={() => handleSelectComanda(comanda.id)}
                >
                  <div className="text-left">
                    <p className="font-bold text-sm">
                      {comanda.numero_comanda || "Comanda sem número"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {comanda.nome_cliente || "Sem cliente"}
                    </p>
                  </div>
                  <div className="text-right text-sm font-bold text-primary">
                    R$ {Number(comanda.total).toFixed(2)}
                  </div>
                </Button>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma comanda aberta</p>
              )}
            </CardContent>
          </Card>

          {/* Coluna 2: Lista de Produtos */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Produtos Disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!selectedComanda}
              />
              <div className="max-h-[600px] overflow-y-auto space-y-2">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                      !selectedComanda 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-accent cursor-pointer'
                    }`}
                    onClick={() => selectedComanda && handleAddItem(product)}
                  >
                    <div>
                      <p className="font-medium">{product.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        Estoque: {product.quantidade}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">
                        R$ {Number(product.preco_venda).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Coluna 3: Comanda Atual */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {selectedComanda ? 
                  `Comanda: ${selectedComanda.numero_comanda || selectedComanda.nome_cliente || 'Selecionada'}` : 
                  "Comanda Selecionada"}
              </CardTitle>
              {selectedComanda && (
                 <CardDescription>Cliente: {selectedComanda.nome_cliente || "Não informado"}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedComanda ? (
                <div className="space-y-4 max-h-[600px] flex flex-col">
                  <div className="flex-grow overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-center">Qtd</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedComanda.sale_items.map((item) => (
                          <TableRow key={item.produto_id}>
                            <TableCell className="font-medium">{item.nome}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1 sm:gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleDecrementItem(item.produto_id, item.quantidade)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="font-medium w-4 text-center">{item.quantidade}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleIncrementItem(item.produto_id, item.quantidade)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {item.subtotal.toFixed(2)}
                            </TableCell>
                            <TableCell className="px-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveItem(item.produto_id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="pt-4 border-t space-y-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-primary">R$ {Number(selectedComanda.total).toFixed(2)}</span>
                    </div>
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleAttemptFinishSale} // <-- BOTÃO AGORA CHAMA ESTA FUNÇÃO
                    >
                      Finalizar Venda
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione uma comanda</p>
                  <p className="text-sm">Ou crie uma nova para começar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* === NOVO MODAL DE PAGAMENTO === */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Venda</DialogTitle>
            <CardDescription>
              Total a Pagar: <span className="font-bold text-lg text-primary">R$ {Number(selectedComanda?.total).toFixed(2)}</span>
            </CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Forma de Pagamento</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value: any) => setPaymentMethod(value)}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dinheiro" id="dinheiro" />
                <Label htmlFor="dinheiro">Dinheiro</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pix" id="pix" />
                <Label htmlFor="pix">Pix</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cartao_debito" id="cartao_debito" />
                <Label htmlFor="cartao_debito">Débito</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cartao_credito" id="cartao_credito" />
                <Label htmlFor="cartao_credito">Crédito</Label>
              </div>
            </RadioGroup>

            {/* Lógica do Troco */}
            {paymentMethod === 'dinheiro' && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="amount-paid">Valor Pago</Label>
                  <Input
                    id="amount-paid"
                    type="number"
                    placeholder="R$ 0,00"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                  />
                </div>
                {troco > 0 && (
                  <div className="text-lg font-bold text-blue-600">
                    Troco: R$ {troco.toFixed(2)}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleConfirmPayment}
              disabled={paymentMethod === 'dinheiro' && troco < 0 && amountPaid !== ""} // Desabilita se for dinheiro e o valor pago for menor que o total
            >
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}