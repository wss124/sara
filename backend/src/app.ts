import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/authRoutes';
import { recursoRoutes } from './routes/recursoRoutes';
import { solicitacaoRoutes } from './routes/solicitacaoRoutes';
import { dashboardRoutes } from './routes/dashboardRoutes';
import { usuarioRoutes } from './routes/usuarioRoutes';
import { acessorioRoutes } from './routes/acessorioRoutes';
import { turnoRoutes } from './routes/turnoRoutes';
import { recorrenciaRoutes } from './routes/recorrenciaRoutes';
import { UPLOADS_DIR } from './lib/upload';

// Aplicação Express sem o listen, para ser usada pelo servidor e pelos testes
export const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/', (req, res) => {
  res.json({ message: 'API do SARA rodando com sucesso!' });
});
app.use('/auth', authRoutes);
app.use('/recursos', recursoRoutes);
app.use('/solicitacoes', solicitacaoRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/usuarios', usuarioRoutes);
app.use('/acessorios', acessorioRoutes);
app.use('/turnos', turnoRoutes);
app.use('/recorrencias', recorrenciaRoutes);
