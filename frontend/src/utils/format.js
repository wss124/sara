import dayjs from 'dayjs';

// Ex.: "seg, 30/09/2026 · 08:00 – 10:00" (ou datas completas se o período atravessar dias)
export function formatarPeriodo(inicio, fim) {
  const i = dayjs(inicio);
  const f = dayjs(fim);

  if (i.isSame(f, 'day')) {
    return `${i.format('ddd, DD/MM/YYYY')} · ${i.format('HH:mm')} – ${f.format('HH:mm')}`;
  }
  return `${i.format('DD/MM/YYYY HH:mm')} – ${f.format('DD/MM/YYYY HH:mm')}`;
}

export function getUsuarioLogado() {
  try {
    return JSON.parse(localStorage.getItem('sara_user'));
  } catch {
    return null;
  }
}
