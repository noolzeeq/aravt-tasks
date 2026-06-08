import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient.js';

// ============================================================
//  useStore — единый слой данных поверх Supabase.
//
//  • Грузит tasks + subtasks + task_notes
//  • Подписывается на Realtime по всем трём таблицам: любое
//    изменение (с сайта, из Supabase или от Claude по MCP)
//    мгновенно прилетает сюда без перезагрузки.
//  • Все мутации оптимистичны: UI меняется сразу, при ошибке —
//    откат. Для INSERT используем клиентский uuid, чтобы
//    оптимистичная строка и Realtime-событие имели один id
//    (без мигания/дублей).
// ============================================================

const newId = () =>
  (crypto?.randomUUID?.() ||
    ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    })));

// Применяет Realtime-событие к локальному массиву
function applyRT(setArr, payload, orderKey) {
  setArr((prev) => {
    if (payload.eventType === 'INSERT') {
      if (prev.some((r) => r.id === payload.new.id)) {
        return prev.map((r) => (r.id === payload.new.id ? payload.new : r));
      }
      const next = [...prev, payload.new];
      return orderKey ? next : next;
    }
    if (payload.eventType === 'UPDATE') return prev.map((r) => (r.id === payload.new.id ? payload.new : r));
    if (payload.eventType === 'DELETE') return prev.filter((r) => r.id !== payload.old.id);
    return prev;
  });
}

export function useStore() {
  const [tasks, setTasks] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    let active = true;
    (async () => {
      const [tq, sq, nq] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('subtasks').select('*'),
        supabase.from('task_notes').select('*'),
      ]);
      if (!active) return;
      if (tq.error) { setError(tq.error.message); }
      else {
        setTasks(tq.data || []);
        setSubtasks(sq.data || []);
        setNotes(nq.data || []);
        setError('');
      }
      setLoading(false);
    })();

    const ch = supabase
      .channel('aravt-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' },      (p) => applyRT(setTasks, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' },   (p) => applyRT(setSubtasks, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_notes' }, (p) => applyRT(setNotes, p))
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  const api = useMemo(() => ({
    // ---------- ЗАДАЧИ ----------
    async createTask(f) {
      const id = newId();
      const maxOrder = Math.max(0, ...tasksRef.current.map((t) => t.sort_order || 0));
      const row = {
        id,
        title: (f.title || '').trim() || 'Без названия',
        description: f.description || '',
        status: f.status || 'pending',
        priority: f.priority || 'medium',
        category: (f.category || 'Работа').trim() || 'Работа',
        tags: f.tags || [],
        due_date: f.due_date || null,
        sort_order: maxOrder + 1000,
      };
      const optimistic = { ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: f.status === 'done' ? new Date().toISOString() : null };
      setTasks((p) => [...p, optimistic]);
      const { error } = await supabase.from('tasks').insert(row);
      if (error) { setTasks((p) => p.filter((t) => t.id !== id)); setError(error.message); return null; }
      return id;
    },

    async updateTask(id, patch) {
      const before = tasksRef.current.find((t) => t.id === id);
      setTasks((p) => p.map((t) => {
        if (t.id !== id) return t;
        const n = { ...t, ...patch, updated_at: new Date().toISOString() };
        if (patch.status) {
          if (patch.status === 'done' && t.status !== 'done') n.completed_at = new Date().toISOString();
          if (patch.status !== 'done') n.completed_at = null;
        }
        return n;
      }));
      const { error } = await supabase.from('tasks').update(patch).eq('id', id);
      if (error && before) { setTasks((p) => p.map((t) => (t.id === id ? before : t))); setError(error.message); }
    },

    async deleteTask(id) {
      const snapTasks = tasksRef.current;
      setTasks((p) => p.filter((t) => t.id !== id));
      setSubtasks((p) => p.filter((s) => s.task_id !== id));
      setNotes((p) => p.filter((n) => n.task_id !== id));
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) { setTasks(snapTasks); setError(error.message); } // подзадачи/заметки вернёт Realtime/перезагрузка
    },

    // Перестановка: принимает массив задач в нужном порядке, проставляет sort_order
    async reorderTasks(list) {
      const updates = list.map((t, i) => ({ id: t.id, order: (i + 1) * 1000 }));
      setTasks((p) => p.map((t) => {
        const u = updates.find((x) => x.id === t.id);
        return u ? { ...t, sort_order: u.order } : t;
      }));
      await Promise.all(updates.map((u) => supabase.from('tasks').update({ sort_order: u.order }).eq('id', u.id)));
    },

    // ---------- ПОДЗАДАЧИ ----------
    async addSubtask(task_id, title) {
      const id = newId();
      const maxOrder = Math.max(0, ...subtasks.filter((s) => s.task_id === task_id).map((s) => s.sort_order || 0));
      const row = { id, task_id, title: title.trim(), done: false, sort_order: maxOrder + 1000 };
      setSubtasks((p) => [...p, { ...row, created_at: new Date().toISOString() }]);
      const { error } = await supabase.from('subtasks').insert(row);
      if (error) { setSubtasks((p) => p.filter((s) => s.id !== id)); setError(error.message); }
    },
    async toggleSubtask(id) {
      let nextVal;
      setSubtasks((p) => p.map((s) => { if (s.id !== id) return s; nextVal = !s.done; return { ...s, done: nextVal }; }));
      const { error } = await supabase.from('subtasks').update({ done: nextVal }).eq('id', id);
      if (error) { setSubtasks((p) => p.map((s) => (s.id === id ? { ...s, done: !nextVal } : s))); setError(error.message); }
    },
    async deleteSubtask(id) {
      const snap = subtasks;
      setSubtasks((p) => p.filter((s) => s.id !== id));
      const { error } = await supabase.from('subtasks').delete().eq('id', id);
      if (error) { setSubtasks(snap); setError(error.message); }
    },

    // ---------- ЖУРНАЛ ПРОГРЕССА ----------
    async addNote(task_id, body) {
      const id = newId();
      const row = { id, task_id, body: body.trim() };
      setNotes((p) => [...p, { ...row, created_at: new Date().toISOString() }]);
      const { error } = await supabase.from('task_notes').insert(row);
      if (error) { setNotes((p) => p.filter((n) => n.id !== id)); setError(error.message); }
    },
    async deleteNote(id) {
      const snap = notes;
      setNotes((p) => p.filter((n) => n.id !== id));
      const { error } = await supabase.from('task_notes').delete().eq('id', id);
      if (error) { setNotes(snap); setError(error.message); }
    },
  }), [subtasks, notes]);

  return { tasks, subtasks, notes, loading, error, live, api };
}
