# Segurança e Privacidade

Este documento descreve os controles de segurança e privacidade implementados, o
modelo de ameaças considerado e a postura de conformidade com a LGPD (Lei
13.709/2018). Ele existe para que qualquer pessoa — desenvolvedor, auditor, gestor de
risco — entenda **o que foi protegido, contra o quê, e por quê**, sem precisar inferir
isso lendo o código.

## 1. Por que este sistema exige cuidado redobrado

O sistema processa **dados de saúde de pacientes** — uma das categorias de **dado
pessoal sensível** previstas no art. 5º, II, da LGPD. O tratamento desse tipo de dado
impõe obrigações reforçadas: base legal apropriada, minimização, segurança, limitação
de finalidade e de armazenamento, e prestação de contas (accountability). Por isso, os
controles abaixo não são "extras" — são requisitos centrais do projeto, presentes desde
o desenho do schema de dados.

## 2. Modelo de ameaças (resumo)

| Ameaça                                                                | Como o sistema mitiga                                                                                                                                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acesso não autorizado à aplicação                                     | Autenticação JWT obrigatória em todas as rotas (exceto login/refresh, marcadas explicitamente com `@Public()`); rate limiting agressivo no endpoint de login      |
| Automação/bots no login (credential stuffing, scraping de formulário) | Desafio Cloudflare Turnstile (CAPTCHA anti-bot) exigido no login, validado **no servidor** antes de qualquer consulta a credenciais                               |
| Escalonamento de privilégios / acesso indevido a funções              | RBAC (`@Roles`) aplicado em guards no backend — nunca apenas ocultando botões na interface                                                                        |
| Roubo/vazamento de credenciais                                        | Senhas com `argon2id` (hash com custo de memória, resistente a GPU/ASIC); tokens de acesso de curta duração; `versaoSessao` permite revogação imediata e em massa |
| Acesso direto ao banco de dados ou vazamento de backup                | Campos sensíveis (CPF, contato) cifrados em nível de aplicação (AES-256-GCM) — permanecem ilegíveis mesmo com posse do dump                                       |
| Injeção (SQL, NoSQL, mass assignment)                                 | Prisma ORM com consultas parametrizadas; `ValidationPipe` global com `whitelist`/`forbidNonWhitelisted` rejeitando campos inesperados                             |
| Cross-Site Scripting (XSS) / Clickjacking / sniffing                  | Cabeçalhos de segurança via Helmet (CSP restritiva, HSTS, `frameAncestors: 'none'`)                                                                               |
| CSRF / abuso entre origens                                            | CORS restrito a origens explicitamente cadastradas (`CORS_ALLOWED_ORIGINS`); métodos HTTP limitados                                                               |
| Força bruta / abuso de API                                            | `@nestjs/throttler` com limites globais e um limite mais restrito específico para login                                                                           |
| Exfiltração de dados não detectada                                    | Toda leitura/escrita/exportação de dados sensíveis gera registro em `audit_logs` (interceptor central, não opcional)                                              |
| Retenção indefinida de dados pessoais                                 | Job agendado de anonimização (`RetencaoService`) após o prazo configurável `DATA_RETENTION_DAYS`                                                                  |
| Vazamento de segredos no repositório                                  | `.gitignore` cobre `.env`; `gitleaks` no pipeline de CI varre o histórico em cada push/PR                                                                         |
| Vulnerabilidades em dependências/imagens                              | `npm audit` (gate em vulnerabilidades críticas de produção) e Trivy (varredura de imagens) no pipeline de CI                                                      |
| Vulnerabilidades introduzidas no próprio código                       | CodeQL (SAST) analisando cada push/PR e semanalmente                                                                                                              |

## 3. Controles implementados — detalhamento

### 3.1. Autenticação e gestão de sessão

- **Senhas**: hash com `argon2id` (parâmetros recomendados pela OWASP), nunca
  reversível e resistente a ataques de hardware especializado.
- **Tokens JWT em par**: token de acesso de curta duração (padrão 15 minutos) +
  refresh token de duração maior (padrão 7 dias), reduzindo a janela de uso indevido
  de um token de acesso comprometido sem forçar reautenticações constantes.
