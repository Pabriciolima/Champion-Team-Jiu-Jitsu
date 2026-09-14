-- Champion Team V39.6
drop policy if exists checkins_student_insert on public.checkins;
create policy checkins_student_insert on public.checkins for insert to authenticated with check (
 public.is_student() and academy_id=public.current_academy_id() and validation_status='pending' and source='student_selfie'
 and student_id in (select s.id from public.students s where s.profile_id=auth.uid())
 and exists(select 1 from public.class_students cs where cs.student_id=checkins.student_id and cs.class_id=checkins.class_id)
);