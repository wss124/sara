import { Router } from 'express';
import { autenticar, somenteAdmin } from '../middlewares/auth';
import { previa, criar, aprovar, recusar, cancelar } from '../controllers/recorrenciaController';

const router = Router();

router.use(autenticar);

// Professor
router.post('/previa', previa);
router.post('/', criar);
router.delete('/:id', cancelar);

// Administrador
router.patch('/:id/aprovar', somenteAdmin, aprovar);
router.patch('/:id/recusar', somenteAdmin, recusar);

export { router as recorrenciaRoutes };
