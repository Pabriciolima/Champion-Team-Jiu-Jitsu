-- CHAMPION TEAM V37.6
-- Cancelamento auditável, recuperação segura do estoque legado e proteção das RPCs.

alter table public.orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id),
  add column if not exists cancellation_reason text,
  add column if not exists legacy_stock_restored boolean not null default false;

alter table public.stock_reservations enable row level security;
alter table public.asaas_webhook_events enable row level security;

drop policy if exists asaas_webhook_events_backend_only on public.asaas_webhook_events;
create policy asaas_webhook_events_backend_only
on public.asaas_webhook_events as restrictive for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists stock_reservations_student_read on public.stock_reservations;
create policy stock_reservations_student_read
on public.stock_reservations for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = stock_reservations.student_id
      and s.profile_id = (select auth.uid())
  )
);

revoke all on public.stock_reservations from anon;
revoke all on public.asaas_webhook_events from anon, authenticated;
grant select on public.stock_reservations to authenticated;
grant all on public.stock_reservations, public.asaas_webhook_events to service_role;

create index if not exists orders_cancelled_by_idx on public.orders(cancelled_by);

create or replace function public.cancel_store_order(
  p_order_id uuid,
  p_actor_profile_id uuid default null,
  p_reason text default 'cancelled'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_has_reservation boolean := false;
  v_restored integer := 0;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'not_found', 'restored_quantity', 0);
  end if;

  if v_order.status::text <> 'pending' then
    return jsonb_build_object('ok', false, 'status', v_order.status::text, 'restored_quantity', 0);
  end if;

  select exists(
    select 1 from public.stock_reservations r where r.order_id = p_order_id
  ) into v_has_reservation;

  -- V37.5+ apenas reserva: cancelar nunca soma estoque.
  update public.stock_reservations
     set status = case when p_reason = 'expired' then 'expired' else 'cancelled' end,
         updated_at = now()
   where order_id = p_order_id and status = 'active';

  -- Fluxo legado baixava o estoque ao criar o pedido. Restaura uma única vez.
  if not v_has_reservation
     and v_order.reservation_expires_at is null
     and v_order.amount_due_now is null
     and not coalesce(v_order.legacy_stock_restored, false) then
    for v_item in
      select product_id, quantity
      from public.order_items
      where order_id = p_order_id and product_id is not null
      for update
    loop
      update public.products
         set stock = stock + v_item.quantity,
             updated_at = now()
       where id = v_item.product_id;
      v_restored := v_restored + v_item.quantity;
    end loop;
  end if;

  update public.orders
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = p_actor_profile_id,
         cancellation_reason = left(coalesce(nullif(trim(p_reason), ''), 'cancelled'), 250),
         legacy_stock_restored = legacy_stock_restored or (v_restored > 0),
         updated_at = now()
   where id = p_order_id;

  insert into public.audit_logs(academy_id, actor_profile_id, action, entity, entity_id, payload)
  values (
    v_order.academy_id,
    p_actor_profile_id,
    'store_order_cancelled',
    'orders',
    p_order_id::text,
    jsonb_build_object(
      'code', v_order.code,
      'reason', p_reason,
      'legacy_stock_restored', v_restored > 0,
      'restored_quantity', v_restored
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'cancelled',
    'legacy_stock_restored', v_restored > 0,
    'restored_quantity', v_restored
  );
end
$function$;

-- As RPCs abaixo são APIs internas. Somente Edge Functions/service_role podem executá-las.
revoke all on function public.reserve_store_order(uuid, uuid, jsonb, text, numeric) from public, anon, authenticated;
revoke all on function public.confirm_store_order(uuid) from public, anon, authenticated;
revoke all on function public.expire_store_order(uuid) from public, anon, authenticated;
revoke all on function public.cleanup_stale_store_reservations() from public, anon, authenticated;
revoke all on function public.cancel_store_order(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_cancel_store_order(uuid) from public, anon, authenticated;

grant execute on function public.reserve_store_order(uuid, uuid, jsonb, text, numeric) to service_role;
grant execute on function public.confirm_store_order(uuid) to service_role;
grant execute on function public.expire_store_order(uuid) to service_role;
grant execute on function public.cleanup_stale_store_reservations() to service_role;
grant execute on function public.cancel_store_order(uuid, uuid, text) to service_role;

-- Recuperação idempotente dos dois pedidos que a V37 antiga baixou prematuramente.
select public.cancel_store_order(id, null, 'v37_legacy_stock_recovery')
from public.orders
where code in ('PED-19570714', 'PED-19652108')
  and status = 'pending';
