import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient.js';
import { useStore } from './useStore.js';
import {
  STATUS, STATUS_ORDER, NEXT, PRIO, PRIO_ORDER, PRIO_RANK,
  SLICES, SORTS, dueInfo, parseQuick,
} from './constants.js';
import { I, StatusDot } from './ui.jsx';
import Card from './Card.jsx';
import Detail from './Detail.jsx';
import Auth from './Auth.jsx';

/* ============================================================
   Перетаскивание (pointer-based). Старт с ручки ≡.
   col='list' → перестановка в списке; col=status → доска.
   ============================================================ */
function useDnD({ onDrop, viewRef }) {
  const [drag, setDrag] = useState(null);
  const overRef = useRef({ col: null, index: null });
  const dragRef = useRef(null);

  const start = (e, item, getCard) => {
    e.preventDefault(); e.stopPropagation();
    const card = getCard(); if (!card) return;
    const r = card.getBoundingClientRect();
    const pt = e.touches ? e.touches[0] : e;
    const d = { id: item.id, item, w: r.width, x: pt.clientX, y: pt.clientY, offX: pt.clientX - r.left, offY: pt.clientY - r.top, html: card.innerHTML };
    dragRef.current = d; setDrag(d);

    const move = (ev) => {
      const p = ev.touches ? ev.touches[0] : ev;
      dragRef.current = { ...dragRef.current, x: p.clientX, y: p.clientY };
      setDrag({ ...dragRef.current });
      const el = document.elementFromPoint(p.clientX, p.clientY);
      const colEl = el && el.closest('[data-col]');
      const col = colEl ? colEl.getAttribute('data-col') : overRef.current.col;
      let index = null;
      if (colEl) {
        const cards = [...colEl.querySelectorAll('[data-card]')].filter((c) => c.getAttribute('data-card') !== d.id);
        index = cards.length;
        for (let i = 0; i < cards.length; i++) { const cr = cards[i].getBoundingClientRect(); if (p.clientY < cr.top + cr.height / 2) { index = i; break; } }
      }
      overRef.current = { col, index };
      document.querySelectorAll('[data-col]').forEach((c) => c.classList.toggle('col-over', c.getAttribute('data-col') === col));
    };
    const up = () => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
      document.querySelectorAll('.col-over').forEach((c) => c.classList.remove('col-over'));
      const o = overRef.current; if (o.col != null) onDrop(dragRef.current.item, o.col, o.index);
      dragRef.current = null; overRef.current = { col: null, index: null }; setDrag(null);
    };
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', up);
  };
  return { drag, start };
}

/* ============================================================
   РАБОЧЕЕ ПРОСТРАНСТВО (после входа)
   ============================================================ */