- **Revogação via `versaoSessao`**: um contador incrementado em `Usuario` a cada troca
  de senha ou logout global. Refresh tokens emitidos com uma versão antiga são
  rejeitados — revogação imediata, em massa, sem necessidade de uma tabela de
  blocklist (que cresceria indefinidamente e exigiria limpeza própria).
- **Armazenamento da sessão no frontend**: `sessionStorage` (não `localStorage`) —
  a sessão não sobrevive ao fechamento da aba, reduzindo a janela de exposição em
  cenários de XSS persistente ou uso de máquinas compartilhadas.
- **CAPTCHA anti-bot (Cloudflare Turnstile)**: o formulário de login exige a
  conclusão de um desafio Turnstile antes do envio. O token emitido pelo widget
  é validado **no backend**, junto à API `siteverify` da Cloudflare, _antes_ de
  qualquer consulta às credenciais informadas — uma falha na verificação rejeita
  a requisição com uma mensagem própria (`"Verificação de segurança falhou..."`),
  distinta da mensagem genérica de credenciais inválidas, sem revelar nada sobre
  a existência da conta. Mitiga automação de força bruta, _credential stuffing_
  e scraping do formulário de autenticação. Como em qualquer controle desse
  tipo, a validação no navegador é apenas uma camada de UX — só a confirmação
  no servidor tem valor de segurança.

### 3.2. Autorização (RBAC)

Três papéis (`ADMIN`, `GESTOR`, `TECNICO`) aplicados via decorator `@Roles(...)` e
guard dedicado, avaliados **no backend**, na camada de borda de cada rota — a interface
apenas reflete essas permissões para a experiência do usuário, nunca as substitui.
Técnicos, adicionalmente, só podem operar sobre seus próprios lançamentos — uma regra
de autorização em nível de **recurso**, não apenas de papel.

### 3.3. Cifragem de dados sensíveis (privacy by design)

`CryptoService` centraliza a cifragem com **AES-256-GCM** (cifra autenticada — detecta
adulteração, não apenas confidencialidade). Para campos que precisam de busca exata
(CPF), o serviço também gera um **hash determinístico** (SHA-256 com a chave de
cifragem como segredo adicional/"pepper"), permitindo localizar um registro pelo
documento informado sem armazenar o valor em texto claro nem decifrar toda a base para
comparar. A chave de cifragem (`DATA_ENCRYPTION_KEY`) vive **fora do banco de dados**,
em variável de ambiente — em produção, recomenda-se um gerenciador de segredos
dedicado (Vault, AWS Secrets Manager, Doppler etc.).

### 3.4. Auditoria (accountability)

Um interceptor central (`AuditService`/interceptor de auditoria) registra, para toda
operação relevante sobre dados sensíveis: **quem** (usuário), **o quê** (ação:
`CRIACAO`, `LEITURA`, `ATUALIZACAO`, `EXCLUSAO`, `EXPORTACAO`, `LOGIN`, `LOGIN_FALHO`,
`ANONIMIZACAO`), **quando**, **de onde** (IP, user agent) e, quando aplicável, os
valores antigos e novos (`dadosAntigos`/`dadosNovos`, em formato JSON). A tabela
`audit_logs` é **somente-inserção** — não há rotas de atualização ou exclusão desses
registros — funcionando como uma trilha imutável.

### 3.5. Minimização de dados

- DTOs de entrada e saída definem explicitamente quais campos trafegam — nenhum dado
  além do estritamente necessário é coletado ou devolvido.
- No cadastro de pacientes, CPF, data de nascimento e contato são **opcionais**: o
  sistema funciona plenamente sem eles, e cabe à equipe da clínica decidir, caso a
  caso, se há necessidade real de coletá-los. Quando informados, continuam sendo
  cifrados em repouso e elegíveis à anonimização (ver 3.3 e 3.6) como qualquer outro
  dado pessoal sensível.
- A serialização de resposta é controlada por papel: campos sensíveis decifrados são
  entregues apenas a quem tem permissão de visualizá-los.
- O script de seed não cria pacientes/técnicos fictícios com dados realistas — evita
  introduzir dados sensíveis sintéticos desnecessários mesmo em ambientes de teste.

### 3.6. Limitação de armazenamento e anonimização (retenção)

