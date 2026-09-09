-- ============================================================
-- CHAMPION TEAM — SUPABASE V26
-- FASE 1: MIGRAÇÃO FUNCIONAL DO FIREBASE PARA SUPABASE
-- ============================================================

create extension if not exists pgcrypto;

do $$ begin
  create type public.champion_role as enum ('gestor','professor','aluno');
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- ACADEMIAS
-- Preparado desde já para o futuro modo SaaS multi-academia.
-- ------------------------------------------------------------
create table if not exists public.academies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PERFIS DE ACESSO
-- O ID é o mesmo UUID do Supabase Auth.
-- profile_id referencia o ID usado atualmente no seu JS.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  academy_id uuid references public.academies(id) on delete cascade,
  role public.champion_role not null,
  profile_id text,
  name text not null,
  email text not null,
  cpf text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_academy_email_unique
  on public.profiles(academy_id, lower(email));

create index if not exists profiles_academy_role_idx
  on public.profiles(academy_id, role);

create index if not exists profiles_profile_id_idx
  on public.profiles(profile_id);

-- ------------------------------------------------------------
-- DADOS ADMINISTRATIVOS
-- Compatibilidade com o app atual:
-- cada chave localStorage vira uma linha JSONB.
--
-- Isto permite migrar AGORA sem reescrever 5 mil linhas de interface.
-- Depois normalizamos alunos, matrículas, pagamentos etc. em tabelas.
-- ------------------------------------------------------------
create table if not exists public.academy_data (
  academy_id uuid not null references public.academies(id) on delete cascade,
  key text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (academy_id, key)
);

create index if not exists academy_data_key_idx
  on public.academy_data(key);

-- ------------------------------------------------------------
-- VISÃO PRIVADA DO ALUNO
-- O aluno nunca lê academy_data.
-- Ele lê somente sua linha individual.
-- ------------------------------------------------------------
create table if not exists public.student_views (
  user_id uuid primary key references auth.users(id) on delete cascade,
  academy_id uuid not null references public.academies(id) on delete cascade,
  profile_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- ------------------------------------------------------------
-- FUNÇÕES DE SEGURANÇA
-- ------------------------------------------------------------
create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true
  limit 1;
$$;

create or replace function public.current_role()
returns public.champion_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true
  limit 1;
$$;

create or replace function public.current_academy_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.academy_id
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true
  limit 1;
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'gestor', false);
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'professor', false);
$$;

create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'aluno', false);
$$;

-- ------------------------------------------------------------
-- TRIGGER: cria profile automaticamente no signUp de aluno/professor.
-- IMPORTANTE: nunca permite criar "gestor" por metadata pública.
-- ------------------------------------------------------------
create or replace function public.handle_champion_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_role text;
  safe_role public.champion_role;
  metadata_academy uuid;
begin
  metadata_role := coalesce(new.raw_user_meta_data->>'role','aluno');

  if metadata_role = 'professor' then
    safe_role := 'professor';
  else
    safe_role := 'aluno';
  end if;

  begin
    metadata_academy := nullif(new.raw_user_meta_data->>'academy_id','')::uuid;
  exception when others then
    metadata_academy := null;
  end;

  insert into public.profiles(
    id,
    academy_id,
    role,
    profile_id,
    name,
    email,
    cpf,
    active
  )
  values(
    new.id,
    metadata_academy,
    safe_role,
    new.raw_user_meta_data->>'profile_id',
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'cpf',
    true
  )
  on conflict (id) do update set
    academy_id = excluded.academy_id,
    role = excluded.role,
    profile_id = excluded.profile_id,
    name = excluded.name,
    email = excluded.email,
    cpf = excluded.cpf,
    active = true,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_champion_auth_user_created on auth.users;

create trigger on_champion_auth_user_created
after insert on auth.users
for each row execute function public.handle_champion_new_user();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.academies enable row level security;
alter table public.profiles enable row level security;
alter table public.academy_data enable row level security;
alter table public.student_views enable row level security;

drop policy if exists "academy visible to members" on public.academies;
create policy "academy visible to members"
on public.academies
for select
to authenticated
using (
  id = public.current_academy_id()
);

drop policy if exists "profile own or manager" on public.profiles;
create policy "profile own or manager"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or (
    public.is_manager()
    and academy_id = public.current_academy_id()
  )
);

drop policy if exists "manager updates profiles" on public.profiles;
create policy "manager updates profiles"
on public.profiles
for update
to authenticated
using (
  public.is_manager()
  and academy_id = public.current_academy_id()
)
with check (
  public.is_manager()
  and academy_id = public.current_academy_id()
);

drop policy if exists "manager academy data all" on public.academy_data;
create policy "manager academy data all"
on public.academy_data
for all
to authenticated
using (
  public.is_manager()
  and academy_id = public.current_academy_id()
)
with check (
  public.is_manager()
  and academy_id = public.current_academy_id()
);

drop policy if exists "teacher academy data read" on public.academy_data;
create policy "teacher academy data read"
on public.academy_data
for select
to authenticated
using (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and key in (
    'fitcontrol_alunos',
    'fitcontrol_professores',
    'fitcontrol_fichas_treino',
    'champion_team_graduacoes',
    'champion_team_regras_graduacao',
    'champion_team_indicacoes_faixa'
  )
);

drop policy if exists "teacher academy data insert" on public.academy_data;
create policy "teacher academy data insert"
on public.academy_data
for insert
to authenticated
with check (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and key in (
    'fitcontrol_fichas_treino',
    'champion_team_indicacoes_faixa'
  )
);

drop policy if exists "teacher academy data update" on public.academy_data;
create policy "teacher academy data update"
on public.academy_data
for update
to authenticated
using (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and key in (
    'fitcontrol_fichas_treino',
    'champion_team_indicacoes_faixa'
  )
)
with check (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and key in (
    'fitcontrol_fichas_treino',
    'champion_team_indicacoes_faixa'
  )
);

drop policy if exists "student own view" on public.student_views;
create policy "student own view"
on public.student_views
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_student()
);

drop policy if exists "manager student views all" on public.student_views;
create policy "manager student views all"
on public.student_views
for all
to authenticated
using (
  public.is_manager()
  and academy_id = public.current_academy_id()
)
with check (
  public.is_manager()
  and academy_id = public.current_academy_id()
);

-- ------------------------------------------------------------
-- REALTIME
-- ------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.academy_data;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.student_views;
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- ACADEMIA BASE
-- ------------------------------------------------------------
insert into public.academies(slug,name)
values('champion-team-jiu-jitsu','Champion Team Jiu-Jitsu')
on conflict(slug) do update set
  name = excluded.name,
  active = true,
  updated_at = now();

-- ============================================================
-- PASSO MANUAL DO PRIMEIRO GESTOR
-- ============================================================
-- 1) Supabase > Authentication > Users > Add user
--    crie o gestor com e-mail e senha.
--
-- 2) Copie o UUID do usuário.
--
-- 3) Execute abaixo substituindo SEU_UID_DO_GESTOR:
--
-- insert into public.profiles(
--   id, academy_id, role, name, email, active
-- )
-- select
--   'SEU_UID_DO_GESTOR'::uuid,
--   a.id,
--   'gestor',
--   'Administrador',
--   'SEU_EMAIL_DO_GESTOR',
--   true
-- from public.academies a
-- where a.slug='champion-team-jiu-jitsu'
-- on conflict(id) do update set
--   academy_id=excluded.academy_id,
--   role='gestor',
--   name=excluded.name,
--   email=excluded.email,
--   active=true,
--   updated_at=now();

-- ============================================================
-- FIM DA FASE 1
-- ============================================================
