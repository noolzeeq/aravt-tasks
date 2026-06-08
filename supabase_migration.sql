-- ============================================================
--  Aravt · Задачи — АДДИТИВНАЯ миграция до полноценного
--  таск-менеджера.
--
--  Безопасна для существующих данных: ничего не удаляет и не
--  пересоздаёт. Только добавляет колонки/таблицы/политики
--  (if not exists / с дефолтами). Выполните ОДИН раз:
--  Supabase → SQL Editor → New query → вставьте ВСЁ → RUN.
--
--  Если таблицы tasks ещё нет (чистый проект) — см. блок 0:
--  он создаст её. Если таблица уже есть с вашими задачами —
--  блок 0 ничего не тронет.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Базовая таблица (создаётся только если её ещё нет).
--    На существующую таблицу с данными НЕ влияет.
-- ------------------------------------------------------------
create table if not exists public.tasks (
  id          uuid default gen_random_uuid() primary key,
  title       text not null,
  description text,
  status      text default 'pending',
  priority    text default 'medium',
  category    text default 'work',
  tags        text[],
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ------------------------------------------------------------
-- 1) Новые колонки задачи (аддитивно, безопасно для строк).
-- ------------------------------------------------------------
alter table public.tasks add column if not exists details      text;          -- расширенные детали (необязательно; description тоже остаётся)
alter table public.tasks add column if not exists due_date     date;          -- срок / дедлайн
alter table public.tasks add column if not exists start_date   date;          -- дата начала
alter table public.tasks add column if not exists completed_at  timestamptz;  -- когда переведено в «готово»
alter table public.tasks add column if not exists sort_order   double precision; -- ручной порядок для drag-and-drop

-- Бэкофилл ручного порядка по дате создания (только там, где ещё пусто).
with ranked as (
  select id, row_number() over (order by created_at) * 1000.0 as rn
  from public.tasks
  where sort_order is null
)
update public.tasks t set sort_order = ranked.rn
from ranked where t.id = ranked.id;

alter table public.tasks alter column sort_order set default 0;

-- Проставить completed_at уже завершённым задачам (где ещё пусто).
update public.tasks
set completed_at = coalesce(updated_at, now())
where status = 'done' and completed_at is null;

-- ------------------------------------------------------------
-- 2) Допустимые значения статуса/приоритета — мягкие CHECK.
--    Существующие значения (pending/inprogress/done, high/medium/low)
--    входят в новые наборы, поэтому добавление безопасно.
--    NB: на category ОГРАНИЧЕНИЙ НЕТ — категория/проект свободный текст.
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_status_chk') then
    alter table public.tasks
      add constraint tasks_status_chk
      check (status in ('pending','inprogress','blocked','postponed','done'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_priority_chk') then
    alter table public.tasks
      add constraint tasks_priority_chk
      check (priority in ('urgent','high','medium','low'));
  end if;
end $$;

-- ------------------------------------------------------------
-- 3) Журнал прогресса (датированные заметки, история — не перезапись).
-- ------------------------------------------------------------
create table if not exists public.task_notes (
  id         uuid default gen_random_uuid() primary key,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);
create index if not exists task_notes_task_id_idx on public.task_notes(task_id);

-- ------------------------------------------------------------
-- 4) Подзадачи (чеклист внутри задачи).
-- ------------------------------------------------------------
create table if not exists public.subtasks (
  id         uuid default gen_random_uuid() primary key,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  title      text not null,
  done       boolean default false,
  sort_order double precision default 0,
  created_at timestamptz default now()
);
create index if not exists subtasks_task_id_idx on public.subtasks(task_id);

-- ------------------------------------------------------------
-- 5) Триггеры
-- ------------------------------------------------------------
-- updated_at при любом изменении строки задачи
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- completed_at автоматически: ставим при переходе в done, снимаем при выходе из done
create or replace function public.set_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end; $$;

drop trigger if exists trg_tasks_completed_at on public.tasks;
create trigger trg_tasks_completed_at
  before update on public.tasks
  for each row execute function public.set_completed_at();

-- ------------------------------------------------------------
-- 6) RLS — закрываем доступ. Только авторизованный пользователь
--    может читать и писать. Claude (MCP) ходит сервисным ключом
--    (service_role) и RLS ОБХОДИТ — поэтому голос/текст продолжат
--    работать. anon-доступ убираем полностью.
-- ------------------------------------------------------------
alter table public.tasks      enable row level security;
alter table public.task_notes enable row level security;
alter table public.subtasks   enable row level security;

-- Снять старые открытые (anon) политики, если остались с прошлой версии.
drop policy if exists "tasks_select_anon" on public.tasks;
drop policy if exists "tasks_update_anon" on public.tasks;

-- tasks — полный доступ только authenticated
drop policy if exists "tasks_all_auth" on public.tasks;
create policy "tasks_all_auth" on public.tasks
  for all to authenticated using (true) with check (true);

-- task_notes
drop policy if exists "task_notes_all_auth" on public.task_notes;
create policy "task_notes_all_auth" on public.task_notes
  for all to authenticated using (true) with check (true);

-- subtasks
drop policy if exists "subtasks_all_auth" on public.subtasks;
create policy "subtasks_all_auth" on public.subtasks
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- 7) Realtime — мгновенные обновления на сайте по всем трём таблицам.
--    add table ... оборачиваем, чтобы повтор не падал с ошибкой.
-- ------------------------------------------------------------
alter table public.tasks      replica identity full;
alter table public.task_notes replica identity full;
alter table public.subtasks   replica identity full;

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.tasks';      exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.task_notes'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.subtasks';   exception when duplicate_object then null; end;
end $$;

-- Готово. Существующие задачи на месте, доступ закрыт, новые
-- возможности (заметки, подзадачи, сроки, ручной порядок) включены.
