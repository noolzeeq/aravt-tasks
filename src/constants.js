// ============================================================
//  Словари значений, помощники и переиспользуемые мелочи.
//  Значения статусов/приоритетов СОВПАДАЮТ со схемой Supabase
//  и со словарём в README (важно для управления через Claude/MCP).
// ============================================================

export const STATUS = {
  pending:    { label: 'В очереди',     short: 'Очередь',  dot: '#6a6864' },
  inprogress: { label: 'В работе',      short: 'В работе', dot: '#e8e6e1' },
  blocked:    { label: 'Заблокировано', short: 'Блок',     dot: '#c8654f' },
  postponed:  { label: 'Отложено',      short: 'Отложено', dot: '#7e87b3' },
  done:       { label: 'Готово',        short: 'Готово',   dot: '#5fa888' },
};
export const STATUS_ORDER = ['pending', 'inprogress', 'blocked', 'postponed', 'done'];
// Клик по кружку статуса циклически переключает основные стадии
export const NEXT = { pending: 'inprogress', inprogress: 'done', done: 'pending', blocked: 'inprogress', postponed: 'inprogress' };

export const PRIO = {
  urgent: { label: 'Срочно',  color: '#e0564d' },
  high:   { label: 'Высокий', color: '#e0883b' },
  medium: { label: 'Средний', color: '#d9b23b' },
  low:    { label: 'Низкий',  color: '#6b6f76' },
};
export const PRIO_ORDER = ['urgent', 'high', 'medium', 'low'];
export const PRIO_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

export const SLICES = [['all', 'Все сроки'], ['today', 'Сегодня'], ['upcoming', 'Ближайшие'], ['overdue', 'Просрочено']];
export const SORTS = [['manual', 'Вручную'], ['due', 'По сроку'], ['priority', 'По приоритету'], ['created', 'По дате создания']];

// ---------------- даты ----------------
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export function dueInfo(d) {
  if (!d) return null;
  const today = startOfDay(new Date()), due = startOfDay(new Date(d));
  const diff = Math.round((due - today) / 86400000);
  let text;
  if (diff === 0) text = 'сегодня';
  else if (diff === 1) text = 'завтра';
  else if (diff === -1) text = 'вчера';
  else if (diff < 0) text = Math.abs(diff) + ' дн. назад';
  else if (diff < 7) text = 'через ' + diff + ' дн.';
  else text = due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return { text, diff, overdue: diff < 0, today: diff === 0, soon: diff >= 0 && diff <= 2 };
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' +
         d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Быстрый ввод: "#тег !срочно @Проект текст задачи"
export function parseQuick(raw) {
  let priority = null, category = null; const tags = []; const words = [];
  raw.trim().split(/\s+/).forEach((w) => {
    if (/^#.+/.test(w)) tags.push(w.slice(1));
    else if (/^@.+/.test(w)) category = w.slice(1);
    else if (/^!/.test(w)) {
      const k = w.slice(1).toLowerCase();
      const m = { 'срочно': 'urgent', 'urgent': 'urgent', 'высокий': 'high', 'high': 'high', 'выс': 'high', 'средний': 'medium', 'med': 'medium', 'medium': 'medium', 'низкий': 'low', 'low': 'low' };
      if (m[k]) priority = m[k]; else words.push(w);
    } else words.push(w);
  });
  return { title: words.join(' ').trim(), priority, category, tags };
}
