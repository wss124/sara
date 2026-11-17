import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from '../../src/pages/Login/Login';
import { loginRequest } from '../../src/services/authService';

vi.mock('../../src/services/authService', () => ({ loginRequest: vi.fn() }));

function abrirLogin() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<p>página inicial</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function preencher(email, senha) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByPlaceholderText('seuemail@uespi.br'), email);
  if (senha) await user.type(screen.getByPlaceholderText('Senha'), senha);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('Login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exige e-mail e senha antes de enviar', async () => {
    abrirLogin();
    await preencher();
    expect(await screen.findByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument();
    expect(loginRequest).not.toHaveBeenCalled();
  });

  it('recusa e-mail inválido e senha curta', async () => {
    abrirLogin();
    await preencher('nao-e-email', '123');
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('A senha deve ter no mínimo 6 caracteres')).toBeInTheDocument();
    expect(loginRequest).not.toHaveBeenCalled();
  });

  it('salva a sessão e vai para a Home quando o login dá certo', async () => {
    const usuario = { id: 1, nome: 'Ana', perfil: 'PROFESSOR' };
    loginRequest.mockResolvedValue({ token: 'tok-123', usuario });

    abrirLogin();
    await preencher('ana@uespi.br', 'senha123');

    expect(await screen.findByText('página inicial')).toBeInTheDocument();
    expect(loginRequest).toHaveBeenCalledWith('ana@uespi.br', 'senha123');
    expect(localStorage.getItem('sara_auth')).toBe('true');
    expect(localStorage.getItem('sara_token')).toBe('tok-123');
    expect(JSON.parse(localStorage.getItem('sara_user'))).toEqual(usuario);
  });

  it('mostra o erro do servidor e continua no login quando falha', async () => {
    // A rejeição só é criada na chamada, para não ficar pendente enquanto o usuário digita
    loginRequest.mockImplementation(async () => {
      throw Object.assign(new Error('401'), { response: { data: { error: 'Credenciais inválidas.' } } });
    });

    abrirLogin();
    await preencher('ana@uespi.br', 'senhaerrada');

    expect(await screen.findByText('Credenciais inválidas.')).toBeInTheDocument();
    expect(screen.queryByText('página inicial')).not.toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('sara_token')).toBeNull());
  });
});
