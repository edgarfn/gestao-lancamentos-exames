# Sistema de Gestão de Lançamentos de Exames

Aplicação web para registro e consulta de lançamentos de exames laboratoriais/clínicos —
**Técnico, Paciente, Exame, Data, Quantidade e Valor** — com filtros de consulta por
exame, técnico, data e paciente, exportação em CSV e trilha de auditoria completa.

Construído desde a concepção com **Privacy by Design** e **Security by Design**: o
sistema lida com dados de saúde de pacientes, uma categoria de **dado sensível** segundo
a LGPD (Lei 13.709/2018), e os controles de proteção (cifragem, RBAC, auditoria,
minimização, retenção/anonimização) fazem parte da arquitetura, não foram adicionados
posteriormente.

## Stack tecnológica

| Camada    | Tecnologias                                                                  |
| --------- | ---------------------------------------------------------------------------- |
| Backend   | NestJS, TypeScript, Prisma ORM, PostgreSQL, JWT (access + refresh), argon2id |
| Frontend  | React, TypeScript, Vite, Mantine UI, TanStack React Query                    |
| Banco     | PostgreSQL 16                                                                |
| Infra     | Docker, Docker Compose, Nginx (proxy reverso + servidor estático)            |
| Qualidade | Jest, Vitest, Testing Library, ESLint, Prettier, Husky + lint-staged         |
| DevSecOps | GitHub Actions — CodeQL (SAST), gitleaks, npm audit, Trivy                   |

## Início rápido

```bash
git clone <repositório> exames-sistema
cd exames-sistema
cp .env.example .env        # preencha com segredos fortes (ver comentários no arquivo)
docker compose up -d --build
```

Após os contêineres ficarem saudáveis, acesse `http://localhost:8080`. As credenciais do
usuário administrador inicial são geradas e impressas **uma única vez** no log do
contêiner `backend` durante o seed — veja [INSTALACAO.md](docs/INSTALACAO.md) para o
passo a passo completo.

## Documentação

| Documento                                                     | Conteúdo                                                                     |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [INSTALACAO.md](docs/INSTALACAO.md)                           | Guia de instalação (Docker e manual), variáveis de ambiente, primeiro acesso |
| [ARQUITETURA.md](docs/ARQUITETURA.md)                         | Desenho do sistema, modelo de dados, decisões técnicas (ADR-style)           |
| [MANUAL_DO_USUARIO.md](docs/MANUAL_DO_USUARIO.md)             | Manual de uso — telas, fluxos, filtros, exportações, papéis                  |
| [SEGURANCA_E_PRIVACIDADE.md](docs/SEGURANCA_E_PRIVACIDADE.md) | Modelo de ameaças, controles implementados, conformidade LGPD                |
| [CONFIGURACAO_HTTPS.md](docs/CONFIGURACAO_HTTPS.md)           | Guia de HTTPS em produção (Windows e Linux) com certificado Let's Encrypt    |
| [API.md](docs/API.md)                                         | Referência da API REST e Swagger/OpenAPI                                     |
| [CONTRIBUINDO.md](docs/CONTRIBUINDO.md)                       | Padrões de código, fluxo de desenvolvimento, testes, CI                      |

## Estrutura do repositório

```
/
├── backend/              # API NestJS + Prisma + PostgreSQL
├── frontend/             # SPA React + TypeScript (Vite)
├── docs/                 # Documentação do projeto
├── .github/workflows/    # Pipelines de CI/CD (DevSecOps)
├── docker-compose.yml    # Orquestração de produção (db, backend, frontend)
├── docker-compose.dev.yml# Overlay de desenvolvimento (adminer, porta do banco exposta)
└── .env.example          # Modelo de variáveis de ambiente da orquestração
```

## Licença

Projeto interno — uso conforme definido pela organização proprietária.
