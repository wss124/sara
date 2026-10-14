import { Router } from 'express';
import { autenticar, somenteAdmin } from '../middlewares/auth';
import { listar, criar, atualizar, remover } from '../controllers/turnoController';

const router = Router();

router.use(autenticar);

router.get('/', listar);
router.post('/', somenteAdmin, criar);
router.put('/:id', somenteAdmin, atualizar);
router.delete('/:id', somenteAdmin, remover);

export { router as turnoRoutes };
