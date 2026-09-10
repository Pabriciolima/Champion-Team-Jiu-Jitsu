-- CHAMPION TEAM V37.8
-- Confirmação idempotente de pagamentos Asaas, inclusive após expiração automática.

create or replace function public.reconcile_store_order_payment(
  p_order_id uuid,
  p_provider_paid_at timestamptz default null,
  p_source text default 'asaas_reconciliation'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_reservation record;
  v_status public.order_status;
  v_previous_status text;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok',false,'status','not_found','newly_confirmed',false);
  end if;

  v_previous_status := v_order.status::text;
  if v_previous_status in ('paid','deposit_paid','ready','delivered') then
    return jsonb_build_object('ok',true,'status',v_previous_status,'newly_confirmed',false);
  end if;

  if v_previous_status = 'cancelled'
     and coalesce(v_order.cancellation_reason,'') <> 'expired' then
    return jsonb_build_object('ok',false,'status','manual_cancellation','newly_confirmed',false);
  end if;

  if v_previous_status not in ('pending','cancelled') then
    return jsonb_build_object('ok',false,'status',v_previous_status,'newly_confirmed',false);
  end if;

  for v_reservation in
    select *
    from public.stock_reservations
    where order_id = p_order_id
      and status in ('active','expired')
    order by id
    for update
  loop
    update public.products
       set stock = stock - v_reservation.quantity,
           updated_at = now()
     where id = v_reservation.product_id
       and stock >= v_reservation.quantity;
    if not found then
      raise exception 'Pagamento confirmado, mas o estoque do produto não é suficiente. Acione a administração.';
    end if;
  end loop;

  if not exists (
    select 1 from public.stock_reservations
    where order_id = p_order_id and status in ('active','expired')
  ) then
    raise exception 'Reserva do pedido não encontrada para conversão.';
  end if;

  update public.stock_reservations
     set status = 'converted', updated_at = now()
   where order_id = p_order_id and status in ('active','expired');

  v_status := case
    when v_order.payment_option = 'pix_deposit' then 'deposit_paid'::public.order_status
    else 'paid'::public.order_status
  end;

  update public.orders
     set status = v_status,
         paid_at = coalesce(p_provider_paid_at,now()),
         cancellation_reason = case
           when v_previous_status='cancelled' then 'payment_reconciled_after_expiry'
           else cancellation_reason
         end,
         updated_at = now()
   where id = p_order_id;

  insert into public.audit_logs(academy_id,actor_profile_id,action,entity,entity_id,payload)
  values (
    v_order.academy_id,null,'store_payment_reconciled','orders',p_order_id::text,
    jsonb_build_object(
      'code',v_order.code,
      'source',left(coalesce(p_source,'asaas_reconciliation'),100),
      'previous_status',v_previous_status,
      'final_status',v_status::text,
      'provider_payment_id',v_order.provider_payment_id
    )
  );

  return jsonb_build_object(
    'ok',true,
    'status',v_status::text,
    'previous_status',v_previous_status,
    'newly_confirmed',true
  );
end
$function$;

revoke all on function public.reconcile_store_order_payment(uuid,timestamptz,text)
from public,anon,authenticated;
grant execute on function public.reconcile_store_order_payment(uuid,timestamptz,text)
to service_role;

