-- Criar enum para tipos de usuário
CREATE TYPE public.user_type AS ENUM ('admin', 'colaborador');

-- Criar enum para tipos de movimento
CREATE TYPE public.movement_type AS ENUM ('entrada', 'saida');

-- Criar enum para status de venda
CREATE TYPE public.sale_status AS ENUM ('aberta', 'finalizada');

-- Tabela de perfis de usuários (estende auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo user_type NOT NULL DEFAULT 'colaborador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de categorias
CREATE TABLE public.categories (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de produtos
CREATE TABLE public.products (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  preco_venda DECIMAL(10,2) NOT NULL CHECK (preco_venda >= 0),
  custo DECIMAL(10,2) NOT NULL CHECK (custo >= 0),
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de vendas (comandas)
CREATE TABLE public.sales (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  status sale_status NOT NULL DEFAULT 'aberta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de itens da venda
CREATE TABLE public.sale_items (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario DECIMAL(10,2) NOT NULL CHECK (preco_unitario >= 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de movimentações financeiras
CREATE TABLE public.movements (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo movement_type NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL CHECK (valor >= 0),
  responsavel_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

-- Policies para profiles
CREATE POLICY "Usuários podem ver todos os perfis"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policies para categories (apenas admin pode modificar)
CREATE POLICY "Todos podem ver categorias"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem inserir categorias"
  ON public.categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
  );

CREATE POLICY "Apenas admins podem atualizar categorias"
  ON public.categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
  );

CREATE POLICY "Apenas admins podem deletar categorias"
  ON public.categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
  );

-- Policies para products (apenas admin pode modificar)
CREATE POLICY "Todos podem ver produtos"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem inserir produtos"
  ON public.products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
  );

CREATE POLICY "Apenas admins podem atualizar produtos"
  ON public.products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
  );

CREATE POLICY "Apenas admins podem deletar produtos"
  ON public.products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
  );

-- Policies para sales
CREATE POLICY "Colaboradores veem suas vendas, admins veem todas"
  ON public.sales FOR SELECT
  USING (
    colaborador_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
  );

CREATE POLICY "Colaboradores podem criar vendas"
  ON public.sales FOR INSERT
  WITH CHECK (colaborador_id = auth.uid());

CREATE POLICY "Colaboradores podem atualizar suas vendas"
  ON public.sales FOR UPDATE
  USING (colaborador_id = auth.uid());

-- Policies para sale_items
CREATE POLICY "Usuários veem itens de suas vendas"
  ON public.sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE id = venda_id AND (
        colaborador_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND tipo = 'admin'
        )
      )
    )
  );

CREATE POLICY "Colaboradores podem inserir itens em suas vendas"
  ON public.sale_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE id = venda_id AND colaborador_id = auth.uid()
    )
  );

CREATE POLICY "Colaboradores podem atualizar itens de suas vendas"
  ON public.sale_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE id = venda_id AND colaborador_id = auth.uid()
    )
  );

CREATE POLICY "Colaboradores podem deletar itens de suas vendas"
  ON public.sale_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE id = venda_id AND colaborador_id = auth.uid()
    )
  );

-- Policies para movements (apenas admin)
CREATE POLICY "Apenas admins podem ver movimentações"
  ON public.movements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
  );

CREATE POLICY "Apenas admins podem inserir movimentações"
  ON public.movements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
  );

-- Trigger para criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, tipo)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', new.email),
    COALESCE((new.raw_user_meta_data->>'tipo')::user_type, 'colaborador')
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_sales
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger para atualizar estoque automaticamente após venda
CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Atualizar estoque quando item é adicionado
  UPDATE public.products
  SET quantidade = quantidade - NEW.quantidade
  WHERE id = NEW.produto_id;
  
  -- Atualizar total da venda
  UPDATE public.sales
  SET total = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM public.sale_items
    WHERE venda_id = NEW.venda_id
  )
  WHERE id = NEW.venda_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_stock_after_sale_item
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_sale();

-- Trigger para restaurar estoque se item for deletado
CREATE OR REPLACE FUNCTION public.restore_stock_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Restaurar estoque
  UPDATE public.products
  SET quantidade = quantidade + OLD.quantidade
  WHERE id = OLD.produto_id;
  
  -- Atualizar total da venda
  UPDATE public.sales
  SET total = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM public.sale_items
    WHERE venda_id = OLD.venda_id
  )
  WHERE id = OLD.venda_id;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER restore_stock_on_item_delete
  AFTER DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_delete();

-- Inserir categorias iniciais
INSERT INTO public.categories (nome) VALUES
  ('Vinhos'),
  ('Cervejas'),
  ('Destilados'),
  ('Refrigerantes'),
  ('Snacks');

-- Criar índices para performance
CREATE INDEX idx_products_categoria ON public.products(categoria_id);
CREATE INDEX idx_sales_colaborador ON public.sales(colaborador_id);
CREATE INDEX idx_sales_status ON public.sales(status);
CREATE INDEX idx_sale_items_venda ON public.sale_items(venda_id);
CREATE INDEX idx_sale_items_produto ON public.sale_items(produto_id);
CREATE INDEX idx_movements_responsavel ON public.movements(responsavel_id);
CREATE INDEX idx_movements_tipo ON public.movements(tipo);