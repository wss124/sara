// Carrega o .env antes de qualquer módulo que leia process.env
import './env';
import { app } from './app';
import { iniciarRotinas } from './rotinas';

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  iniciarRotinas();
});
