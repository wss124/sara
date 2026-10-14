import { Router } from 'express';
import { autenticar, somenteAdmin } from '../middlewares/auth';
import { listar, criar, atualizar, remover } from '../controllers/acessorioController';

const router = Router();

// Itens que acompanham os recursos (extensão, cabo HDMI, controle...)
router.use(autenticar);

router.get('/', listar);
router.post('/', somenteAdmin, criar);
router.put('/:id', somenteAdmin, atualizar);
router.delete('/:id', somenteAdmin, remover);

export { router as acessorioRoutes };
