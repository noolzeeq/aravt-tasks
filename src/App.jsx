import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient.js';

/* =========================================================================
   Метаданные статусов / приоритетов / категорий
   (значения статусов и категорий совпадают с колонками в таблице Supabase)
   ========================================================================= */
const STATUS = {
  pending:    { label: 'В очереди', dot: '#6a6864', order: 0 },
  inprogress: { label: 'В работе',  dot: '#e8e6e1', order: 1 },
  done:       { label: 'Готово',    dot: '#5fa888', order: 2 },
};
const NEXT = { pending: 'inprogress', inprogress: 'done', done: 'pending' };

const PRIO = {
  high:   { label: 'Высокий', color: '#e05a4d' },
  medium: { label: 'Средний', color: '#d9a23b' },
  low:    { label: 'Низкий',  color: '#6b6f76' },
};
const CAT = { work: 'Работа', personal: 'Личное' };

/* ============================== Иконки ============================== */
const Check = (p) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0e0e10"
    strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5" /></svg>
);
const Chevron = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform .25s', transform: open ? 'rotate(180deg)' : 'none', opacity: .55 }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const Live = ({ ok }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: ok ? '#5fa888' : '#6a6864' }}>
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: ok ? '#5fa888' : '#6a6864', boxShadow: ok ? '0 0 8px #5fa888' : 'none' }}></span>
    {ok ? 'realtime' : 'офлайн'}
  </span>
);

