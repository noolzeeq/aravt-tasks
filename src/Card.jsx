import { STATUS, PRIO, dueInfo } from './constants.js';
import { I, StatusDot, PrioDot } from './ui.jsx';

// ============================================================
//  Карточка задачи (список и доска используют одну и ту же).
//  Перетаскивание стартует с ручки ≡ (надёжно на тач и мышь).
// ============================================================
export default function Card({ t, subs, noteCount, onToggle, onOpen, dragHandle, dragging }) {
  const s = STATUS[t.status] || STATUS.pending;
  const di = dueInfo(t.due_date);
  const done = subs.filter((x) => x.done).length;
  const isDone = t.status === 'done';

  return (
    <div className={'bg-panel brd rounded-2xl overflow-hidden transition ' + (dragging ? 'dragging-src' : '')}>
      <div className="flex gap-3 p-3.5 sm:p-4">
        {/* кружок статуса — клик циклически переключает стадии */}
        <button onClick={(e) => { e.stopPropagation(); onToggle(t); }}
          className="flex-none w-6 h-6 mt-0.5 rounded-full grid place-items-center transition active:scale-90"
          style={{ border: t.status === 'pending' ? '1.8px solid rgba(255,255,255,.13)' : `1.8px solid ${s.dot}`, background: isDone ? s.dot : 'transparent', color: '#0e0e10' }}
          aria-label="Сменить статус">
          {t.status === 'inprogress' && <span className="w-2 h-2 rounded-full" style={{ background: s.dot }} />}
          {t.status === 'blocked' && <span className="w-2.5 h-0.5 rounded" style={{ background: s.dot }} />}
          {t.status === 'postponed' && <I.chev width="12" height="12" style={{ transform: 'rotate(-90deg)', stroke: s.dot, opacity: .9 }} />}
          {isDone && <I.check width="13" height="13" />}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(t.id)}>
          <h3 className={'text-[15.5px] font-medium leading-snug tracking-tight break-words ' + (isDone ? 'line-through text-muted decoration-dim' : '')}>{t.title}</h3>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mt-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted"><StatusDot s={t.status} size={7} />{s.label}</span>
            {di && <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: di.overdue ? '#e0564d' : di.today ? '#e0883b' : '#9a9893' }}><I.cal width="12" height="12" style={{ opacity: .8 }} />{di.text}</span>}
            {subs.length > 0 && <span className="inline-flex items-center gap-1 text-[12px] text-muted"><I.check width="12" height="12" style={{ opacity: .8 }} />{done}/{subs.length}</span>}
            {noteCount > 0 && <span className="inline-flex items-center gap-1 text-[12px] text-dim"><I.note width="12" height="12" />{noteCount}</span>}
            <span className="font-mono text-[11px] text-dim truncate">{t.category}</span>
          </div>
          {subs.length > 0 && (
            <div className="mt-2.5 h-1 rounded-full bg-panel2 overflow-hidden max-w-[180px]">
              <i className="block h-full rounded-full" style={{ width: (subs.length ? done / subs.length * 100 : 0) + '%', background: isDone ? STATUS.done.dot : '#bdbab2', transition: 'width .3s' }} />
            </div>
          )}
        </div>

        <div className="flex-none flex flex-col items-center justify-between py-0.5">
          <PrioDot p={t.priority} />
          <button {...dragHandle} className="text-dim hover:text-muted touch-none cursor-grab active:cursor-grabbing p-1 -mr-1" aria-label="Перетащить" onClick={(e) => e.stopPropagation()}>
            <I.grip width="16" height="16" />
          </button>
        </div>
      </div>
    </div>
  );
}
