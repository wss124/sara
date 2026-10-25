import { afterEach, describe, expect, it, vi } from 'vitest';
import { enviarEmail } from '../src/lib/email';

describe('envio de e-mail', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sem SMTP configurado, registra no log sem falhar', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const ok = await enviarEmail({ para: 'a@prp.uespi.br', assunto: 'Oi', html: '<p>Oi</p>', texto: 'Oi' });

    expect(ok).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Oi -> a@prp.uespi.br'));
  });

  it('sem destinatário não envia', async () => {
    const ok = await enviarEmail({ para: [], assunto: 'Oi', html: '', texto: '' });
    expect(ok).toBe(false);
  });
});