`RetencaoService` roda diariamente (03h, horário de baixa atividade) e identifica
pacientes **sem nenhum lançamento dentro do prazo configurável** (`DATA_RETENTION_DAYS`,
padrão 1825 dias / 5 anos). Esses registros são anonimizados de forma irreversível —
campos identificáveis substituídos por um marcador (`[ANONIMIZADO POR POLÍTICA DE
RETENÇÃO]`) e `anonimizadoEm` preenchido — preservando apenas o necessário para
estatísticas/contabilidade já vinculadas a lançamentos existentes. Cada execução gera
um registro `ANONIMIZACAO` em `audit_logs`, tornando o próprio processo automatizado
auditável.

> Combinado ao **soft delete** (`deletadoEm`), esse desenho atende ao "direito ao
> esquecimento" (LGPD) sem comprometer a integridade do histórico de auditoria — a
> remoção/anonimização é controlada, registrada e reversível apenas durante a janela
> de soft delete.

### 3.7. Proteções de borda (HTTP)

- **Helmet**: Content-Security-Policy restritiva (`default-src 'self'`,
  `object-src 'none'`, `frame-ancestors 'none'`), HSTS com `preload`, e demais
  cabeçalhos padrão de proteção contra sniffing/clickjacking/XSS refletido.
- **CORS**: lista explícita de origens permitidas (`CORS_ALLOWED_ORIGINS`); sem
  configuração, nenhuma origem é aceita (fail-closed).
- **Rate limiting** (`@nestjs/throttler`): limite geral configurável
  (`THROTTLE_TTL_SECONDS`/`THROTTLE_LIMIT`) e um limite mais restrito específico para
  tentativas de login (`THROTTLE_LOGIN_LIMIT`), mitigando força bruta de credenciais.
- **Validação global de entrada**: `whitelist: true` + `forbidNonWhitelisted: true`
  descartam qualquer campo não declarado no DTO — previne _mass assignment_ e reduz
  superfície de ataque de payloads malformados.

### 3.8. Logs sem dados pessoais

Logs estruturados (Pino) registram identificadores técnicos (IDs, ações, status, tempos
de resposta) — nunca nomes, documentos, contatos ou qualquer dado de saúde. Isso evita
que os próprios arquivos de log se tornem um vetor de vazamento, e simplifica sua
retenção/descarte (não carregam dado pessoal, então não herdam as obrigações da LGPD
sobre eles).

### 3.9. Infraestrutura

- Contêineres rodam como **usuário não root**, em imagens enxutas (`alpine`,
  `nginx-unprivileged`), reduzindo o impacto de uma eventual fuga de contêiner.
- O banco de dados fica em **rede interna isolada**, sem porta publicada no host em
  produção — apenas o backend o acessa.
- `.env`/segredos reais nunca são versionados (`.gitignore`); `.env.example` documenta
  as variáveis sem conter valores reais.

## 4. Pipeline de DevSecOps (verificação contínua)

Definido em [`.github/workflows/`](../.github/workflows/), executado a cada push/PR
(e semanalmente, para varreduras independentes de atividade no repositório):

| Verificação                                                           | Ferramenta                                        | Workflow          | Comportamento                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Lint, formatação, tipos                                               | ESLint, Prettier, `tsc`                           | `ci.yml`          | Bloqueia o merge em caso de falha                                                                               |
| Testes unitários + cobertura                                          | Jest (backend), Vitest (frontend)                 | `ci.yml`          | Bloqueia em caso de falha ou cobertura abaixo do limiar configurado                                             |
| Build de produção (app e imagens Docker)                              | `nest build`/`vite build`, Docker Buildx          | `ci.yml`          | Bloqueia em caso de falha de build                                                                              |
| Análise estática de código (SAST)                                     | CodeQL (`security-extended`)                      | `codeql.yml`      | Resultados publicados no GitHub Security; revisão humana de achados                                             |
| Varredura de segredos                                                 | gitleaks                                          | `security.yml`    | Bloqueia em caso de segredo detectado no diff                                                                   |
| Auditoria de dependências de produção                                 | `npm audit --omit=dev --audit-level=critical`     | `security.yml`    | **Bloqueia** em vulnerabilidade crítica em dependência de produção                                              |
| Relatório completo de dependências (incl. ferramentas de build/teste) | `npm audit`                                       | `security.yml`    | Informativo — não bloqueia; serve para triagem e planejamento de upgrades                                       |
| Varredura de imagens de contêiner                                     | Trivy                                             | `security.yml`    | Resultados publicados no GitHub Security (severidade alta/crítica, ignorando o que não tem correção disponível) |
| Checagens locais antes do commit                                      | ESLint (`--fix`) + Prettier via Husky/lint-staged | hook `pre-commit` | Impede que problemas óbvios cheguem ao repositório remoto                                                       |

