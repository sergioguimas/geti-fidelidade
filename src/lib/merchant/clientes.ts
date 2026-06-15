import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ClienteCreateInput,
  ClienteListItem,
  ClienteUpdateInput,
} from "@/lib/types";

function normalizeNullableString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeCnpj(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

async function findGlobalClienteByCnpj(cnpj: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("clientes")
    .select(`
      id,
      nome,
      telefone,
      email,
      cnpj,
      auth_user_id,
      pode_fazer_login,
      acesso_ativado_em,
      ultimo_login_em,
      created_at,
      updated_at
    `)
    .eq("cnpj", cnpj)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function ensureClienteFidelidade(
  supabase: SupabaseClient,
  input: {
    clienteId: string;
    lojistaId: string;
    programaId?: string | null;
    ativo?: boolean;
  }
) {
  const { data: existing, error: existingError } = await supabase
    .from("clientes_fidelidade")
    .select("id, ativo")
    .eq("cliente_id", input.clienteId)
    .eq("lojista_id", input.lojistaId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("clientes_fidelidade")
      .update({
        ativo: input.ativo ?? true,
        programa_id: input.programaId ?? null,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return existing.id;
  }
  console.log("garantindo vínculo clientes_fidelidade");
  const { data, error } = await supabase
    .from("clientes_fidelidade")
    .insert({
      cliente_id: input.clienteId,
      lojista_id: input.lojistaId,
      programa_id: input.programaId ?? null,
      ativo: input.ativo ?? true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id;
}

async function ensureClienteAuthAccess(
  supabase: SupabaseClient,
  cliente: {
    id: string;
    email: string | null;
    auth_user_id?: string | null;
    pode_fazer_login?: boolean | null;
  }
) {
  if (!cliente.email) {
    throw new Error("Para liberar login, o cliente precisa ter e-mail.");
  }

  if (cliente.auth_user_id) {
    const { error: updateClienteError } = await supabase
      .from("clientes")
      .update({
        pode_fazer_login: true,
        acesso_ativado_em: new Date().toISOString(),
      })
      .eq("id", cliente.id);

    if (updateClienteError) {
      throw new Error(updateClienteError.message);
    }

    return { authUserId: cliente.auth_user_id, createdNow: false };
  }

  const admin = createAdminClient();

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email: cliente.email,
      email_confirm: true,
    });

  if (createUserError || !createdUser.user) {
    throw new Error(
      createUserError?.message ?? "Erro ao criar acesso do cliente."
    );
  }

  const authUserId = createdUser.user.id;

  const { error: updateClienteError } = await supabase
    .from("clientes")
    .update({
      auth_user_id: authUserId,
      pode_fazer_login: true,
      acesso_ativado_em: new Date().toISOString(),
    })
    .eq("id", cliente.id);

  if (updateClienteError) {
    throw new Error(updateClienteError.message);
  }

  const { error: clienteUsuarioError } = await supabase
    .from("clientes_usuarios")
    .insert({
      cliente_id: cliente.id,
      auth_user_id: authUserId,
    });

  if (clienteUsuarioError && !isUniqueViolation(clienteUsuarioError)) {
    throw new Error(clienteUsuarioError.message);
  }

  return { authUserId, createdNow: true };
}

export async function listClientes(
  supabase: SupabaseClient,
  lojistaId: string,
  busca?: string
) {
  let query = supabase
    .from("clientes_fidelidade")
    .select(`
      id,
      ativo,
      streak_atual,
      saldo_disponivel,
      saldo_pendente,
      saldo_negativo,
      ultima_compra_valida_em,
      cliente:clientes (
        id,
        nome,
        telefone,
        email,
        cnpj,
        auth_user_id,
        pode_fazer_login,
        acesso_ativado_em,
        ultimo_login_em,
        created_at,
        updated_at
      )
    `)
    .eq("lojista_id", lojistaId)
    .order("updated_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  let rows = (data ?? [])
    .map((item: any) => {
      const cliente = Array.isArray(item.cliente) ? item.cliente[0] : item.cliente;

      if (!cliente) return null;

      return {
        id: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        cnpj: cliente.cnpj,
        auth_user_id: cliente.auth_user_id,
        pode_fazer_login: cliente.pode_fazer_login,
        acesso_ativado_em: cliente.acesso_ativado_em,
        ultimo_login_em: cliente.ultimo_login_em,
        created_at: cliente.created_at,
        updated_at: cliente.updated_at,
        fidelidade: {
          id: item.id,
          ativo: item.ativo,
          streak_atual: item.streak_atual,
          saldo_disponivel: item.saldo_disponivel,
          saldo_pendente: item.saldo_pendente,
          saldo_negativo: item.saldo_negativo,
          ultima_compra_valida_em: item.ultima_compra_valida_em,
        },
      };
    })
    .filter(Boolean) as ClienteListItem[];

  if (busca?.trim()) {
    const term = busca.trim().toLowerCase();
    rows = rows.filter(
      (item) =>
        item.nome?.toLowerCase().includes(term) ||
        item.email?.toLowerCase().includes(term) ||
        item.cnpj?.toLowerCase().includes(term)
    );
  }

  return rows;
}

export async function createCliente(
  supabase: SupabaseClient,
  lojistaId: string,
  input: ClienteCreateInput
) {
  const nome = input.nome.trim();
  const telefone = normalizeNullableString(input.telefone);
  const email = normalizeNullableString(input.email)?.toLowerCase() ?? null;
  const cnpj = normalizeCnpj(input.cnpj);

  let cliente: any = null;
  let clienteJaExistia = false;

  if (cnpj) {
    cliente = await findGlobalClienteByCnpj(cnpj);
    clienteJaExistia = !!cliente;
  }

  if (!cliente) {
    const { data: insertedCliente, error: insertError } = await supabase
      .from("clientes")
      .insert({
        nome,
        telefone,
        email,
        cnpj,
        pode_fazer_login: false,
      })
      .select(`
        id,
        nome,
        telefone,
        email,
        cnpj,
        auth_user_id,
        pode_fazer_login,
        acesso_ativado_em,
        ultimo_login_em,
        created_at,
        updated_at
      `)
      .single();

    if (insertError || !insertedCliente) {
      throw new Error(insertError?.message ?? "Erro ao cadastrar cliente.");
    }

    cliente = insertedCliente;
  }

  await ensureClienteFidelidade(supabase, {
    clienteId: cliente.id,
    lojistaId,
    ativo: input.ativo ?? true,
  });

  if (clienteJaExistia) {
    const patch: Record<string, string> = {};

    if (!cliente.nome && nome) patch.nome = nome;
    if (!cliente.telefone && telefone) patch.telefone = telefone;
    if (!cliente.email && email) patch.email = email;

    if (Object.keys(patch).length > 0) {
      const { data, error } = await supabase
        .from("clientes")
        .update(patch)
        .eq("id", cliente.id)
        .select(`
          id,
          nome,
          telefone,
          email,
          cnpj,
          auth_user_id,
          pode_fazer_login,
          acesso_ativado_em,
          ultimo_login_em,
          created_at,
          updated_at
        `)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Erro ao atualizar cliente existente.");
      }

      cliente = data;
    }
  }

  if (input.podeFazerLogin) {
    await ensureClienteAuthAccess(supabase, cliente);

    const { data: refreshedCliente, error: refreshedError } = await supabase
      .from("clientes")
      .select(`
        id,
        nome,
        telefone,
        email,
        cnpj,
        auth_user_id,
        pode_fazer_login,
        acesso_ativado_em,
        ultimo_login_em,
        created_at,
        updated_at
      `)
      .eq("id", cliente.id)
      .single();

    if (refreshedError || !refreshedCliente) {
      throw new Error(
        refreshedError?.message ?? "Erro ao recarregar cliente após ativar login."
      );
    }

    cliente = refreshedCliente;
  }

  return cliente;
}

export async function updateCliente(
  supabase: SupabaseClient,
  lojistaId: string,
  input: ClienteUpdateInput
) {
  const nome = input.nome.trim();
  const telefone = normalizeNullableString(input.telefone);
  const email = normalizeNullableString(input.email)?.toLowerCase() ?? null;
  const cnpj = normalizeCnpj(input.cnpj);

  const { data: currentCliente, error: currentClienteError } = await supabase
    .from("clientes")
    .select(`
      id,
      nome,
      telefone,
      email,
      cnpj,
      auth_user_id,
      pode_fazer_login,
      acesso_ativado_em,
      ultimo_login_em,
      created_at,
      updated_at
    `)
    .eq("id", input.id)
    .single();

  if (currentClienteError || !currentCliente) {
    throw new Error(currentClienteError?.message ?? "Cliente não encontrado.");
  }

  if (cnpj && cnpj !== currentCliente.cnpj) {
    const existingByCnpj = await findGlobalClienteByCnpj(cnpj);

    if (existingByCnpj && existingByCnpj.id !== input.id) {
      throw new Error(
        "Já existe um cliente global com este CNPJ. Edite o vínculo da loja em vez de duplicar o cadastro."
      );
    }
  }

  const { data, error } = await supabase
    .from("clientes")
    .update({
      nome,
      telefone,
      email,
      cnpj,
    })
    .eq("id", input.id)
    .select(`
      id,
      nome,
      telefone,
      email,
      cnpj,
      auth_user_id,
      pode_fazer_login,
      acesso_ativado_em,
      ultimo_login_em,
      created_at,
      updated_at
    `)
    .single();

  if (error || !data) { 
    throw new Error(error?.message ?? "Erro ao atualizar cliente.");
  }

  if (typeof input.ativo === "boolean") {
    const { error: fidelidadeError } = await supabase
      .from("clientes_fidelidade")
      .update({ ativo: input.ativo })
      .eq("cliente_id", input.id)
      .eq("lojista_id", lojistaId);

    if (fidelidadeError) {
      throw new Error(fidelidadeError.message);
    }
  }

  if (input.podeFazerLogin) {
    await ensureClienteAuthAccess(supabase, {
      ...data,
      email: data.email,
    });
  }

  return data;
}

export async function deactivateCliente(
  supabase: SupabaseClient,
  lojistaId: string,
  id: string
) {
  const { data, error } = await supabase
    .from("clientes_fidelidade")
    .update({ ativo: false })
    .eq("cliente_id", id)
    .eq("lojista_id", lojistaId)
    .select(`
      id,
      cliente_id,
      lojista_id,
      ativo
    `)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}