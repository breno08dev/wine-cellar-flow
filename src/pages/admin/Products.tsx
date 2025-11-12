// src/pages/admin/Products.tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Database } from "@/integrations/supabase/types"; // <-- 1. IMPORTA O TIPO DO BANCO

// --- 2. DEFINIÇÃO CORRETA DOS TIPOS ---
// Pega o tipo 'Row' da tabela 'products'
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
// Pega o tipo 'Row' da tabela 'categories'
type Category = Database["public"]["Tables"]["categories"]["Row"];

// Cria nosso tipo customizado para 'Product' que inclui a Categoria aninhada
type Product = ProductRow & {
  categories: { nome: string } | null;
};
// --- FIM DA DEFINIÇÃO DE TIPOS ---

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [custo, setCusto] = useState("");
  const [quantidade, setQuantidade] = useState("");

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    // Diz ao Supabase qual o formato exato que queremos
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(nome)')
      .order('nome');
    
    if (error) {
      toast.error("Erro ao carregar produtos", { description: error.message });
    } else if (data) {
      // 3. O 'data' agora bate com o tipo 'Product[]'
      setProducts(data as Product[]); 
    }
    setLoading(false);
  };

  const loadCategories = async () => {
    // 3. O 'from' agora é reconhecido e o 'data' bate com 'Category[]'
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('nome');
    
    if (error) {
       toast.error("Erro ao carregar categorias", { description: error.message });
    } else if (data) {
       setCategories(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const productData = {
      nome,
      categoria_id: categoriaId || null,
      preco_venda: parseFloat(precoVenda),
      custo: parseFloat(custo),
      quantidade: parseInt(quantidade),
    };

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id);
      
      if (error) {
        toast.error("Erro ao atualizar produto");
      } else {
        toast.success("Produto atualizado com sucesso!");
        resetForm();
        loadProducts();
      }
    } else {
      const { error } = await supabase
        .from('products')
        .insert([productData]);
      
      if (error) {
        toast.error("Erro ao adicionar produto");
      } else {
        toast.success("Produto adicionado com sucesso!");
        resetForm();
        loadProducts();
      }
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setNome(product.nome);
    setCategoriaId(product.categoria_id || "");
    setPrecoVenda(product.preco_venda.toString());
    setCusto(product.custo.toString());
    setQuantidade(product.quantidade.toString());
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) {
        toast.error("Erro ao excluir produto");
      } else {
        toast.success("Produto excluído com sucesso!");
        loadProducts();
      }
    }
  };

  const resetForm = () => {
    setNome("");
    setCategoriaId("");
    setPrecoVenda("");
    setCusto("");
    setQuantidade("");
    setEditingProduct(null);
    setIsOpen(false);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center text-muted-foreground p-8">
          Carregando produtos...
        </div>
      );
    }

    if (products.length === 0) {
      return (
        <div className="text-center text-muted-foreground p-8">
          Nenhum produto cadastrado.
        </div>
      );
    }

    return (
      <>
        {/* VISÃO MOBILE (LISTA DE CARDS) */}
        <div className="md:hidden space-y-4">
          {products.map((product) => (
            <Card key={product.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1 pr-2">
                  <p className="font-medium">{product.nome}</p>
                  <p className="text-sm text-muted-foreground">{product.categories?.nome || "--"}</p>
                </div>
                <div className="flex flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(product.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center border-t pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Custo</p>
                  <p className="text-sm font-medium">R$ {Number(product.custo).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Preço</p>
                  <p className="text-sm font-medium">R$ {Number(product.preco_venda).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estoque</p>
                  <p className="text-sm font-medium">{product.quantidade}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* VISÃO DESKTOP (TABELA) */}
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.nome}</TableCell>
                <TableCell>{product.categories?.nome || "-"}</TableCell>
                <TableCell className="text-right">
                  R$ {Number(product.custo).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  R$ {Number(product.preco_venda).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">{product.quantidade}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(product)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seu estoque</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Editar" : "Novo"} Produto</DialogTitle>
                <DialogDescription>
                  Preencha os dados do produto
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select value={categoriaId} onValueChange={setCategoriaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="custo">Custo (R$)</Label>
                    <Input
                      id="custo"
                      type="number"
                      step="0.01"
                      value={custo}
                      onChange={(e) => setCusto(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preco">Preço (R$)</Label>
                    <Input
                      id="preco"
                      type="number"
                      step="0.01"
                      value={precoVenda}
                      onChange={(e) => setPrecoVenda(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingProduct ? "Atualizar" : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Produtos</CardTitle>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}