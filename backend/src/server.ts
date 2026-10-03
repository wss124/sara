// Carrega o .env antes de qualquer módulo que leia process.env
import './env';
import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/authRoutes';
import { recursoRoutes } from './routes/recursoRoutes';
import { solicitacaoRoutes } from './routes/solicitacaoRoutes';
import { dashboardRoutes } from './routes/dashboardRoutes';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'API do SARA rodando com sucesso!' });
});
app.use('/auth', authRoutes);
app.use('/recursos', recursoRoutes);
app.use('/solicitacoes', solicitacaoRoutes);
app.use('/dashboard', dashboardRoutes);

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});