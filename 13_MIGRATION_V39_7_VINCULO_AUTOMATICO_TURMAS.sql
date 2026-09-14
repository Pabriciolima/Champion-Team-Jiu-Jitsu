-- Champion Team V39.7
-- Vincula automaticamente matrículas ativas às turmas ativas e preserva a segurança do check-in.

create or replace function public.sync_active_membership_class_links()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status::text='active' then
    insert into public.class_students(class_id,student_id)
    select c.id,new.student_id from public.classes c
    where c.academy_id=new.academy_id and c.active=true
    on conflict (class_id,student_id) do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists champion_membership_sync_class_links on public.memberships;
create trigger champion_membership_sync_class_links
after insert or update of status,student_id,academy_id on public.memberships
for each row execute function public.sync_active_membership_class_links();

create or replace function public.sync_active_class_student_links()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.active=true then
    insert into public.class_students(class_id,student_id)
    select new.id,m.student_id from public.memberships m
    join public.students s on s.id=m.student_id
    where m.academy_id=new.academy_id and m.status::text='active' and s.status::text='active'
    on conflict (class_id,student_id) do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists champion_class_sync_student_links on public.classes;
create trigger champion_class_sync_student_links
after insert or update of active,academy_id on public.classes
for each row execute function public.sync_active_class_student_links();

insert into public.class_students(class_id,student_id)
select c.id,m.student_id from public.memberships m
join public.students s on s.id=m.student_id and s.academy_id=m.academy_id
join public.classes c on c.academy_id=m.academy_id and c.active=true
where m.status::text='active' and s.status::text='active'
on conflict (class_id,student_id) do nothing;

drop policy if exists checkins_student_insert on public.checkins;
create policy checkins_student_insert on public.checkins for insert to authenticated with check (
 public.is_student() and academy_id=public.current_academy_id()
 and validation_status='pending' and source='student_selfie'
 and student_id in (select s.id from public.students s where s.profile_id=auth.uid() and s.status::text='active')
 and exists(select 1 from public.memberships m where m.student_id=checkins.student_id and m.academy_id=checkins.academy_id and m.status::text='active')
 and exists(select 1 from public.class_students cs join public.classes c on c.id=cs.class_id
   where cs.student_id=checkins.student_id and cs.class_id=checkins.class_id
   and c.academy_id=checkins.academy_id and c.active=true)
);