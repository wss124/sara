import { Router } from 'express';
import { autenticar, somenteAdmin } from '../middlewares/auth';
import {
  criar,
  listarMinhas,
  listarTodas,
  ocupacao,
  aprovar,
  recusar,
  cancelar,
  reservar,
  cancelarReserva,
} from '../controllers/solicitacaoController';

const router = Router();

router.use(autenticar);

// Usuário comum
router.post('/', criar);
router.get('/minhas', listarMinhas);
router.get('/ocupacao', ocupacao);
router.delete('/:id', cancelar);

// Administrador
router.get('/', somenteAdmin, listarTodas);
router.patch('/:id/aprovar', somenteAdmin, aprovar);
router.patch('/:id/recusar', somenteAdmin, recusar);
router.post('/reservas', somenteAdmin, reservar);
router.delete('/reservas/:id', somenteAdmin, cancelarReserva);

export { router as solicitacaoRoutes };
