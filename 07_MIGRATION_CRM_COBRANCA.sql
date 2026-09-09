-- CHAMPION TEAM SaaS — MIGRATION 07
create extension if not exists pg_cron;

alter table public.payments
  add column if not exists provider text,
  add column if not exists provider_customer_id text,
  add column if not exists invoice_url text,
  add column if not exists pix_qr_code_base64 text,
  add column if not exists reminder_stage text,
  add column if not exists last_reminder_at timestamptz;

create table if not exists public.billing_settings (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  enabled boolean not null default true,
  provider text not null default 'asaas',
  generate_charge_days_before integer not null default 10,
  use_provider_notifications boolean not null default true,
  enable_whatsapp boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.billing_settings(academy_id)
select id from public.academies
on conflict (academy_id) do nothing;

alter table public.billing_settings enable row level security;
drop policy if exists billing_settings_admin on public.billing_settings;
create policy billing_settings_admin on public.billing_settings
for all to authenticated
using (public.is_master() or (public.is_owner() and academy_id=public.current_academy_id()))
with check (public.is_master() or (public.is_owner() and academy_id=public.current_academy_id()));

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  event_key text not null unique,
  event_type text not null,
  title text not null,
  message text,
  channel text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists billing_events_academy_idx on public.billing_events(academy_id,created_at desc);
alter table public.billing_events enable row level security;
drop policy if exists billing_events_admin_read on public.billing_events;
create policy billing_events_admin_read on public.billing_events
for select to authenticated
using (public.is_master() or (public.is_owner() and academy_id=public.current_academy_id()));

create or replace function public.ensure_open_membership_payments()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare c integer:=0;
begin
  insert into public.payments(academy_id,membership_id,student_id,competence,amount,due_date,status,method,provider)
  select m.academy_id,m.id,m.student_id,date_trunc('month',m.next_due_date)::date,p.price,m.next_due_date,'pending','PIX','asaas'
  from public.memberships m
  join public.plans p on p.id=m.plan_id
  where m.status='active' and m.next_due_date is not null
  and not exists (
    select 1 from public.payments pay
    where pay.membership_id=m.id and pay.due_date=m.next_due_date and pay.status<>'cancelled'
  );
  get diagnostics c=row_count;
  return c;
end;
$$;

create or replace function public.run_billing_crm_internal()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare n integer:=0; total_reminders integer:=0; overdue_updated integer:=0;
begin
  perform public.ensure_open_membership_payments();

  update public.payments set status='overdue',updated_at=now()
  where status='pending' and due_date<current_date;
  get diagnostics overdue_updated=row_count;

  insert into public.billing_events(academy_id,payment_id,student_id,event_key,event_type,title,message,channel)
  select academy_id,id,student_id,id::text||':d-5','reminder','Mensalidade vence em 5 dias',
         'Sua mensalidade vence em 5 dias. O Pix já pode ser acessado no aplicativo.','system'
  from public.payments where status='pending' and due_date=current_date+5
  on conflict(event_key) do nothing;
  get diagnostics n=row_count; total_reminders:=total_reminders+n;

  insert into public.billing_events(academy_id,payment_id,student_id,event_key,event_type,title,message,channel)
  select academy_id,id,student_id,id::text||':d-1','reminder','Sua mensalidade vence amanhã',
         'Lembrete automático: sua mensalidade vence amanhã. Pague pelo Pix no aplicativo.','system'
  from public.payments where status='pending' and due_date=current_date+1
  on conflict(event_key) do nothing;
  get diagnostics n=row_count; total_reminders:=total_reminders+n;

  insert into public.billing_events(academy_id,payment_id,student_id,event_key,event_type,title,message,channel)
  select academy_id,id,student_id,id::text||':d0','due_today','Mensalidade vence hoje',
         'Sua mensalidade vence hoje. O Pix está disponível no aplicativo.','system'
  from public.payments where status='pending' and due_date=current_date
  on conflict(event_key) do nothing;
  get diagnostics n=row_count; total_reminders:=total_reminders+n;

  insert into public.billing_events(academy_id,payment_id,student_id,event_key,event_type,title,message,channel)
  select academy_id,id,student_id,id::text||':d+1','overdue','Mensalidade em atraso',
         'Identificamos uma mensalidade em atraso. Regularize pelo Pix disponível no aplicativo.','system'
  from public.payments where status='overdue' and due_date=current_date-1
  on conflict(event_key) do nothing;
  get diagnostics n=row_count; total_reminders:=total_reminders+n;

  insert into public.billing_events(academy_id,payment_id,student_id,event_key,event_type,title,message,channel)
  select academy_id,id,student_id,id::text||':d+7','overdue_followup','Mensalidade pendente há 7 dias',
         'Sua mensalidade continua pendente. O Pix permanece disponível para regularização.','system'
  from public.payments where status='overdue' and due_date=current_date-7
  on conflict(event_key) do nothing;
  get diagnostics n=row_count; total_reminders:=total_reminders+n;

  insert into public.notifications(academy_id,student_id,audience,title,message,type,created_at)
  select be.academy_id,be.student_id,'student',be.title,coalesce(be.message,''),
         case when be.event_type like 'overdue%' then 'warning' else 'billing' end,be.created_at
  from public.billing_events be
  where be.created_at>=now()-interval '5 minutes'
  and not exists (
    select 1 from public.notifications no
    where no.student_id=be.student_id and no.title=be.title
      and no.created_at>=be.created_at-interval '5 seconds'
  );

  update public.payments p
  set reminder_stage=case
    when p.status='overdue' and current_date-p.due_date>=7 then 'D+7'
    when p.status='overdue' then 'D+1'
    when p.due_date=current_date then 'D0'
    when p.due_date=current_date+1 then 'D-1'
    when p.due_date<=current_date+5 then 'D-5'
    else p.reminder_stage end,
    last_reminder_at=case when p.due_date between current_date-7 and current_date+5 then now() else p.last_reminder_at end
  where p.status in ('pending','overdue');

  return jsonb_build_object('ok',true,'overdue_updated',overdue_updated,'reminders_created',total_reminders,'ran_at',now());
end;
$$;

do $$ begin perform cron.unschedule('champion-billing-crm-daily'); exception when others then null; end $$;
select cron.schedule('champion-billing-crm-daily','0 8 * * *',$$select public.run_billing_crm_internal();$$);

do $$
begin
  begin alter publication supabase_realtime add table public.payments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.billing_events; exception when duplicate_object then null; end;
end $$;
