// Domínios de e-mail institucional aceitos no cadastro público. Só professores
// usam o sistema, então o domínio dos alunos (@aluno.uespi.br) fica de fora.
// Configurável pelo .env (separados por vírgula) para outros campi da UESPI.
export const DOMINIOS_PERMITIDOS = (process.env.DOMINIOS_PERMITIDOS || 'prp.uespi.br')
  .split(',')
  .map((dominio) => dominio.trim().toLowerCase())
  .filter(Boolean);

export function emailInstitucional(email: string) {
  const dominio = email.split('@').pop() ?? '';
  return DOMINIOS_PERMITIDOS.includes(dominio);
}
