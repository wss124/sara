import { describe, expect, it } from 'vitest';
import { ESTADOS_MANUAIS, ESTADOS_RECURSO, recursoBloqueado } from '../../src/utils/estadoRecurso';

describe('recursoBloqueado', () => {
  it.each([
    ['DISPONIVEL', false],
    ['EM_USO', false],
    ['EM_MANUTENCAO', true],
    ['INDISPONIVEL', true],
  ])('recurso %s bloqueado = %s', (estado, esperado) => {
    expect(recursoBloqueado({ estado })).toBe(esperado);
  });
});

describe('estados do recurso', () => {
  it('o admin não escolhe EM_USO manualmente (vem da retirada)', () => {
    expect(ESTADOS_MANUAIS).not.toContain('EM_USO');
    ESTADOS_MANUAIS.forEach((e) => expect(ESTADOS_RECURSO[e]).toBeDefined());
  });
});
