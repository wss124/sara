import { Router } from 'express';
import { autenticar } from '../middlewares/auth';
import { resumo } from '../controllers/dashboardController';

const router = Router();

router.use(autenticar);

router.get('/', resumo);

export { router as dashboardRoutes };
