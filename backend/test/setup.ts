import { urlBancoDeTeste } from './bancoDeTeste';

// Precisa rodar antes de qualquer import do Prisma Client
process.env.DATABASE_URL = urlBancoDeTeste();
process.env.JWT_SECRET = 'segredo-dos-testes';
// Testes nunca enviam e-mail de verdade: sem SMTP_HOST o envio vira só log
process.env.SMTP_HOST = '';
