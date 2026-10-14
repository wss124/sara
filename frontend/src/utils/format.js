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

// Ex.: "Extensão, Cabo HDMI (2)" a partir dos acessórios de uma solicitação
export function descreverAcessorios(itens = []) {
  return itens
    .map((i) => (i.quantidade > 1 ? `${i.acessorio.nome} (${i.quantidade})` : i.acessorio.nome))
    .join(', ');
}

// Quem está usando a reserva: o usuário ou, no uso institucional lançado
// pelo admin, a finalidade descrita na observação
export function responsavelPela(reserva) {
  return reserva.institucional
    ? `Uso institucional${reserva.observacao ? ` · ${reserva.observacao}` : ''}`
    : reserva.usuario.nome;
}
