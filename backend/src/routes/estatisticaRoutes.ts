import { Router } from 'express';
import { autenticar, somenteAdmin } from '../middlewares/auth';
import { estatisticas } from '../controllers/estatisticaController';

const router = Router();

router.get('/', autenticar, somenteAdmin, estatisticas);

export { router as estatisticaRoutes };
