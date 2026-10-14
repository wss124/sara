import { Router } from 'express';
import { autenticar, somenteAdmin } from '../middlewares/auth';
import {
  listar,
  criar,
  atualizar,
  remover,
  disponibilidade,
  regularizar,
} from '../controllers/acessorioController';

const router = Router();

// Itens que acompanham os recursos (extensão, cabo HDMI, controle...)
router.use(autenticar);

router.get('/', listar);
router.get('/disponibilidade', disponibilidade);
router.post('/', somenteAdmin, criar);
router.put('/:id', somenteAdmin, atualizar);
router.delete('/:id', somenteAdmin, remover);
router.patch('/:id/regularizar', somenteAdmin, regularizar);

export { router as acessorioRoutes };
