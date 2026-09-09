-- ============================================================
-- CHAMPION TEAM SaaS — MIGRATION 06
-- Check-in com selfie + validação professor/gestor
-- ============================================================

alter table public.checkins
  add column if not exists validation_status text not null default 'approved',
  add column if not exists validated_by uuid references public.profiles(id) on delete set null,
  add column if not exists validated_at timestamptz,
  add column if not exists validation_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'checkins_validation_status_check'
  ) then
    alter table public.checkins
      add constraint checkins_validation_status_check
      check (validation_status in ('pending','approved','rejected'));
  end if;
end $$;

create index if not exists checkins_validation_status_idx
  on public.checkins(academy_id, validation_status, checkin_date desc);

create index if not exists checkins_validated_by_idx
  on public.checkins(validated_by);

-- O aluno pode ver somente os próprios check-ins.
drop policy if exists checkins_student_read on public.checkins;
create policy checkins_student_read
on public.checkins
for select
to authenticated
using (
  public.is_student()
  and student_id in (
    select s.id from public.students s where s.profile_id = auth.uid()
  )
);

-- O aluno cria somente o próprio check-in com status pendente.
drop policy if exists checkins_student_insert on public.checkins;
create policy checkins_student_insert
on public.checkins
for insert
to authenticated
with check (
  public.is_student()
  and academy_id = public.current_academy_id()
  and student_id in (
    select s.id from public.students s where s.profile_id = auth.uid()
  )
  and validation_status = 'pending'
  and source = 'student_selfie'
);

-- Professor visualiza apenas check-ins das próprias turmas.
drop policy if exists checkins_teacher_read on public.checkins;
create policy checkins_teacher_read
on public.checkins
for select
to authenticated
using (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and class_id in (
    select c.id
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where t.profile_id = auth.uid()
      and c.academy_id = public.current_academy_id()
  )
);

-- Professor pode SOMENTE validar check-in das próprias turmas.
drop policy if exists checkins_teacher_validate on public.checkins;
create policy checkins_teacher_validate
on public.checkins
for update
to authenticated
using (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and class_id in (
    select c.id
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where t.profile_id = auth.uid()
      and c.academy_id = public.current_academy_id()
  )
)
with check (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and class_id in (
    select c.id
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where t.profile_id = auth.uid()
      and c.academy_id = public.current_academy_id()
  )
  and validation_status in ('approved','rejected')
);

-- Aluno pode enxergar apenas as turmas às quais está vinculado.
drop policy if exists classes_student_read on public.classes;
create policy classes_student_read
on public.classes
for select
to authenticated
using (
  public.is_student()
  and id in (
    select cs.class_id
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where s.profile_id = auth.uid()
  )
);

-- O Storage já está privado.
-- Reforço: aluno vê somente sua pasta; professor/dono/master podem visualizar.
drop policy if exists checkins_storage_read on storage.objects;
create policy checkins_storage_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'checkins'
  and (
    public.is_master()
    or public.is_owner()
    or public.is_teacher()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists checkins_storage_insert on storage.objects;
create policy checkins_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'checkins'
  and (
    public.is_master()
    or public.is_owner()
    or (
      public.is_student()
      and (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

-- Realtime para check-ins, caso ainda não esteja adicionado.
do $$
begin
  begin
    alter publication supabase_realtime add table public.checkins;
  exception when duplicate_object then
    null;
  end;
end $$;
