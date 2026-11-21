import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PrivateRoute from '../../src/routes/PrivateRoute';
import AdminRoute from '../../src/routes/AdminRoute';
import UserRoute from '../../src/routes/UserRoute';

function logarComo(perfil) {
  localStorage.setItem('sara_auth', 'true');
  localStorage.setItem('sara_user', JSON.stringify({ nome: 'Teste', perfil }));
}

// Abre "/protegida" com a guarda e mostra em qual página o usuário terminou
function abrir(Guarda) {
  render(
    <MemoryRouter initialEntries={['/protegida']}>
      <Routes>
        <Route
          path="/protegida"
          element={
            <Guarda>
              <p>conteúdo protegido</p>
            </Guarda>
          }
        />
        <Route path="/login" element={<p>página de login</p>} />
        <Route path="/home" element={<p>página inicial</p>} />
        <Route path="/approvals" element={<p>página de aprovações</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PrivateRoute', () => {
  it('manda para o login quem não está autenticado', () => {
    abrir(PrivateRoute);
    expect(screen.getByText('página de login')).toBeInTheDocument();
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
  });

  it('libera a página para quem está autenticado', () => {
    logarComo('PROFESSOR');
    abrir(PrivateRoute);
    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('libera a página para o admin', () => {
    logarComo('ADMIN');
    abrir(AdminRoute);
    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument();
  });

  it('manda o professor de volta para a Home', () => {
    logarComo('PROFESSOR');
    abrir(AdminRoute);
    expect(screen.getByText('página inicial')).toBeInTheDocument();
  });

  it('manda para a Home quem não tem usuário salvo', () => {
    abrir(AdminRoute);
    expect(screen.getByText('página inicial')).toBeInTheDocument();
  });
});

describe('UserRoute', () => {
  it('libera a página para o professor', () => {
    logarComo('PROFESSOR');
    abrir(UserRoute);
    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument();
  });

  it('manda o admin para a tela de Aprovações', () => {
    logarComo('ADMIN');
    abrir(UserRoute);
    expect(screen.getByText('página de aprovações')).toBeInTheDocument();
  });
});
