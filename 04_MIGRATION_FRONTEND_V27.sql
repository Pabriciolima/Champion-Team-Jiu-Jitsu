-- ============================================================
-- CHAMPION TEAM SaaS — MIGRATION 04
-- Bridge do frontend V27 + convites seguros para novos acessos
-- ============================================================

alter table public.training_plans
  add column if not exists level text,
  add column if not exists days_per_week integer default 3;

alter table public.training_items
  add column if not exists muscle_group text,
  add column if not exists sets integer default 1,
  add column if not exists load text,
  add column if not exists rest text;

alter table public.teachers
  add column if not exists shift text,
  add column if not exists admission_date date;

create table if not exists public.app_data (
  academy_id uuid not null references public.academies(id) on delete cascade,
  key text not null,
  items jsonb not null default '[]'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (academy_id,key)
);

alter table public.app_data enable row level security;

drop policy if exists app_data_admin_manage on public.app_data;
create policy app_data_admin_manage
on public.app_data
for all
to authenticated
using (
  public.is_master()
  or (public.is_owner() and academy_id = public.current_academy_id())
)
with check (
  public.is_master()
  or (public.is_owner() and academy_id = public.current_academy_id())
);

drop policy if exists app_data_teacher_read on public.app_data;
create policy app_data_teacher_read
on public.app_data
for select
to authenticated
using (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and key in ('fitcontrol_videos_jiujitsu','champion_team_regras_graduacao')
);

create table if not exists public.access_invites (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  email text not null,
  role public.user_role not null check (role in ('teacher','student')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete cascade,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists access_invites_open_email_uq
on public.access_invites(academy_id,lower(email))
where used_at is null;

alter table public.access_invites enable row level security;

drop policy if exists access_invites_admin_manage on public.access_invites;
create policy access_invites_admin_manage
on public.access_invites
for all
to authenticated
using (
  public.is_master()
  or (public.is_owner() and academy_id = public.current_academy_id())
)
with check (
  public.is_master()
  or (public.is_owner() and academy_id = public.current_academy_id())
);

create or replace function public.consume_access_invite()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  inv public.access_invites;
  p jsonb;
begin
  select *
    into inv
  from public.access_invites
  where lower(email)=lower(new.email)
    and used_at is null
  order by created_at desc
  limit 1;

  if inv.id is null then
    return new;
  end if;

  p := inv.payload;

  insert into public.profiles(
    id,academy_id,role,full_name,email,cpf,phone,active
  )
  values(
    new.id,
    inv.academy_id,
    inv.role,
    coalesce(p->>'full_name',new.email),
    lower(new.email),
    nullif(p->>'cpf',''),
    nullif(p->>'phone',''),
    true
  )
  on conflict(id) do update set
    academy_id=excluded.academy_id,
    role=excluded.role,
    full_name=excluded.full_name,
    email=excluded.email,
    cpf=excluded.cpf,
    phone=excluded.phone,
    active=true,
    updated_at=now();

  if inv.role='student' then
    insert into public.students(
      id,academy_id,profile_id,full_name,cpf,email,phone,birth_date,belt,degree,status
    )
    values(
      coalesce(nullif(p->>'profile_id','')::uuid,gen_random_uuid()),
      inv.academy_id,
      new.id,
      coalesce(p->>'full_name',new.email),
      nullif(p->>'cpf',''),
      lower(new.email),
      nullif(p->>'phone',''),
      nullif(p->>'birth_date','')::date,
      coalesce(nullif(p->>'belt',''),'Branca'),
      coalesce(nullif(p->>'degree','')::int,0),
      'active'
    )
    on conflict(profile_id) do update set
      full_name=excluded.full_name,
      cpf=excluded.cpf,
      email=excluded.email,
      phone=excluded.phone,
      birth_date=excluded.birth_date,
      belt=excluded.belt,
      degree=excluded.degree,
      status='active',
      updated_at=now();
  end if;

  if inv.role='teacher' then
    insert into public.teachers(
      id,academy_id,profile_id,full_name,cpf,email,phone,specialty,cref,active
    )
    values(
      coalesce(nullif(p->>'profile_id','')::uuid,gen_random_uuid()),
      inv.academy_id,
      new.id,
      coalesce(p->>'full_name',new.email),
      nullif(p->>'cpf',''),
      lower(new.email),
      nullif(p->>'phone',''),
      coalesce(nullif(p->>'specialty',''),'Jiu-Jitsu'),
      nullif(p->>'cref',''),
      true
    )
    on conflict(profile_id) do update set
      full_name=excluded.full_name,
      cpf=excluded.cpf,
      email=excluded.email,
      phone=excluded.phone,
      specialty=excluded.specialty,
      cref=excluded.cref,
      active=true,
      updated_at=now();
  end if;

  update public.access_invites
  set used_at=now()
  where id=inv.id;

  return new;
end;
$$;

drop trigger if exists champion_invited_user_created on auth.users;

create trigger champion_invited_user_created
after insert on auth.users
for each row
execute function public.consume_access_invite();

-- Realtime para módulos principais
do $$
declare
  t text;
begin
  foreach t in array array[
    'students','teachers','plans','memberships','checkins',
    'training_plans','training_items','products','orders',
    'order_items','notifications','graduation_history',
    'belt_recommendations','app_data'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I',t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;
