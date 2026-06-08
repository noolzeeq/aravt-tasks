import { STATUS, PRIO } from './constants.js';

// ============================================================
//  Иконки (тонкие штриховые, в духе минимализма приложения)
// ============================================================
export const I = {
  check:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5" /></svg>,
  chev:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6" /></svg>,
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>,
  plus:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14" /></svg>,
  x:      (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>,
  grip:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M5 8h14M5 12h14M5 16h14" /></svg>,
  trash:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>,
  cal:    (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>,
  note:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 4h16v12l-4 4H4z" /><path d="M15 20v-4h4" /></svg>,
  list:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>,
  board:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="4" width="6" height="16" rx="1.5" /><rect x="11" y="4" width="6" height="11" rx="1.5" /><rect x="19" y="4" width="2" height="16" rx="1" opacity=".5" /></svg>,
  sort:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 4v16M7 4l-3 3M7 4l3 3M17 20V4M17 20l3-3M17 20l-3-3" /></svg>,
  logout: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
};

// ============================================================
//  Мелкие переиспользуемые элементы
// ============================================================
export function StatusDot({ s, size = 10 }) {
  return <span className="rounded-full inline-block flex-none" style={{ width: size, height: size, background: STATUS[s]?.dot }} />;
}

export function PrioDot({ p }) {
  if (!p) return null;
  return <span className="rounded-full inline-block flex-none"
    style={{ width: 9, height: 9, background: PRIO[p].color, boxShadow: (p === 'urgent' || p === 'high') ? `0 0 8px -1px ${PRIO[p].color}` : 'none' }}
    title={PRIO[p].label} />;
}

export function Pill({ active, color, onClick, children }) {
  return (
    <button onClick={onClick}
      className={'inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full transition border ' + (active ? 'brd2 text-cream bg-panel3' : 'brd text-muted bg-panel2 hover:text-cream')}>
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}{children}
    </button>
  );
}

export function Section({ title, children, right }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-[12px] font-semibold tracking-wider uppercase text-dim">{title}</h4>
        {right}
      </div>
      {children}
    </div>
  );
}
