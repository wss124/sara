import { Router } from 'express';
import { autenticar, autenticarPorQuery } from '../middlewares/auth';
import { resumo } from '../controllers/dashboardController';
import { inscrever } from '../lib/eventos';

const router = Router();

// Avisos em tempo real para o dashboard (Server-Sent Events)
router.get('/eventos', autenticarPorQuery, (req, res) => inscrever(res));

router.get('/', autenticar, resumo);

export { router as dashboardRoutes };