### Por que `npm audit` tem dois níveis de rigor?

Vulnerabilidades em **dependências de produção** (o que de fato roda no servidor do
usuário) recebem um gate rígido: qualquer vulnerabilidade crítica bloqueia o pipeline.
Vulnerabilidades em **devDependencies** (ferramentas de build/teste — ex.: toolchain do
Nest CLI/Webpack, Vite/Vitest) são reportadas para triagem, mas não bloqueiam: corrigi-
las normalmente exige saltos de versão major (ex.: NestJS 10→11, Vite/Vitest 2→4) que
envolvem testes de regressão extensos e devem ser **planejados deliberadamente**, não
forçados por um gate de CI. Essa distinção evita tanto o risco real (vulnerabilidade em
produção) quanto o "alarme constante" que leva equipes a ignorar avisos de segurança.

## 5. Conformidade com a LGPD — mapeamento

| Princípio/obrigação (LGPD)                                  | Como o sistema atende                                                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalidade (art. 6º, I)                                     | Dados de pacientes coletados exclusivamente para o registro e gestão de exames — nenhuma coleta especulativa                                          |
| Necessidade/minimização (art. 6º, III)                      | DTOs explícitos; nenhum campo além do estritamente necessário é solicitado, armazenado ou retornado                                                   |
| Segurança (art. 6º, VII; art. 46)                           | Cifragem de campos sensíveis, controle de acesso por papel e recurso, proteções de borda HTTP, varreduras automatizadas de segurança                  |
| Prevenção (art. 6º, VIII)                                   | Pipeline de DevSecOps com SAST, varredura de dependências/segredos/imagens em todo push/PR                                                            |
| Não discriminação (art. 6º, IX)                             | Não aplicável ao escopo funcional (sistema não realiza decisões automatizadas sobre indivíduos)                                                       |
| Responsabilização e prestação de contas (art. 6º, X)        | Trilha de auditoria imutável (`audit_logs`), incluindo auditoria do próprio processo de anonimização                                                  |
| Limitação do tempo de armazenamento (art. 6º, VII; art. 16) | Rotina automatizada de anonimização após `DATA_RETENTION_DAYS`; soft delete preserva rastreabilidade durante a janela de retenção                     |
| Direito de eliminação/"esquecimento" (art. 18, VI)          | Combinação de soft delete + anonimização programada — a remoção lógica é imediata; a anonimização irreversível ocorre de forma controlada e auditável |

## 6. Limitações conhecidas e responsabilidades de operação

Este projeto entrega uma base sólida, mas a segurança de um sistema em produção também
depende de decisões e processos **fora do código**, que ficam sob responsabilidade de
quem o opera:

- **Gestão de segredos**: `.env` é adequado para desenvolvimento; em produção, prefira
  um gerenciador de segredos dedicado com rotação periódica.
- **TLS/HTTPS**: o `docker-compose.yml` deste repositório não inclui terminação TLS —
  em produção, posicione um proxy/balanceador com certificado válido (ex.: Traefik,
  Nginx com Let's Encrypt, ou um balanceador de nuvem) à frente do serviço `frontend`.
  Veja o passo a passo completo (Windows e Linux) em [CONFIGURACAO_HTTPS.md](CONFIGURACAO_HTTPS.md).
- **Backups**: defina e teste rotineiramente uma política de backup e restauração do
  PostgreSQL — o sistema não a implementa.
- **Resposta a incidentes**: defina um processo formal de resposta a incidentes que
  envolvam dados pessoais, incluindo prazos de notificação à ANPD/titulares quando
  aplicável (art. 48 da LGPD).
- **Revisão periódica de papéis e acessos**: audite regularmente quais contas têm
  papel `ADMIN`/`GESTOR` e desative contas de pessoas que deixaram a organização.
