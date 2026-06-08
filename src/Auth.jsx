import { useState } from 'react';
import { supabase } from './supabaseClient.js';

// ============================================================
//  Экран входа. Один аккаунт (email + пароль) через Supabase Auth.
//  Весь интерфейс приложения — за этим экраном.
//  Учётную запись создаёте один раз в Supabase Dashboard
//  (Authentication → Users → Add user). Публичная регистрация
//  отключена — здесь только вход.
// ============================================================
export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setErr(error.message === 'Invalid login credentials' ? 'Неверный email или пароль.' : error.message);
    setBusy(false);
  };

  const fld = 'w-full bg-panel2 brd rounded-xl px-4 py-3 text-[15px] text-cream placeholder:text-dim focus:outline-none focus:border-white/20 transition [color-scheme:dark]';

  return (
    <div className="min-h-screen grid place-items-center px-5">
      <form onSubmit={submit} className="w-full max-w-[360px]">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-[36px] h-[36px] rounded-lg bg-cream text-black grid place-items-center font-bold text-lg tracking-tight">A</div>
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight leading-none">Задачи</h1>
            <div className="font-mono text-[10.5px] text-dim mt-1 tracking-wider">ARAVT HOLDING</div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={fld} required />
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" className={fld} required />
        </div>

        {err && <p className="mt-3 text-[13px] text-danger leading-relaxed">{err}</p>}

        <button type="submit" disabled={busy} className="mt-4 w-full py-3 rounded-xl bg-cream text-black font-semibold text-[15px] hover:opacity-90 disabled:opacity-50 transition">
          {busy ? 'Вход…' : 'Войти'}
        </button>

        <p className="mt-5 text-[12px] text-dim leading-relaxed text-center">Доступ только для авторизованного пользователя. Учётная запись создаётся в Supabase Dashboard.</p>
      </form>
    </div>
  );
}
