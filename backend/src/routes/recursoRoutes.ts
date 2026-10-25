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
  alterarEstado,
} from '../controllers/recursoController';
import { definirKit } from '../controllers/acessorioController';
import { disponibilidade } from '../controllers/disponibilidadeController';

const router = Router();

// Todas as rotas exigem login; alterações são restritas ao admin
router.use(autenticar);

router.get('/', listar);
router.get('/:id', buscarPorId);
router.get('/:id/disponibilidade', disponibilidade);
router.post('/', somenteAdmin, criar);
router.put('/:id', somenteAdmin, atualizar);
router.delete('/:id', somenteAdmin, remover);
router.put('/:id/foto', somenteAdmin, atualizarFoto);
router.delete('/:id/foto', somenteAdmin, removerFoto);
router.patch('/:id/estado', somenteAdmin, alterarEstado);
router.put('/:id/acessorios', somenteAdmin, definirKit);

export { router as recursoRoutes };
