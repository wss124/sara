import { Router } from 'express';
import { autenticar, somenteAdmin } from '../middlewares/auth';
import { listar, alterarPerfil } from '../controllers/usuarioController';

const router = Router();

// Gestão de usuários é exclusiva do administrador
router.use(autenticar, somenteAdmin);

router.get('/', listar);
router.patch('/:id/perfil', alterarPerfil);

export { router as usuarioRoutes };
