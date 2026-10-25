import { Router } from 'express';
import { autenticar, somenteAdmin } from '../middlewares/auth';
import { obter, atualizar } from '../controllers/configuracaoController';

const router = Router();

router.use(autenticar);

router.get('/', obter);
router.put('/', somenteAdmin, atualizar);

export { router as configuracaoRoutes };
