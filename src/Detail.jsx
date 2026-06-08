import { useState, useEffect } from 'react';
import { STATUS, STATUS_ORDER, PRIO, PRIO_ORDER, fmtDateTime } from './constants.js';
import { I, StatusDot, Pill, Section } from './ui.jsx';

// ============================================================
//  Детальная панель: bottom-sheet на телефоне, модал на десктопе.
//  Полный CRUD одной задачи: все поля, теги, подзадачи, журнал.
//  isNew=true — режим создания (черновик, сохраняется по кнопке).
// ============================================================
export default function Detail({ taskId, isNew, store, categories, onClose }) {
  const { tasks, subtasks, notes, api } = store;
  const existing = tasks.find((t) => t.id === taskId);
  const [draft, setDraft] = useState(() => existing || { title: '', description: '', status: 'pending', priority: 'medium', category: 'Работа', tags: [], due_date: null });
  const t = isNew ? draft : existing;
  const [tagInput, setTagInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [subInput, setSubInput] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  // если задачу удалили (с другого устройства / из Claude) — закрываем
  useEffect(() => { if (!isNew && !existing) onClose(); }, [existing, isNew, onClose]);
  if (!t) return null;

  const subs = isNew ? [] : subtasks.filter((s) => s.task_id === taskId).sort((a, b) => a.sort_order - b.sort_order);
  const tNotes = isNew ? [] : notes.filter((n) => n.task_id === taskId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const doneCount = subs.filter((s) => s.done).length;

  const patch = (p) => { if (isNew) setDraft((d) => ({ ...d, ...p })); else api.updateTask(taskId, p); };
  const addTag = (v) => { v = v.trim().replace(/^#/, ''); const cur = t.tags || []; if (!v || cur.includes(v)) return; patch({ tags: [...cur, v] }); setTagInput(''); };
  const rmTag = (v) => patch({ tags: (t.tags || []).filter((x) => x !== v) });

  const save = async () => { if (!draft.title.trim()) { onClose(); return; } await api.createTask(draft); onClose(); };
  const fld = 'w-full bg-panel2 brd rounded-xl px-3.5 py-2.5 text-[14.5px] text-cream placeholder:text-dim focus:outline-none focus:border-white/20 transition';
  const autosize = (e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; };

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center justify-center items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 fade-in" />
      <div onClick={(e) => e.stopPropagation()}
        className="relative sheet-in w-full sm:max-w-[560px] bg-ink sm:bg-panel brd2 sm:rounded-2xl rounded-t-3xl max-h-[93vh] sm:max-h-[88vh] overflow-y-auto no-bar"
        style={{ boxShadow: '0 -10px 60px rgba(0,0,0,.5)' }}>
        <div className="sm:hidden flex justify-center pt-2.5 pb-1"><span className="w-10 h-1 rounded-full bg-white/15" /></div>

        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 sm:px-5 py-3 bg-ink/95 sm:bg-panel/95 backdrop-blur border-b border-white/[.06]">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted"><StatusDot s={t.status} size={8} />{(STATUS[t.status] || STATUS.pending).label}</span>
          <span className="flex-1" />
          {isNew && <button onClick={save} className="text-[13px] font-semibold px-3.5 py-1.5 rounded-full bg-cream text-black hover:opacity-90">Создать</button>}
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full text-muted hover:text-cream hover:bg-white/5"><I.x width="18" height="18" /></button>
        </div>

        <div className="px-4 sm:px-5 pb-8 pt-3">
          <textarea value={t.title} onChange={(e) => patch({ title: e.target.value })} rows={1} placeholder="Название задачи"
            className="w-full bg-transparent text-[20px] font-semibold tracking-tight leading-snug text-cream placeholder:text-dim focus:outline-none resize-none"
            onInput={autosize} ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} />

          <Section title="Статус">
            <div className="flex flex-wrap gap-2">{STATUS_ORDER.map((k) => <Pill key={k} active={t.status === k} color={STATUS[k].dot} onClick={() => patch({ status: k })}>{STATUS[k].label}</Pill>)}</div>
          </Section>

          <Section title="Приоритет">
            <div className="flex flex-wrap gap-2">{PRIO_ORDER.map((k) => <Pill key={k} active={t.priority === k} color={PRIO[k].color} onClick={() => patch({ priority: k })}>{PRIO[k].label}</Pill>)}</div>
          </Section>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <div>
              <h4 className="text-[12px] font-semibold tracking-wider uppercase text-dim mb-2.5">Проект / категория</h4>
              <input list="cats" value={t.category || ''} onChange={(e) => patch({ category: e.target.value })} placeholder="напр. Трейдинг" className={fld} />
              <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <h4 className="text-[12px] font-semibold tracking-wider uppercase text-dim mb-2.5">Срок</h4>
              <input type="date" value={t.due_date || ''} onChange={(e) => patch({ due_date: e.target.value || null })} className={fld + ' [color-scheme:dark]'} />
            </div>
          </div>

          <Section title="Теги">
            <div className="flex flex-wrap gap-2 items-center">
              {(t.tags || []).map((tg) => <span key={tg} className="inline-flex items-center gap-1.5 font-mono text-[12px] text-muted bg-panel2 brd rounded-md pl-2 pr-1 py-1">#{tg}<button onClick={() => rmTag(tg)} className="text-dim hover:text-danger"><I.x width="13" height="13" /></button></span>)}
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); } }} placeholder="+ тег" className="bg-transparent text-[13px] text-cream placeholder:text-dim focus:outline-none w-20 py-1" />
            </div>
          </Section>

          <Section title="Описание">
            <textarea value={t.description || ''} onChange={(e) => patch({ description: e.target.value })} rows={3} placeholder="Подробности задачи: что сделать, контекст, договорённости…"
              className={fld + ' leading-relaxed'} onInput={autosize} />
          </Section>

          {isNew ? (
            <p className="mt-6 text-[12.5px] text-dim leading-relaxed">Подзадачи и журнал прогресса станут доступны после создания задачи.</p>
          ) : (
            <>
              <Section title="Подзадачи" right={subs.length > 0 && <span className="font-mono text-[12px] text-dim">{doneCount}/{subs.length}</span>}>
                <div className="flex flex-col gap-1.5">
                  {subs.map((s) => (
                    <div key={s.id} className="group flex items-center gap-2.5 bg-panel2 brd rounded-xl px-3 py-2.5">
                      <button onClick={() => api.toggleSubtask(s.id)} className="flex-none w-5 h-5 rounded-md grid place-items-center transition" style={{ border: s.done ? 'none' : '1.6px solid rgba(255,255,255,.18)', background: s.done ? STATUS.done.dot : 'transparent', color: '#0e0e10' }}>{s.done && <I.check width="12" height="12" />}</button>
                      <span className={'flex-1 text-[14px] ' + (s.done ? 'line-through text-dim' : 'text-cream')}>{s.title}</span>
                      <button onClick={() => api.deleteSubtask(s.id)} className="flex-none text-dim hover:text-danger opacity-0 group-hover:opacity-100 transition"><I.trash width="15" height="15" /></button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2.5 px-3 py-1">
                    <span className="flex-none w-5 h-5 rounded-md brd grid place-items-center text-dim"><I.plus width="13" height="13" /></span>
                    <input value={subInput} onChange={(e) => setSubInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && subInput.trim()) { api.addSubtask(taskId, subInput.trim()); setSubInput(''); } }} placeholder="Добавить пункт чеклиста" className="flex-1 bg-transparent text-[14px] text-cream placeholder:text-dim focus:outline-none py-1.5" />
                  </div>
                </div>
              </Section>

              <Section title="Журнал прогресса">
                <div className="bg-panel2 brd rounded-xl p-3">
                  <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} rows={2} placeholder="Что сделано, что дальше…" className="w-full bg-transparent text-[14px] text-cream placeholder:text-dim focus:outline-none leading-relaxed" />
                  <div className="flex justify-end"><button disabled={!noteInput.trim()} onClick={() => { api.addNote(taskId, noteInput.trim()); setNoteInput(''); }} className="text-[12.5px] font-medium px-3 py-1.5 rounded-full bg-cream text-black disabled:opacity-30 transition">Добавить запись</button></div>
                </div>
                <div className="mt-3 flex flex-col gap-2.5">
                  {tNotes.length === 0 && <p className="text-[13px] text-dim px-1">Пока нет записей. История апдейтов сохраняется и не перезаписывается.</p>}
                  {tNotes.map((n) => (
                    <div key={n.id} className="group relative pl-4 border-l border-white/10 py-0.5">
                      <span className="absolute left-[-4px] top-1.5 w-2 h-2 rounded-full bg-dim" />
                      <div className="flex items-center gap-2"><span className="font-mono text-[11px] text-dim">{fmtDateTime(n.created_at)}</span><button onClick={() => api.deleteNote(n.id)} className="text-dim hover:text-danger opacity-0 group-hover:opacity-100"><I.x width="13" height="13" /></button></div>
                      <p className="text-[14px] text-muted leading-relaxed mt-1 whitespace-pre-wrap">{n.body}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <div className="mt-7 pt-5 border-t border-white/[.06] flex items-center justify-between">
                <div className="font-mono text-[11px] text-dim leading-relaxed">
                  <div>создано {fmtDateTime(t.created_at)}</div>
                  {t.completed_at && <div>завершено {fmtDateTime(t.completed_at)}</div>}
                </div>
                {confirmDel ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] text-muted">Удалить?</span>
                    <button onClick={() => { api.deleteTask(taskId); onClose(); }} className="text-[12.5px] font-semibold px-3 py-1.5 rounded-full bg-danger text-white">Да</button>
                    <button onClick={() => setConfirmDel(false)} className="text-[12.5px] px-3 py-1.5 rounded-full brd text-muted">Нет</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDel(true)} className="inline-flex items-center gap-1.5 text-[12.5px] text-dim hover:text-danger transition"><I.trash width="15" height="15" />Удалить</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