/* ============================== Карточка задачи ============================== */
function Card({ t, onToggle }) {
  const [open, setOpen] = useState(false);
  const s = STATUS[t.status] || STATUS.pending;
  const tags = t.tags || [];
  return (
    <div className="bg-panel border border-white/[.07] rounded-2xl overflow-hidden">
      <div className="flex gap-3 p-4 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        {/* Кружок статуса — клик по нему переключает pending → inprogress → done */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(t); }}
          className="flex-none w-6 h-6 mt-0.5 rounded-full grid place-items-center transition active:scale-90"
          style={{
            border: t.status === 'pending' ? '1.8px solid rgba(255,255,255,.12)' : `1.8px solid ${s.dot}`,
            background: t.status === 'done' ? s.dot : 'transparent',
          }}
          aria-label="Сменить статус"
        >
          {t.status === 'inprogress' && <span className="w-2 h-2 rounded-full" style={{ background: s.dot }}></span>}
          {t.status === 'done' && <Check />}
        </button>

        <div className="flex-1 min-w-0">
          <h3 className={'text-[15.5px] font-medium leading-snug tracking-tight break-words ' + (t.status === 'done' ? 'line-through text-muted decoration-dim' : '')}>
            {t.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }}></span>{s.label}
            </span>
            {tags.slice(0, 2).map((tg, i) => <span key={i} className="font-mono text-[11.5px] text-dim">#{tg}</span>)}
            {tags.length > 2 && <span className="text-[11.5px] text-dim">+{tags.length - 2}</span>}
          </div>
        </div>

        <div className="flex-none flex flex-col items-end gap-2.5 pt-0.5">
          {/* Цветовой индикатор приоритета: красный / жёлтый / серый */}
          <span className="w-2.5 h-2.5 rounded-full" title={PRIO[t.priority]?.label}
            style={{ background: PRIO[t.priority]?.color, boxShadow: t.priority === 'high' ? `0 0 9px -1px ${PRIO[t.priority].color}` : 'none' }}></span>
          <Chevron open={open} />
        </div>
      </div>

      {/* Раскрывающаяся часть: описание + все теги */}
      <div className="grid" style={{ transition: 'grid-template-rows .28s cubic-bezier(.2,.8,.2,1)', gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pl-[52px]">
            {t.description && <p className="text-[14px] leading-relaxed text-muted">{t.description}</p>}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map((tg, i) => <span key={i} className="font-mono text-[12px] text-muted bg-panel2 border border-white/[.07] rounded-md px-2 py-1">#{tg}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== Приложение ============================== */
export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [fStatus, setFStatus] = useState('all');
  const [fCat, setFCat] = useState('all');
  const [fPrio, setFPrio] = useState('all');

  /* --- Первая загрузка + подписка на изменения в реальном времени --- */
  useEffect(() => {
    let active = true;

    async function fetchTasks() {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true });
      if (!active) return;
      if (error) { setError('Не удалось загрузить задачи: ' + error.message); }
      else { setTasks(data || []); setError(''); }
      setLoading(false);
    }
    fetchTasks();

    // Realtime: любое изменение в таблице tasks мгновенно прилетает сюда
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        setTasks((prev) => {
          if (payload.eventType === 'INSERT') {
            if (prev.some((t) => t.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          }
          if (payload.eventType === 'UPDATE') {
            return prev.map((t) => (t.id === payload.new.id ? payload.new : t));
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter((t) => t.id !== payload.old.id);
          }
          return prev;
        });
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  /* --- Переключение статуса кликом (с оптимистичным обновлением) --- */
  async function toggle(t) {
    const next = NEXT[t.status];
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x))); // мгновенно в UI
    const { error } = await supabase
      .from('tasks')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', t.id);
    if (error) { // откат при ошибке
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: t.status } : x)));
    }
  }

  /* --- Счётчики, прогресс, фильтрация, группировка --- */
  const counts = useMemo(() => {
    const c = { pending: 0, inprogress: 0, done: 0 };
    tasks.forEach((t) => { if (c[t.status] != null) c[t.status]++; });
    return c;
  }, [tasks]);
  const pct = tasks.length ? Math.round(counts.done / tasks.length * 100) : 0;

  const filtered = useMemo(() => tasks.filter((t) =>
    (fStatus === 'all' || t.status === fStatus) &&
    (fCat === 'all' || t.category === fCat) &&
    (fPrio === 'all' || t.priority === fPrio)
  ), [tasks, fStatus, fCat, fPrio]);

  const groups = ['work', 'personal']
    .map((c) => ({ key: c, label: CAT[c], items: filtered.filter((t) => t.category === c) }))
    .filter((g) => g.items.length);

  return (
    <div className="max-w-[640px] mx-auto px-[18px] pb-24 text-cream">
      {/* ===== Шапка: прогресс + счётчики по статусам ===== */}
      <header className="sticky top-0 z-30 pt-[18px] pb-3.5" style={{ background: 'linear-gradient(#0e0e10 72%,rgba(14,14,16,0))' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-[30px] h-[30px] rounded-lg bg-cream text-black grid place-items-center font-bold text-base tracking-tight">A</div>
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight leading-none">Задачи</h1>
              <div className="font-mono text-[11px] text-dim mt-1 tracking-wider">ARAVT HOLDING</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] text-muted tabular-nums"><b className="text-cream font-semibold">{counts.done}</b> из {tasks.length} · {pct}%</div>
            <div className="mt-1 flex justify-end"><Live ok={live} /></div>
          </div>
        </div>
        <div className="mt-3.5 h-1.5 rounded-full bg-panel2 border border-white/[.07] overflow-hidden">
          <i className="block h-full bg-cream rounded-full" style={{ width: pct + '%', transition: 'width .5s cubic-bezier(.2,.8,.2,1)' }}></i>
        </div>
        <div className="mt-3 flex items-center gap-4 text-[12.5px] text-muted">
          {Object.keys(STATUS).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS[k].dot }}></span>
              {STATUS[k].label}<b className="text-cream font-semibold tabular-nums ml-0.5">{counts[k]}</b>
            </span>
          ))}
        </div>
      </header>

      {/* ===== Фильтры ===== */}
      <div className="flex flex-col gap-2.5 mt-3">
        <div className="no-bar flex bg-panel border border-white/[.07] rounded-xl p-1 gap-1 overflow-x-auto">
          {[['all', 'Все'], ['inprogress', 'В работе'], ['pending', 'В очереди'], ['done', 'Готово']].map(([k, l]) => (
            <button key={k} onClick={() => setFStatus(k)}
              className={'flex-1 whitespace-nowrap text-[13px] font-medium px-3 py-1.5 rounded-lg transition ' + (fStatus === k ? 'bg-panel2 text-cream' : 'text-muted')}>{l}</button>
          ))}
        </div>
        <div className="no-bar flex gap-2 overflow-x-auto">
          {[['all', 'Категория'], ['work', 'Работа'], ['personal', 'Личное']].map(([k, l]) => (
            <button key={k} onClick={() => setFCat(k)}
              className={'flex-none text-[13px] px-3 py-1.5 rounded-full transition border ' + (fCat === k ? 'border-white/[.12] text-cream bg-panel2' : 'border-white/[.07] text-muted bg-panel')}>{l}</button>
          ))}
          <span className="flex-none w-px bg-white/10 my-0.5"></span>
          {[['all', 'Приоритет'], ['high', 'Высокий'], ['medium', 'Средний'], ['low', 'Низкий']].map(([k, l]) => (
            <button key={k} onClick={() => setFPrio(k)}
              className={'flex-none inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full transition border ' + (fPrio === k ? 'border-white/[.12] text-cream bg-panel2' : 'border-white/[.07] text-muted bg-panel')}>
              {k !== 'all' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIO[k].color }}></span>}{l}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Содержимое ===== */}
      {loading ? (
        <div className="text-center py-20 text-dim">Загрузка…</div>
      ) : error ? (
        <div className="mt-6 bg-panel border border-white/[.07] rounded-2xl p-5 text-[14px] text-muted leading-relaxed">
          <div className="text-cream font-medium mb-1">Нет связи с базой</div>
          {error}
          <div className="mt-2 text-dim text-[13px]">Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в настройках Vercel.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-dim"><div className="text-4xl opacity-50 mb-2">∅</div>Ничего не найдено</div>
      ) : (
        groups.map((g) => (
          <section className="mt-6" key={g.key}>
            <div className="flex items-center gap-2.5 mb-3 mx-1">
              <h2 className="text-[13px] font-semibold tracking-wider uppercase text-muted">{g.label}</h2>
              <span className="font-mono text-[12px] text-dim tabular-nums">{g.items.length}</span>
              <span className="flex-1 h-px bg-white/[.07]"></span>
            </div>
            <div className="flex flex-col gap-2.5">
              {g.items.map((t) => <Card key={t.id} t={t} onToggle={toggle} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
