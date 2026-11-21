import { describe, expect, it } from 'vitest';
import { validarFormulario } from '../../src/utils/formulario';

describe('validarFormulario', () => {
  it('devolve os valores quando o formulário é válido', async () => {
    const form = { validateFields: async () => ({ nome: 'Tarde' }) };
    expect(await validarFormulario(form)).toEqual({ nome: 'Tarde' });
  });

  it('devolve null em vez de rejeitar quando há erros nos campos', async () => {
    const form = {
      validateFields: async () => {
        throw { errorFields: [{ name: ['nome'], errors: ['Informe o nome.'] }] };
      },
    };
    await expect(validarFormulario(form)).resolves.toBeNull();
  });
});
