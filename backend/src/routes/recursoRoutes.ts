import { Router } from 'express';
import { autenticar, somenteAdmin } from '../middlewares/auth';
import {
  listar,
  buscarPorId,
  criar,
  atualizar,
  remover,
  atualizarFoto,
  removerFoto,
} from '../controllers/recursoController';

const router = Router();

// Todas as rotas exigem login; alterações são restritas ao admin
router.use(autenticar);

router.get('/', listar);
router.get('/:id', buscarPorId);
router.post('/', somenteAdmin, criar);
router.put('/:id', somenteAdmin, atualizar);
router.delete('/:id', somenteAdmin, remover);
router.put('/:id/foto', somenteAdmin, atualizarFoto);
router.delete('/:id/foto', somenteAdmin, removerFoto);

export { router as recursoRoutes };
