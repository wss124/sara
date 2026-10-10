import { Navigate } from 'react-router-dom';
import { getUsuarioLogado } from '../utils/format';

// Páginas de quem faz solicitações; o admin vai para a tela de Aprovações
export default function UserRoute({ children }) {
  if (getUsuarioLogado()?.perfil === 'ADMIN') {
    return <Navigate to="/approvals" replace />;
  }

  return children;
}
