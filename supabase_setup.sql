-- ============================================================
--  Aravt · Задачи — настройка базы данных Supabase
--  Откройте Supabase → SQL Editor → New query → вставьте ВСЁ
--  это и нажмите RUN. Один раз.
-- ============================================================

-- 1) Таблица задач
create table if not exists public.tasks (
  id          uuid default gen_random_uuid() primary key,
  title       text not null,
  description text,
  status      text default 'pending',  -- pending / inprogress / done
  priority    text default 'medium',   -- high / medium / low
  category    text default 'work',     -- work / personal
  tags        text[],
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2) Автообновление поля updated_at при любом изменении строки
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

-- 3) Доступ для сайта (anon-ключ): читать список и менять статус кликом.
--    Добавление/удаление задач делает Claude через MCP — у него свои права.
alter table public.tasks enable row level security;

drop policy if exists "tasks_select_anon" on public.tasks;
create policy "tasks_select_anon" on public.tasks
  for select using (true);

drop policy if exists "tasks_update_anon" on public.tasks;
create policy "tasks_update_anon" on public.tasks
  for update using (true) with check (true);

-- 4) Включаем Realtime для таблицы (чтобы сайт обновлялся мгновенно)
alter table public.tasks replica identity full;
alter publication supabase_realtime add table public.tasks;

-- ============================================================
-- 5) Начальные данные
-- ============================================================

-- Работа
insert into public.tasks (title, description, status, priority, category, tags) values
('Мурат ага — Клинкер',
 'Решение по переработке клинкера, вводные данные ожидаются.',
 'pending', 'high', 'work', array['клинкер','переработка']),

('Aravt — Внутренняя платформа',
 'Workflow для каждой позиции сотрудников, интеграция аналитики, подключить Владимира, использовать Claude для распределения задач.',
 'inprogress', 'high', 'work', array['платформа','автоматизация','аналитика']),

('КГМ-трейд — 2000 т серы',
 'Гранулированная сера, директор Дмитрий. Нурлан платит 100% предоплатой, КГМ-трейд — по факту отгрузки.',
 'inprogress', 'medium', 'work', array['трейдинг','сера']),

('Удобрения Алишер → Кайрат',
 'Получить от Алишера цены, ставки, объёмы для сельхозника Кайрата.',
 'pending', 'medium', 'work', array['удобрения','трейдинг']),

('АКК — Заявка (Салтанат)',
 'Салтанат готовит заявку на финансирование в Аграрную кредитную корпорацию.',
 'done', 'medium', 'work', array['финансирование','заявка']),

('Бурундай — Аналитика',
 'Данные от Геллама Уралхановича (ген. директор). Финмодель, сценарии окупаемости, стратегическое решение о входе, своё оборудование в аренду.',
 'pending', 'high', 'work', array['аналитика','финмодель']),

('Далянский проект — Презентация',
 'Завод аминокислот 500 га Вишнёвка, купить элеватор в Боровом, логистика Алматы → Бурундай, экспорт в Китай и Европу.',
 'pending', 'high', 'work', array['презентация','экспорт']),

('EcoSave — Консорциальный договор',
 'Подписать договор совместной деятельности. Запросить финотчётность Bioscience ES и договор по гранту Фонда науки.',
 'inprogress', 'high', 'work', array['договор','юридическое']),

('Дубай — Анализ открытия компании',
 '1-я стадия открытия пройдена, проект заморожен. Проанализировать все проекты холдинга, выбрать 3 направления деятельности, разработать стратегию.',
 'pending', 'high', 'work', array['стратегия','анализ']),

('Флиппинг домов',
 'Изучить: купить или арендовать дом, сделать ремонт, сдавать в консульство. Проработать экономику и механику.',
 'pending', 'low', 'work', array['недвижимость']),

-- Личное
('PriceGen / Any Labs (Идрис)',
 'Стартап с другом Идрисом — динамическое и статистическое ценообразование.',
 'inprogress', 'medium', 'personal', array['стартап','ценообразование']),

('Проект с Женисом',
 'Сосед Женис, снабженец компании «Свой дом». Потенциальное партнёрство, детали уточнить.',
 'pending', 'low', 'personal', array['партнёрство']),

('Ободья — Кирилл',
 'Коллаборация с заводом в Китае, дилерство в Казахстане и России, контакты Ержан и Костя.',
 'inprogress', 'medium', 'personal', array['китай','дилерство']);

-- Готово. Список появится в SQL Editor → Table Editor → tasks.
