import { Navigate } from 'react-router-dom';
import { getUsuarioLogado } from '../utils/format';

// Páginas exclusivas do administrador; os demais perfis voltam para a Home
export default function AdminRoute({ children }) {
  if (getUsuarioLogado()?.perfil !== 'ADMIN') {
    return <Navigate to="/home" replace />;
  }

  return children;
}
