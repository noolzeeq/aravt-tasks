import { createClient } from '@supabase/supabase-js';

// Значения берутся из переменных окружения (.env локально, Environment Variables на Vercel).
// anon-ключ публичный и предназначен для браузера — это нормально.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Подсказка в консоли, если забыли заполнить .env
  console.warn('[Aravt] Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Проверьте .env');
}

export const supabase = createClient(url, anonKey, {
  realtime: { params: { eventsPerSecond: 5 } },
});
