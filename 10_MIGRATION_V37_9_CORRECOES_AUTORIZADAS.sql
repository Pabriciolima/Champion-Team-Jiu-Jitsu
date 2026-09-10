-- CHAMPION TEAM V37.9
-- Escopo autorizado: RPCs administrativas e cron autenticado de fotos.

-- A rotina interna deixa de ser uma API direta e passa a aceitar apenas backend/cron.
alter function public.run_billing_crm_internal() rename to run_billing_crm_worker_v379;
revoke all on function public.run_billing_crm_worker_v379() from public,anon,authenticated;
grant execute on function public.run_billing_crm_worker_v379() to service_role;

-- Mantém o botão do administrador, validando a função do usuário dentro do banco.
create or replace function public.run_billing_crm_internal()
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if auth.uid() is not null and not exists (
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.active=true
      and p.role in ('master_admin','owner')
  ) then
    raise exception 'Acesso negado.';
  end if;
  return public.run_billing_crm_worker_v379();
end
$function$;
revoke all on function public.run_billing_crm_internal() from public,anon;
grant execute on function public.run_billing_crm_internal() to authenticated,service_role;

-- Esta função só é chamada internamente pelo worker acima.
revoke all on function public.ensure_open_membership_payments() from public,anon,authenticated;
grant execute on function public.ensure_open_membership_payments() to service_role;

-- O cron envia um token armazenado no Vault para a Edge Function de limpeza.
do $$
begin
  perform cron.unschedule('champion_checkin_photo_cleanup');
exception when others then null;
end
$$;

select cron.schedule(
  'champion_checkin_photo_cleanup',
  '15 3 * * *',
  $cron$
    select net.http_post(
      url := 'https://zahskmumgqbhkvcgtamk.supabase.co/functions/v1/cleanup-checkin-photos',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-token',(
          select decrypted_secret
          from vault.decrypted_secrets
          where name='champion_checkin_cleanup_token'
          limit 1
        )
      ),
      body := jsonb_build_object('source','cron')
    );
  $cron$
);
