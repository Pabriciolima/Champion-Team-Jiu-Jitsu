-- Champion Team V38.5
-- Notificacoes expiram em 24 horas e podem ser excluidas pelo destinatario
-- ou pelo administrador responsavel pela academia.

alter table public.notifications
  add column if not exists expires_at timestamptz;

update public.notifications
set expires_at = least(created_at + interval '24 hours', now() + interval '24 hours')
where expires_at is null;

alter table public.notifications
  alter column expires_at set default (now() + interval '24 hours'),
  alter column expires_at set not null;

create index if not exists notifications_expires_at_idx
  on public.notifications (expires_at);

create or replace function public.delete_champion_notification(
  p_notification_id uuid default null,
  p_batch_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_deleted integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sessao invalida';
  end if;

  if p_notification_id is null and p_batch_id is null then
    raise exception 'Informe a notificacao ou o lote';
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid() and active = true;

  if not found then
    raise exception 'Perfil inativo ou nao encontrado';
  end if;

  if v_profile.role::text in ('owner', 'master_admin') then
    delete from public.notifications n
    where (p_notification_id is null or n.id = p_notification_id)
      and (p_batch_id is null or n.batch_id = p_batch_id)
      and (v_profile.role::text = 'master_admin' or n.academy_id = v_profile.academy_id);
  else
    if p_batch_id is not null then
      raise exception 'Operacao nao permitida';
    end if;

    delete from public.notifications n
    where n.id = p_notification_id
      and n.recipient_profile_id = auth.uid();
  end if;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.delete_champion_notification(uuid, uuid) from public, anon;
grant execute on function public.delete_champion_notification(uuid, uuid) to authenticated;

select cron.schedule(
  'champion-notifications-expiry',
  '*/15 * * * *',
  $$delete from public.notifications where expires_at <= now()$$
);
