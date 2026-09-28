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

export { router as solicitacaoRoutes };
