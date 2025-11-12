import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// --- VALIDAÇÃO ADICIONADA ---
// Isso garante que o app "quebre" imediatamente se as variáveis 
// não estiverem definidas, facilitando o debug.
if (!SUPABASE_URL) {
  throw new Error("Variável de ambiente VITE_SUPABASE_URL não está definida.");
}
if (!SUPABASE_ANON_KEY) {
  throw new Error("Variável de ambiente VITE_SUPABASE_ANON_KEY não está definida.");
}
// --- FIM DA VALIDAÇÃO ---

// Os console.log de debug foram removidos para um console de produção mais limpo.

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});