function Workspace({ email }) {
  const store = useStore();
  const { tasks, subtasks, notes, loading, error, live, api } = store;

  const [view, setView] = useState(() => localStorage.getItem('aravt_view') || 'list');
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [fCat, setFCat] = useState('all');
  const [fPrio, setFPrio] = useState('all');
  const [slice, setSlice] = useState('all');
  const [sort, setSort] = useState('manual');
  const [sortOpen, setSortOpen] = useState(false);
  const [open, setOpen] = useState(null);
  const [quick, setQuick] = useState('');
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => { localStorage.setItem('aravt_view', view); }, [view]);

  const categories = useMemo(() => [...new Set(tasks.map((t) => t.category).filter(Boolean))].sort(), [tasks]);
  const subsByTask = useMemo(() => { const m = {}; subtasks.forEach((s) => (m[s.task_id] = m[s.task_id] || []).push(s)); return m; }, [subtasks]);
  const notesByTask = useMemo(() => { const m = {}; notes.forEach((n) => (m[n.task_id] = (m[n.task_id] || 0) + 1)); return m; }, [notes]);

  const counts = useMemo(() => { const c = { pending: 0, inprogress: 0, blocked: 0, postponed: 0, done: 0 }; tasks.forEach((t) => { if (c[t.status] != null) c[t.status]++; }); return c; }, [tasks]);
  const pct = tasks.length ? Math.round(counts.done / tasks.length * 100) : 0;

  const matchSlice = (t) => {
    if (slice === 'all') return true;
    const di = dueInfo(t.due_date); if (!di) return false;
    if (slice === 'today') return di.today;
    if (slice === 'overdue') return di.overdue;
    if (slice === 'upcoming') return di.diff >= 0 && di.diff <= 7;
    return true;
  };

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const r = tasks.filter((t) =>
      (fStatus === 'all' || t.status === fStatus) && (fCat === 'all' || t.category === fCat) &&
      (fPrio === 'all' || t.priority === fPrio) && matchSlice(t) &&
      (!ql || (t.title + ' ' + (t.description || '') + ' ' + (t.category || '') + ' ' + (t.tags || []).join(' ')).toLowerCase().includes(ql)));
    const by = {
      manual: (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
      due: (a, b) => ((a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1),
      priority: (a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority],
      created: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    };
    return [...r].sort(by[sort]);
  }, [tasks, q, fStatus, fCat, fPrio, slice, sort]);

  const dnd = useDnD({
    viewRef,
    onDrop: (item, col, index) => {
      if (viewRef.current === 'board') {
        const colTasks = filtered.filter((t) => t.status === col && t.id !== item.id);
        const ins = index == null ? colTasks.length : index;
        const ordered = [...colTasks]; ordered.splice(ins, 0, { ...item, status: col });
        if (item.status !== col) api.updateTask(item.id, { status: col });
        api.reorderTasks(ordered);
      } else {
        const arr = filtered.filter((t) => t.id !== item.id);
        const ins = index == null ? arr.length : index; arr.splice(ins, 0, item);
        api.reorderTasks(arr);
        if (sort !== 'manual') setSort('manual');
      }
    },
  });

  const submitQuick = () => {
    if (!quick.trim()) return;
    const p = parseQuick(quick); if (!p.title) { setQuick(''); return; }
    api.createTask({ title: p.title, priority: p.priority || 'medium', category: p.category || 'Работа', tags: p.tags, status: 'pending' });
    setQuick('');
  };

  const cardFor = (t) => (
    <Card t={t} subs={subsByTask[t.id] || []} noteCount={notesByTask[t.id] || 0}
      onToggle={(x) => api.updateTask(x.id, { status: NEXT[x.status] })} onOpen={(id) => setOpen({ id })}
      dragging={dnd.drag?.id === t.id}
      dragHandle={{ onPointerDown: (e) => { const card = e.currentTarget.closest('[data-card]'); dnd.start(e, t, () => card); } }} />
  );

  const listGroups = useMemo(() => {
    if (sort !== 'manual') return [{ key: '__flat', label: null, items: filtered }];
    const order = [...new Set(filtered.map((t) => t.category))];
    return order.map((c) => ({ key: c, label: c, items: filtered.filter((t) => t.category === c) })).filter((g) => g.items.length);
  }, [filtered, sort]);

  return (
    <div className="min-h-screen">
      <div className={(view === 'board' ? 'max-w-[1180px]' : 'max-w-[680px]') + ' mx-auto px-[15px] sm:px-5 pb-28'}>
        {/* ШАПКА */}
        <header className="sticky top-0 z-30 pt-4 pb-3" style={{ background: 'linear-gradient(#0e0e10 78%,rgba(14,14,16,0))' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-[32px] h-[32px] rounded-lg bg-cream text-black grid place-items-center font-bold text-base tracking-tight">A</div>
              <div><h1 className="text-[18px] font-semibold tracking-tight leading-none">Задачи</h1><div className="font-mono text-[10.5px] text-dim mt-1 tracking-wider">ARAVT HOLDING</div></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[13px] text-muted tabular-nums"><b className="text-cream font-semibold">{counts.done}</b>/{tasks.length} · {pct}%</div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] font-mono" style={{ color: live ? '#5fa888' : '#6a6864' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: live ? '#5fa888' : '#6a6864', boxShadow: live ? '0 0 8px #5fa888' : 'none' }} />{live ? 'realtime' : 'офлайн'}
                </div>
              </div>
              <button onClick={() => supabase.auth.signOut()} className="w-9 h-9 grid place-items-center rounded-xl bg-panel brd text-dim hover:text-cream transition" aria-label="Выйти"><I.logout width="16" height="16" /></button>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-panel2 brd overflow-hidden"><i className="block h-full bg-cream rounded-full" style={{ width: pct + '%', transition: 'width .5s cubic-bezier(.2,.8,.2,1)' }} /></div>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex bg-panel brd rounded-xl p-1 gap-1 flex-none">
              {[['list', I.list], ['board', I.board]].map(([k, Ico]) => <button key={k} onClick={() => setView(k)} className={'w-9 h-8 grid place-items-center rounded-lg transition ' + (view === k ? 'bg-panel3 text-cream' : 'text-dim hover:text-muted')}><Ico width="17" height="17" /></button>)}
            </div>
            <div className="flex-1 flex items-center gap-2 bg-panel brd rounded-xl px-3 h-10">
              <I.search width="16" height="16" className="text-dim flex-none" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по задачам, тегам…" className="flex-1 min-w-0 bg-transparent text-[14px] text-cream placeholder:text-dim focus:outline-none" />
              {q && <button onClick={() => setQ('')} className="text-dim hover:text-cream flex-none"><I.x width="15" height="15" /></button>}
            </div>
            <div className="relative flex-none">
              <button onClick={() => setSortOpen((o) => !o)} className={'w-10 h-10 grid place-items-center rounded-xl brd transition ' + (sort !== 'manual' ? 'bg-panel3 text-cream' : 'bg-panel text-dim hover:text-muted')}><I.sort width="17" height="17" /></button>
              {sortOpen && <><div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} /><div className="absolute right-0 mt-1.5 z-20 bg-panel2 brd2 rounded-xl p-1 w-44 fade-in" style={{ boxShadow: '0 12px 40px rgba(0,0,0,.5)' }}>
                {SORTS.map(([k, l]) => <button key={k} onClick={() => { setSort(k); setSortOpen(false); }} className={'w-full text-left text-[13.5px] px-3 py-2 rounded-lg transition ' + (sort === k ? 'bg-panel3 text-cream' : 'text-muted hover:text-cream')}>{l}</button>)}
              </div></>}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 bg-panel brd rounded-xl pl-3 pr-1.5 h-11 focus-within:border-white/20 transition">
            <I.plus width="17" height="17" className="text-dim flex-none" />
            <input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitQuick(); }} placeholder="Быстро добавить…  !срочно  @Проект  #тег" className="flex-1 min-w-0 bg-transparent text-[14px] text-cream placeholder:text-dim focus:outline-none" />
            {quick.trim() && <button onClick={submitQuick} className="flex-none text-[12.5px] font-semibold px-3 py-1.5 rounded-lg bg-cream text-black fade-in">Enter ↵</button>}
          </div>

          {view === 'list' && <div className="no-bar flex mt-2 bg-panel brd rounded-xl p-1 gap-1 overflow-x-auto">
            {[['all', 'Все'], ['inprogress', 'В работе'], ['pending', 'Очередь'], ['blocked', 'Блок'], ['postponed', 'Отложено'], ['done', 'Готово']].map(([k, l]) =>
              <button key={k} onClick={() => setFStatus(k)} className={'flex-none whitespace-nowrap text-[13px] font-medium px-3 py-1.5 rounded-lg transition ' + (fStatus === k ? 'bg-panel3 text-cream' : 'text-muted hover:text-cream')}>{l}</button>)}
          </div>}
          <div className="no-bar flex gap-2 mt-2 overflow-x-auto pb-0.5">
            {SLICES.map(([k, l]) => <button key={k} onClick={() => setSlice(k)} className={'flex-none text-[12.5px] px-3 py-1.5 rounded-full transition border ' + (slice === k ? 'brd2 text-cream bg-panel3' : 'brd text-muted bg-panel hover:text-cream')}>{l}</button>)}
            <span className="flex-none w-px bg-white/10 my-1" />
            <button onClick={() => setFCat('all')} className={'flex-none text-[12.5px] px-3 py-1.5 rounded-full transition border ' + (fCat === 'all' ? 'brd2 text-cream bg-panel3' : 'brd text-muted bg-panel hover:text-cream')}>Все проекты</button>
            {categories.map((c) => <button key={c} onClick={() => setFCat(c)} className={'flex-none whitespace-nowrap text-[12.5px] px-3 py-1.5 rounded-full transition border ' + (fCat === c ? 'brd2 text-cream bg-panel3' : 'brd text-muted bg-panel hover:text-cream')}>{c}</button>)}
            <span className="flex-none w-px bg-white/10 my-1" />
            {[['all', 'Приоритет'], ...PRIO_ORDER.map((k) => [k, PRIO[k].label])].map(([k, l]) => <button key={k} onClick={() => setFPrio(k)} className={'flex-none inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-full transition border ' + (fPrio === k ? 'brd2 text-cream bg-panel3' : 'brd text-muted bg-panel hover:text-cream')}>{k !== 'all' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIO[k].color }} />}{l}</button>)}
          </div>
        </header>

        {/* СОДЕРЖИМОЕ */}
        {loading ? (
          <div className="text-center py-20 text-dim">Загрузка…</div>
        ) : error ? (
          <div className="mt-6 bg-panel brd rounded-2xl p-5 text-[14px] text-muted leading-relaxed">
            <div className="text-cream font-medium mb-1">Нет связи с базой</div>{error}
            <div className="mt-2 text-dim text-[13px]">Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в настройках Vercel и выполните миграцию SQL.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-dim fade-in"><div className="text-4xl opacity-40 mb-2">∅</div>Ничего не найдено<div className="text-[13px] mt-1">Измените фильтры или добавьте задачу выше.</div></div>
        ) : view === 'list' ? (
          <div className="mt-4" data-col="list">
            {listGroups.map((g) => (
              <section className="mb-6" key={g.key}>
                {g.label && <div className="flex items-center gap-2.5 mb-3 mx-1"><h2 className="text-[12px] font-semibold tracking-wider uppercase text-muted">{g.label}</h2><span className="font-mono text-[11px] text-dim tabular-nums">{g.items.length}</span><span className="flex-1 h-px bg-white/[.06]" /></div>}
                <div className="flex flex-col gap-2.5">{g.items.map((t) => <div key={t.id} data-card={t.id}>{cardFor(t)}</div>)}</div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex gap-3 overflow-x-auto no-bar pb-2 -mx-[15px] px-[15px] sm:mx-0 sm:px-0">
            {STATUS_ORDER.map((col) => { const items = filtered.filter((t) => t.status === col); return (
              <div key={col} data-col={col} className="flex-none w-[270px] sm:w-[300px] bg-panel/40 brd rounded-2xl p-2.5 transition self-start min-h-[120px]">
                <div className="flex items-center gap-2 px-1.5 py-1.5 mb-1"><StatusDot s={col} size={8} /><h2 className="text-[13px] font-semibold tracking-tight">{STATUS[col].label}</h2><span className="font-mono text-[11px] text-dim ml-auto tabular-nums">{items.length}</span></div>
                <div className="flex flex-col gap-2.5 min-h-[40px]">{items.map((t) => <div key={t.id} data-card={t.id}>{cardFor(t)}</div>)}
                  {items.length === 0 && <div className="text-center text-[12px] text-dim py-6 brd border-dashed rounded-xl">перетащите сюда</div>}
                </div>
              </div>
            ); })}
          </div>
        )}
      </div>

      <button onClick={() => setOpen({ new: true })} className="fixed bottom-6 right-5 sm:right-6 z-40 w-14 h-14 rounded-2xl bg-cream text-black grid place-items-center active:scale-95 transition" style={{ boxShadow: '0 12px 36px -6px rgba(232,230,225,.35)' }} aria-label="Новая задача"><I.plus width="24" height="24" /></button>

      {dnd.drag && <div className="drag-ghost" style={{ left: dnd.drag.x - dnd.drag.offX, top: dnd.drag.y - dnd.drag.offY, '--gw': dnd.drag.w + 'px' }}><div className="bg-panel brd2 rounded-2xl" dangerouslySetInnerHTML={{ __html: dnd.drag.html }} /></div>}

      {open && <Detail taskId={open.id} isNew={!!open.new} store={store} categories={categories} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ============================================================
   ВХОД-ГЕЙТ: пока нет сессии — экран логина.
   ============================================================ */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = ещё проверяем

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="min-h-screen grid place-items-center text-dim">…</div>;
  if (!session) return <Auth />;
  return <Workspace email={session.user?.email} />;
}
