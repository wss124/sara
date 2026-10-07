# SARA — Sistema de Alocação de Recursos Acadêmicos

Sistema web para reserva de salas, laboratórios e equipamentos da UESPI, Campus Piripiri.
Alunos e professores solicitam um recurso, o sistema bloqueia choques de horário, o
administrador aprova ou recusa, e um dashboard mostra a ocupação em tempo real.

Trabalho de Conclusão de Curso — Bacharelado em Ciência da Computação, UESPI.

## Funcionalidades

- Cadastro restrito a e-mails institucionais (`@aluno.uespi.br` e `@prp.uespi.br`) e login com JWT
- Perfis Aluno, Professor e Administrador; todo cadastro entra como Aluno e o admin promove os demais
- Cadastro e gestão de recursos (salas e equipamentos)
- Solicitação de reserva com verificação de conflito de horário
- Aprovação e recusa de solicitações pelo administrador
- Dashboard com recursos em uso agora, próximas reservas e agenda do dia (atualiza a cada 30 s)

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React, Vite, Ant Design, React Router, Axios, Day.js |
| Backend | Node.js, Express, TypeScript, JWT, bcrypt |
| Banco de dados | PostgreSQL 16 (Docker), Prisma ORM |

## Como rodar

Pré-requisitos: Node.js 22+ e Docker.

```bash
# 1. Banco de dados
docker compose up -d

# 2. Dependências (raiz, backend e frontend)
npm install
npm install --prefix backend
npm install --prefix frontend

# 3. Variáveis de ambiente do backend
cp backend/.env.example backend/.env

# 4. Criar as tabelas
cd backend && npx prisma migrate deploy && cd ..

# 5. (Opcional) Dados de demonstração
npm run seed --prefix backend

# 6. Subir backend e frontend juntos
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3333

### Usuários de demonstração

Criados pelo `npm run seed --prefix backend`, todos com a senha `123456`:

| Perfil | E-mail |
| --- | --- |
| Administrador | admin@prp.uespi.br |
| Professor | professor@prp.uespi.br |
| Aluno | aluna@aluno.uespi.br |

Rodar o seed de novo recria as reservas desses usuários em torno do horário atual (útil antes de uma apresentação).

### Criar um administrador real

```bash
npm run criar-admin --prefix backend -- "Nome" email@prp.uespi.br senha
```

## Estrutura

```
backend/
  prisma/schema.prisma   modelo do banco (Usuario, Recurso, Solicitacao)
  src/routes/            rotas da API (/auth, /recursos, /solicitacoes, /dashboard, /usuarios)
  src/controllers/       regras de negócio
  src/middlewares/       autenticação e permissão de admin
  src/scripts/           seed de demonstração e criação de admin
frontend/
  src/pages/             telas (Login, Cadastro, Home, Recursos, Solicitações, Aprovações, Usuários)
  src/services/          chamadas à API
docker-compose.yml       PostgreSQL
```
