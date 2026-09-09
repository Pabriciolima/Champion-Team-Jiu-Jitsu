-- ============================================================
-- CHAMPION TEAM SaaS — MIGRATION 05
-- PROFESSOR: acesso somente ao que precisa
-- ============================================================

-- PROFESSOR: somente alunos pertencentes às suas turmas
drop policy if exists students_teacher_read on public.students;
create policy students_teacher_read
on public.students
for select
to authenticated
using (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and id in (
    select cs.student_id
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    join public.teachers t on t.id = c.teacher_id
    where t.profile_id = auth.uid()
      and c.academy_id = public.current_academy_id()
  )
);

-- TURMAS: gestor vê todas; professor somente as próprias.
drop policy if exists classes_read on public.classes;

drop policy if exists classes_admin_read on public.classes;
create policy classes_admin_read
on public.classes
for select
to authenticated
using (
  public.is_master()
  or (
    public.is_owner()
    and academy_id = public.current_academy_id()
  )
);

drop policy if exists classes_teacher_read on public.classes;
create policy classes_teacher_read
on public.classes
for select
to authenticated
using (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and teacher_id in (
    select t.id
    from public.teachers t
    where t.profile_id = auth.uid()
  )
);

-- VÍNCULOS DA TURMA:
-- owner/master = todos da academia
-- professor = apenas alunos de suas turmas
-- aluno = somente seus próprios vínculos
drop policy if exists class_students_read on public.class_students;

drop policy if exists class_students_admin_read on public.class_students;
create policy class_students_admin_read
on public.class_students
for select
to authenticated
using (
  public.is_master()
  or public.is_owner()
);

drop policy if exists class_students_teacher_read on public.class_students;
create policy class_students_teacher_read
on public.class_students
for select
to authenticated
using (
  public.is_teacher()
  and class_id in (
    select c.id
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where t.profile_id = auth.uid()
      and c.academy_id = public.current_academy_id()
  )
);

drop policy if exists class_students_student_read on public.class_students;
create policy class_students_student_read
on public.class_students
for select
to authenticated
using (
  public.is_student()
  and student_id in (
    select s.id
    from public.students s
    where s.profile_id = auth.uid()
  )
);

-- CHECK-IN: professor enxerga apenas presença das próprias turmas
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
  )
);

-- TREINO: professor somente pode criar/editar treino de aluno das suas turmas
drop policy if exists training_teacher_manage on public.training_plans;
create policy training_teacher_manage
on public.training_plans
for all
to authenticated
using (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and teacher_id in (
    select t.id from public.teachers t where t.profile_id = auth.uid()
  )
  and student_id in (
    select cs.student_id
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    join public.teachers t on t.id = c.teacher_id
    where t.profile_id = auth.uid()
  )
)
with check (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and teacher_id in (
    select t.id from public.teachers t where t.profile_id = auth.uid()
  )
  and student_id in (
    select cs.student_id
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    join public.teachers t on t.id = c.teacher_id
    where t.profile_id = auth.uid()
  )
);

-- INDICAÇÃO DE FAIXA: somente alunos das próprias turmas
drop policy if exists belt_teacher_manage on public.belt_recommendations;
create policy belt_teacher_manage
on public.belt_recommendations
for all
to authenticated
using (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and teacher_id in (
    select t.id from public.teachers t where t.profile_id = auth.uid()
  )
  and student_id in (
    select cs.student_id
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    join public.teachers t on t.id = c.teacher_id
    where t.profile_id = auth.uid()
  )
)
with check (
  public.is_teacher()
  and academy_id = public.current_academy_id()
  and teacher_id in (
    select t.id from public.teachers t where t.profile_id = auth.uid()
  )
  and student_id in (
    select cs.student_id
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    join public.teachers t on t.id = c.teacher_id
    where t.profile_id = auth.uid()
  )
);

-- PROFESSOR NÃO TEM POLÍTICAS PARA:
-- plans, memberships, payments, products, orders, notifications administrativas,
-- audit_logs ou CRUD de students/teachers.
-- ============================================================
