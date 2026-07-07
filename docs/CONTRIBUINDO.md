# Guia de Contribuição

## Filosofia

Este é um sistema que processa **dados de saúde de pacientes** — uma categoria sensível
pela LGPD. Toda contribuição deve ser avaliada não só por "funciona?", mas por
"isso preserva os princípios de privacy/security by design do projeto?". Em caso de
dúvida, prefira a opção mais conservadora e documente a decisão.

## Preparando o ambiente

```bash
git clone <repositório> exames-sistema
cd exames-sistema
npm install              # instala Husky + lint-staged e registra o hook pre-commit
cp .env.example .env     # ajuste para seu ambiente local
```

Para rodar o sistema completo, veja [INSTALACAO.md](INSTALACAO.md). Para desenvolver
com hot-reload, prefira a instalação manual descrita lá (backend via `npm run start:dev`,
frontend via `npm run dev`).

## Padrões de código

- **TypeScript em modo estrito** — não introduza `any` nem desabilite checagens sem uma
  justificativa clara em comentário.
- **Nomes em português, no domínio do negócio** (`Lancamento`, `Tecnico`, `paginar`,
  `redefinirSenha`) — siga a convenção já estabelecida; não misture inglês e português
  na mesma camada.
- **Sem comentários redundantes** — escreva código que se explica por nomes; reserve
  comentários para decisões não óbvias (por que, não o quê).
- **DTOs explícitos** para toda entrada/saída — nunca exponha entidades do Prisma
  diretamente; controle deliberadamente quais campos trafegam (minimização de dados).
- **Formatação**: Prettier. **Lint**: ESLint. Ambos rodam automaticamente no
  pre-commit (`backend/**` e `frontend/**`) e são checados no CI.

```bash
# Backend
cd backend && npm run lint && npm run format

# Frontend
cd frontend && npm run lint && npm run format
```

## Lidando com dados sensíveis (checklist obrigatório)

Antes de abrir um PR que toque em `Paciente`, `Tecnico`, ou qualquer campo pessoal,
verifique:

- [ ] Campos de identificação (documento, contato) passam pelo `CryptoService` —
      nunca são persistidos em texto claro.
- [ ] Novas rotas/operações sobre dados sensíveis emitem evento de auditoria
      (verifique se o interceptor de auditoria cobre o novo caminho).
- [ ] Respostas da API só incluem os campos que o papel do solicitante pode ver
      (nenhum dado sensível "vaza" para papéis sem permissão).
- [ ] Logs adicionados não incluem nomes, documentos, contatos ou qualquer dado de
      saúde — apenas identificadores técnicos.
- [ ] Exclusões usam soft delete (`deletadoEm`), não exclusão física.

## Testes

Cobertura mínima é verificada no CI — PRs que reduzem a cobertura abaixo do limiar
configurado (`jest.config`/`coverageThreshold` no backend, `coverage.thresholds` no
`vite.config.ts` do frontend) falham automaticamente.

```bash
# Backend — testes unitários
cd backend && npm test
cd backend && npm run test:cov     # com relatório de cobertura

# Frontend — testes de componentes
cd frontend && npm test
cd frontend && npm run test:cov    # com relatório de cobertura
```

Diretrizes para novos testes:

- Sirva-se dos padrões já estabelecidos (mocks de `PrismaService`/`CryptoService`/
  `AuditService` no backend; `vi.mock` de `@/api/httpClient` no frontend).
- Para regras de negócio sensíveis (ex.: cifragem, RBAC, auditoria, revogação de
  sessão), teste explicitamente o **caminho de falha/negação**, não apenas o sucesso —
  é nesses caminhos que vulnerabilidades costumam se esconder.
- Testes de UI usam Testing Library com foco em comportamento observável pelo usuário
  (`getByRole`/`getByText`/`getByPlaceholderText`), não em detalhes de implementação.

## Banco de dados e migrações

Qualquer mudança em `backend/prisma/schema.prisma` deve vir acompanhada de uma migração
versionada:

```bash
cd backend
npx prisma migrate dev --name descricao_da_mudanca
```

Revise o SQL gerado em `prisma/migrations/` antes de commitar — principalmente para
mudanças que afetem colunas com dados existentes (renomeações, mudanças de tipo,
constraints `NOT NULL`), que podem exigir passos manuais de backfill.

## Fluxo de Pull Request

1. Crie um branch a partir de `main`/`master` com um nome descritivo.
2. Garanta que lint, testes e build passam localmente antes de abrir o PR — o pipeline
   de CI roda as mesmas checagens (`.github/workflows/ci.yml`,
   `.github/workflows/security.yml`, `.github/workflows/codeql.yml`) e bloqueará o
   merge em caso de falha.
3. Descreva no PR **o que mudou e por quê** — principalmente se a mudança envolve
   dados sensíveis, permissões ou comportamento de auditoria.
4. Aguarde os checks de CI (incluindo SAST/varredura de dependências/imagens) e a
   revisão de outra pessoa antes do merge.

## Ao introduzir novas dependências

- Avalie se a dependência é realmente necessária — cada nova dependência amplia a
  superfície de ataque e o trabalho de manutenção/atualização.
- Após adicionar, rode `npm audit` no respectivo projeto (`backend`/`frontend`) e
  avalie o resultado — vulnerabilidades críticas em dependências de produção bloqueiam
  o pipeline (ver [SEGURANCA_E_PRIVACIDADE.md](SEGURANCA_E_PRIVACIDADE.md), seção 4).
