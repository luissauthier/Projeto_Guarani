import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Preflight CORS (Resolve o erro de acesso bloqueado)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Cria cliente Supabase (Admin)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // 3. Pega dados do App
    const { email, password, full_name, telefone } = await req.json()

    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios')
    }

    // 4. Cria usuário no Auth
    const { data: userData, error: userError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (userError) throw userError

    // 5. Atualiza tabela users com tipo COLABORADOR
    if (userData.user) {
      const { error: profileError } = await supabaseClient
        .from('users')
        .update({
          full_name: full_name,
          telefone: telefone,
          type_user: 'colaborador', // <--- GARANTINDO QUE É COLABORADOR
          ativo: true
        })
        .eq('id', userData.user.id)

      if (profileError) console.error('Erro update profile:', profileError)
    }

    return new Response(
      JSON.stringify(userData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})