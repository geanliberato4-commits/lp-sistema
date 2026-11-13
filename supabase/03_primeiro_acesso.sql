-- Primeiro acesso: enquanto não existe nenhum membro, o site mostra uma tela
-- para criar o login. Depois do primeiro login criado, isso fica bloqueado.

create or replace function public.sistema_configurado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.membros);
$$;

create or replace function public.primeiro_acesso(p_nome text, p_email text, p_senha text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nome text := trim(coalesce(p_nome, ''));
  v_id uuid := gen_random_uuid();
begin
  -- impede duas criações ao mesmo tempo
  lock table public.membros in share row exclusive mode;

  if exists (select 1 from public.membros) then
    raise exception 'O sistema já tem login criado. Use a tela de entrar.' using errcode = 'P0001';
  end if;
  if v_nome = '' then
    raise exception 'Informe um nome.' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.' using errcode = 'P0001';
  end if;
  if length(coalesce(p_senha, '')) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres.' using errcode = 'P0001';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Este e-mail já está cadastrado.' using errcode = 'P0001';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_senha, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', v_nome), now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());

  insert into public.membros (user_id, nome) values (v_id, v_nome);
end;
$$;

revoke execute on function public.sistema_configurado() from public;
revoke execute on function public.primeiro_acesso(text, text, text) from public;
grant execute on function public.sistema_configurado() to anon, authenticated;
grant execute on function public.primeiro_acesso(text, text, text) to anon, authenticated;
