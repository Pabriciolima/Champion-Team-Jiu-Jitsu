-- Champion Team V38.7 - painel de negocio e venda presencial

alter table public.orders alter column student_id drop not null;
alter table public.orders add column if not exists sale_channel text not null default 'online';
alter table public.orders add column if not exists counter_customer_name text;
alter table public.orders add column if not exists counter_customer_phone text;
alter table public.orders add column if not exists created_by uuid references public.profiles(id);

alter table public.orders drop constraint if exists orders_sale_channel_check;
alter table public.orders add constraint orders_sale_channel_check
  check (sale_channel in ('online', 'counter'));

create index if not exists orders_academy_channel_created_idx
  on public.orders (academy_id, sale_channel, created_at desc);

create or replace function public.get_champion_business_dashboard(p_academy_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sessao invalida'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if not found or v_profile.role::text not in ('owner','master_admin') then
    raise exception 'Acesso exclusivo da administracao';
  end if;
  if v_profile.role::text='owner' and v_profile.academy_id is distinct from p_academy_id then
    raise exception 'Academia nao autorizada';
  end if;

  select jsonb_build_object(
    'membership_revenue', coalesce((select sum(amount) from public.payments where academy_id=p_academy_id and status::text='paid'),0),
    'store_revenue', coalesce((select sum(case when status::text in ('paid','ready','delivered') then total when status::text='deposit_paid' then coalesce(amount_due_now,0) else 0 end) from public.orders where academy_id=p_academy_id),0),
    'month_revenue', coalesce((select sum(amount) from public.payments where academy_id=p_academy_id and status::text='paid' and paid_at>=date_trunc('month',now())),0) + coalesce((select sum(case when status::text in ('paid','ready','delivered') then total when status::text='deposit_paid' then coalesce(amount_due_now,0) else 0 end) from public.orders where academy_id=p_academy_id and coalesce(paid_at,created_at)>=date_trunc('month',now()) and status::text in ('paid','deposit_paid','ready','delivered')),0),
    'receivables', coalesce((select sum(amount) from public.payments where academy_id=p_academy_id and status::text in ('pending','overdue')),0),
    'overdue_amount', coalesce((select sum(amount) from public.payments where academy_id=p_academy_id and status::text='overdue'),0),
    'inventory_value', coalesce((select sum(stock * coalesce(nullif(promotional_price,0),price)) from public.products where academy_id=p_academy_id),0),
    'inventory_units', coalesce((select sum(stock) from public.products where academy_id=p_academy_id),0),
    'counter_revenue', coalesce((select sum(total) from public.orders where academy_id=p_academy_id and sale_channel='counter' and status::text in ('paid','ready','delivered')),0),
    'online_revenue', coalesce((select sum(case when status::text in ('paid','ready','delivered') then total when status::text='deposit_paid' then coalesce(amount_due_now,0) else 0 end) from public.orders where academy_id=p_academy_id and sale_channel='online'),0),
    'store_sales_count', (select count(*) from public.orders where academy_id=p_academy_id and status::text in ('paid','deposit_paid','ready','delivered')),
    'active_members', (select count(*) from public.memberships where academy_id=p_academy_id and status::text='active'),
    'overdue_count', (select count(*) from public.payments where academy_id=p_academy_id and status::text='overdue'),
    'average_ticket', coalesce((select avg(total) from public.orders where academy_id=p_academy_id and status::text in ('paid','ready','delivered')),0)
  ) into v_result;
  return v_result || jsonb_build_object('total_revenue',(v_result->>'membership_revenue')::numeric+(v_result->>'store_revenue')::numeric);
end;
$$;

create or replace function public.create_champion_counter_sale(
  p_academy_id uuid,
  p_student_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_payment_method text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_order_id uuid;
  v_code text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_unit_price numeric;
  v_total numeric := 0;
begin
  if auth.uid() is null then raise exception 'Sessao invalida'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if not found or v_profile.role::text not in ('owner','master_admin') then raise exception 'Acesso exclusivo da administracao'; end if;
  if v_profile.role::text='owner' and v_profile.academy_id is distinct from p_academy_id then raise exception 'Academia nao autorizada'; end if;
  if p_payment_method not in ('Dinheiro','Pix','Cartao de debito','Cartao de credito') then raise exception 'Forma de pagamento invalida'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then raise exception 'Adicione pelo menos um produto'; end if;
  if p_student_id is null and nullif(trim(p_customer_name),'') is null then raise exception 'Informe o aluno ou o nome do cliente'; end if;
  if p_student_id is not null and not exists(select 1 from public.students where id=p_student_id and academy_id=p_academy_id) then raise exception 'Aluno nao pertence a esta academia'; end if;

  v_order_id := gen_random_uuid();
  v_code := 'BAL-' || to_char(clock_timestamp(),'YYMMDDHH24MISS') || '-' || upper(substr(md5(random()::text),1,4));

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::integer,0);
    if v_quantity<=0 then raise exception 'Quantidade invalida'; end if;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and academy_id=p_academy_id for update;
    if not found or not v_product.active then raise exception 'Produto indisponivel'; end if;
    if v_product.stock<v_quantity then raise exception 'Estoque insuficiente para %',v_product.name; end if;
    v_unit_price := coalesce(nullif(v_product.promotional_price,0),v_product.price);
    v_total := v_total + (v_unit_price*v_quantity);
    update public.products set stock=stock-v_quantity,updated_at=now() where id=v_product.id;
  end loop;

  insert into public.orders(id,academy_id,student_id,status,total,payment_method,paid_at,created_at,updated_at,code,provider,payment_option,amount_due_now,remaining_balance,sale_channel,counter_customer_name,counter_customer_phone,created_by)
  values(v_order_id,p_academy_id,p_student_id,'paid',v_total,p_payment_method,now(),now(),now(),v_code,'counter','pix_full',v_total,0,'counter',nullif(trim(p_customer_name),''),nullif(trim(p_customer_phone),''),auth.uid());

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and academy_id=p_academy_id;
    v_unit_price := coalesce(nullif(v_product.promotional_price,0),v_product.price);
    insert into public.order_items(id,order_id,product_id,product_name,quantity,unit_price)
      values(gen_random_uuid(),v_order_id,v_product.id,v_product.name,v_quantity,v_unit_price);
  end loop;

  insert into public.audit_logs(academy_id,actor_profile_id,action,entity,entity_id,payload)
  values(p_academy_id,auth.uid(),'counter_sale_created','order',v_order_id::text,jsonb_build_object('code',v_code,'total',v_total,'payment_method',p_payment_method,'items',p_items));

  return jsonb_build_object('order_id',v_order_id,'code',v_code,'total',v_total);
end;
$$;

revoke all on function public.get_champion_business_dashboard(uuid) from public,anon;
revoke all on function public.create_champion_counter_sale(uuid,uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.get_champion_business_dashboard(uuid) to authenticated;
grant execute on function public.create_champion_counter_sale(uuid,uuid,text,text,text,jsonb) to authenticated;
