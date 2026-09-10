-- V37.11 - Central de notificacoes com entrega e leitura individuais

alter table public.notifications
  add column if not exists recipient_profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists sender_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists recipient_kind text,
  add column if not exists priority text not null default 'normal',
  add column if not exists batch_id uuid not null default gen_random_uuid();

alter table public.notifications drop constraint if exists notifications_recipient_kind_check;
alter table public.notifications add constraint notifications_recipient_kind_check
  check (recipient_kind is null or recipient_kind in ('student','teacher'));
alter table public.notifications drop constraint if exists notifications_priority_check;
alter table public.notifications add constraint notifications_priority_check
  check (priority in ('normal','high'));

update public.notifications n
set recipient_profile_id = s.profile_id,
    recipient_kind = 'student',
    audience = 'individual'
from public.students s
where n.student_id = s.id
  and n.recipient_profile_id is null
  and s.profile_id is not null;

create index if not exists notifications_recipient_unread_idx
  on public.notifications(recipient_profile_id, created_at desc)
  where read_at is null;
create index if not exists notifications_academy_batch_idx
  on public.notifications(academy_id, batch_id, created_at desc);

drop policy if exists notifications_student_read on public.notifications;
drop policy if exists notifications_recipient_read on public.notifications;
create policy notifications_recipient_read on public.notifications
  for select to authenticated
  using (recipient_profile_id = auth.uid());

create or replace function public.send_champion_notification(
  p_academy_id uuid,
  p_audience text,
  p_recipient_profile_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_priority text default 'normal'
)
returns table(batch_id uuid, delivered_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender public.profiles%rowtype;
  v_batch uuid := gen_random_uuid();
  v_count integer := 0;
  v_audience text := lower(trim(coalesce(p_audience,'')));
  v_type text := lower(trim(coalesce(p_type,'geral')));
  v_priority text := lower(trim(coalesce(p_priority,'normal')));
  v_target_role public.user_role;
begin
  select * into v_sender from public.profiles where id = auth.uid() and active is true;
  if not found or v_sender.role not in ('master_admin','owner') then
    raise exception 'Somente a administracao pode enviar notificacoes.';
  end if;
  if v_sender.role = 'owner' and v_sender.academy_id is distinct from p_academy_id then
    raise exception 'Academia nao autorizada.';
  end if;
  if v_audience not in ('students','teachers','individual') then
    raise exception 'Destinatario invalido.';
  end if;
  if v_priority not in ('normal','high') then raise exception 'Prioridade invalida.'; end if;
  if length(trim(coalesce(p_title,''))) not between 2 and 100 then raise exception 'Titulo invalido.'; end if;
  if length(trim(coalesce(p_message,''))) not between 2 and 1000 then raise exception 'Mensagem invalida.'; end if;

  if v_audience = 'students' then
    if v_type not in ('mensalidade','promocao','geral') then
      raise exception 'Alunos recebem somente mensalidade, promocao ou mensagem geral.';
    end if;
    insert into public.notifications
      (academy_id,student_id,audience,title,message,type,recipient_profile_id,sender_profile_id,recipient_kind,priority,batch_id)
    select p_academy_id,s.id,'students',trim(p_title),trim(p_message),v_type,s.profile_id,auth.uid(),'student',v_priority,v_batch
    from public.students s
    join public.profiles p on p.id=s.profile_id and p.active is true
    where s.academy_id=p_academy_id and s.status='active' and s.profile_id is not null;
  elsif v_audience = 'teachers' then
    insert into public.notifications
      (academy_id,audience,title,message,type,recipient_profile_id,sender_profile_id,recipient_kind,priority,batch_id)
    select p_academy_id,'teachers',trim(p_title),trim(p_message),v_type,t.profile_id,auth.uid(),'teacher',v_priority,v_batch
    from public.teachers t
    join public.profiles p on p.id=t.profile_id and p.active is true
    where t.academy_id=p_academy_id and t.active is true and t.profile_id is not null;
  else
    select p.role into v_target_role
    from public.profiles p
    where p.id=p_recipient_profile_id and p.academy_id=p_academy_id and p.active is true
      and p.role in ('student','teacher');
    if not found then raise exception 'Destinatario individual nao encontrado.'; end if;
    if v_target_role='student' and v_type not in ('mensalidade','promocao','geral') then
      raise exception 'Alunos recebem somente mensalidade, promocao ou mensagem geral.';
    end if;
    insert into public.notifications
      (academy_id,student_id,audience,title,message,type,recipient_profile_id,sender_profile_id,recipient_kind,priority,batch_id)
    values (
      p_academy_id,
      (select s.id from public.students s where s.profile_id=p_recipient_profile_id limit 1),
      'individual',trim(p_title),trim(p_message),v_type,p_recipient_profile_id,auth.uid(),
      case when v_target_role='student' then 'student' else 'teacher' end,v_priority,v_batch
    );
  end if;

  get diagnostics v_count = row_count;
  if v_count=0 then raise exception 'Nenhum destinatario ativo foi encontrado.'; end if;
  return query select v_batch,v_count;
end;
$$;

create or replace function public.mark_champion_notification_read(p_notification_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare v_read_at timestamptz;
begin
  update public.notifications
  set read_at=coalesce(read_at,now())
  where id=p_notification_id and recipient_profile_id=auth.uid()
  returning read_at into v_read_at;
  if v_read_at is null then raise exception 'Notificacao nao encontrada.'; end if;
  return v_read_at;
end;
$$;

revoke all on function public.send_champion_notification(uuid,text,uuid,text,text,text,text) from public, anon;
grant execute on function public.send_champion_notification(uuid,text,uuid,text,text,text,text) to authenticated;
revoke all on function public.mark_champion_notification_read(uuid) from public, anon;
grant execute on function public.mark_champion_notification_read(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
