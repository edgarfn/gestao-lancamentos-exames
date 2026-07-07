# Configuração de HTTPS

Guia para colocar o sistema em produção servindo **HTTPS** com um certificado TLS
válido (Let's Encrypt), cobrindo as orientações específicas para **Windows** e
**Linux**. É um companheiro do [INSTALACAO.md](INSTALACAO.md): use aquele guia para
subir o sistema e este para prepará-lo para receber tráfego real da Internet com
segurança.

## 1. Por que isso não vem pronto / quando você precisa disso

O `docker-compose.yml` deste repositório publica o `frontend` apenas em **HTTP**
(porta 8089) — não há nenhuma terminação TLS configurada por padrão. Isso é
proposital: a forma de terminar TLS (qual domínio, qual certificado, qual proxy)
é uma decisão do ambiente de produção, não do código da aplicação. Esse ponto já
é sinalizado como responsabilidade do operador em
[SEGURANCA_E_PRIVACIDADE.md](SEGURANCA_E_PRIVACIDADE.md) — este guia é o "como fazer"
completo para fechar essa lacuna.

**Você precisa deste guia se** vai expor o sistema a usuários reais pela Internet —
o que, dado que o sistema lida com **dados de saúde de pacientes** (categoria de
dado sensível pela LGPD), é praticamente obrigatório: navegadores modernos alertam
e podem bloquear recursos sensíveis (formulários de login, cookies de sessão) em
páginas servidas por HTTP simples, e o tráfego sem TLS pode ser interceptado em
trânsito.

> Se você só está rodando o sistema localmente para desenvolvimento/testes em
> `http://localhost:8089`, **não precisa** seguir este guia — pule para a seção
> 5 apenas se quiser testar HTTPS localmente antes de ir para produção.

## 2. Pré-requisitos (comuns a Windows e Linux)

### 2.1. Domínio próprio e DNS

Você precisa de um **domínio público** (ex.: `exames.suaempresa.com.br`) com um
registro DNS do tipo **A** (IPv4) ou **AAAA** (IPv6) apontando para o **IP público**
do servidor onde os contêineres vão rodar. Sem isso, o Let's Encrypt não consegue
validar que você controla o domínio e **não emite o certificado**.

- Confirme a propagação do DNS antes de prosseguir:
  - Linux/macOS/Git Bash: `dig +short exames.suaempresa.com.br` ou `nslookup exames.suaempresa.com.br`
  - Windows (PowerShell): `Resolve-DnsName exames.suaempresa.com.br`
- A propagação pode levar de minutos a algumas horas, dependendo do provedor de DNS.

### 2.2. Acesso de rede — portas 80 e 443

O processo de emissão/renovação de certificado do Let's Encrypt usa a **porta 80**
(validação HTTP-01) e o tráfego HTTPS final usa a **porta 443**. Ambas precisam
estar acessíveis a partir da Internet, no firewall do host **e** em qualquer
firewall de borda (roteador, security group de nuvem, etc.).

**Linux** (exemplo com `ufw`, comum em Debian/Ubuntu):

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

Em distribuições baseadas em RHEL/Fedora com `firewalld`:

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

**Windows** (PowerShell, como Administrador):

```powershell
New-NetFirewallRule -DisplayName "HTTP (80)"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "HTTPS (443)" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

Ou pelo painel gráfico: **Painel de Controle → Sistema e Segurança → Windows
Defender Firewall → Configurações avançadas → Regras de Entrada → Nova Regra...**

> Se o servidor estiver atrás de um roteador/NAT ou de um balanceador de nuvem
> (AWS, Azure, GCP), também é preciso liberar/encaminhar as portas 80 e 443 nessa
> camada — o firewall do sistema operacional sozinho não basta.

### 2.3. Software

O pré-requisito de Docker já é o mesmo do [INSTALACAO.md](INSTALACAO.md#pré-requisitos)
(Docker Engine + Docker Compose v2). As únicas diferenças relevantes para HTTPS:

- **Linux**: Docker Engine nativo — os comandos abaixo podem ser executados
  diretamente no terminal (bash/zsh).
- **Windows**: recomenda-se **Docker Desktop com o backend WSL2**. Os comandos
  `docker compose` funcionam de forma idêntica no PowerShell; ferramentas auxiliares
  como `openssl`, `dig` e `curl -v` com saída completa de TLS estão disponíveis
  nativamente no **Git Bash** (instalado junto com o Git para Windows) ou no **WSL2**
  — recomendamos usar um desses para os comandos de verificação da seção 6.

## 3. Escolhendo a abordagem de TLS

Existem três caminhos comuns para terminar TLS na frente deste sistema:

| Critério                                   | **Caddy** (recomendado)                       | Nginx + Certbot                                                                   | Traefik                                                                          |
| ------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Mudanças no `docker-compose.yml` existente | Mínimas — só adiciona 1 serviço               | Médias — exige volumes compartilhados entre nginx e certbot, webroot de validação | Médias/altas — exige labels Docker em cada serviço, reconfiguração de roteamento |
| Emissão e renovação do certificado         | 100% automáticas                              | Manuais na primeira vez; renovação via cron/Agendador de Tarefas                  | Automáticas, mas com configuração mais elaborada (`certresolver`)                |
| Tamanho da configuração                    | ~10 linhas (`Caddyfile`)                      | `nginx.conf` com diretivas `ssl_*` + configuração do certbot + agendamento        | `traefik.yml` + labels em cada serviço                                           |
| Pontos de falha (_moving parts_)           | Baixo — um único processo cuida de tudo       | Alto — nginx + certbot + agendador + _reload_ coordenado                          | Médio/alto — mais conceitos novos (providers, _certresolvers_, _dashboard_)      |
| Reaproveita o `frontend/nginx.conf` atual  | Sim — fica intacto, Caddy só repassa para ele | Precisaria reescrever para terminar TLS ali                                       | Sim — fica intacto                                                               |

**Recomendação: Caddy**, como um serviço adicional rodando _na frente_ do
`frontend` existente, configurado por um overlay Docker Compose **aditivo**
(`docker-compose.https.yml`). Motivos:

1. **Menor mudança no que já funciona**: `frontend/nginx.conf` e `frontend/Dockerfile`
   permanecem exatamente como estão — o nginx do frontend continua resolvendo
   `/api/` para o backend, só que agora atrás do Caddy.
2. **Renovação sem agendamento manual**: o ponto mais doloroso de documentar de
   forma multiplataforma é "como agendar a renovação" (Linux usa cron/systemd
   timers, Windows usa o Agendador de Tarefas — e cada um precisa de testes
   próprios). Com o Caddy, essa seção inteira deixa de existir: ele renova
   sozinho e reinicia o _listener_ TLS automaticamente.
3. **Configuração mínima**: o `Caddyfile` (já incluído neste repositório em
   [`deploy/caddy/Caddyfile`](../deploy/caddy/Caddyfile)) tem ~10 linhas — domínio,
   e-mail para o Let's Encrypt e o destino do proxy reverso.
4. **Aditivo**: por ser um _overlay_ (`-f docker-compose.yml -f docker-compose.https.yml`),
   o fluxo padrão `docker compose up -d --build` do [INSTALACAO.md](INSTALACAO.md)
   continua funcionando sem alterações para quem só precisa rodar localmente —
   o mesmo padrão já usado pelo `docker-compose.dev.yml`.

## 4. Passo a passo — produção com domínio público (Caddy + Let's Encrypt)

### 4.1. Visão geral da arquitetura com HTTPS

```
Internet  ──(443/HTTPS, 80/HTTP→redirect)──▶  caddy  ──(8080, interno)──▶  frontend (nginx)  ──▶  backend
                                          (emite/renova certificado
                                           automaticamente via Let's Encrypt)
```

O Caddy passa a ser o único serviço com portas publicadas no host (80 e 443). O
`frontend` deixa de publicar a porta 8089 diretamente — ele só é alcançado pelo
Caddy, dentro da rede interna `rede-interna` do compose. O `backend` e o
`postgres` continuam internos, exatamente como hoje.

### 4.2. Variáveis de ambiente novas/alteradas

Edite o seu arquivo `.env` (criado a partir de `.env.example` conforme
[INSTALACAO.md §1.1](INSTALACAO.md#11-clonar-o-repositório-e-configurar-variáveis-de-ambiente)):

| Variável               | Antes (HTTP local)      | Depois (produção HTTPS)            | Observação                                                                              |
| ---------------------- | ----------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| `DOMAIN`               | _(não existe)_          | `exames.suaempresa.com.br`         | Novo — usado pelo Caddy para emitir o certificado                                       |
| `ACME_EMAIL`           | _(não existe)_          | `admin@suaempresa.com.br`          | Novo — e-mail de contato exigido pelo Let's Encrypt                                     |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:8089` | `https://exames.suaempresa.com.br` | **Obrigatório alterar** — veja nota abaixo                                              |
| `VITE_API_BASE_URL`    | `/api/v1`               | `/api/v1`                          | **Sem alteração** — é um caminho relativo, continua funcionando atrás de qualquer proxy |
| `FRONTEND_PORT`        | `8089`                  | _(ignorado pelo overlay HTTPS)_    | O overlay remove a publicação direta da porta do frontend; o Caddy assume 80/443        |

> **Por que `CORS_ALLOWED_ORIGINS` precisa mudar:** o backend valida a origem das
> requisições contra essa lista (veja `backend/src/main.ts`). Se ela continuar
> apontando para `http://localhost:8089` enquanto o navegador acessa
> `https://exames.suaempresa.com.br`, as chamadas à API serão **bloqueadas por
> CORS**. Após editar o `.env`, é preciso recriar o backend para que ele leia o
> novo valor — veja o passo 4.4.

### 4.3. Criar/ajustar o `Caddyfile`

O arquivo já vem pronto em [`deploy/caddy/Caddyfile`](../deploy/caddy/Caddyfile):

```caddyfile
{$DOMAIN} {
	tls {$ACME_EMAIL}

	encode gzip

	reverse_proxy frontend:8080 {
		header_up X-Forwarded-Proto {scheme}
	}
}
```

O que cada diretiva faz:

- `{$DOMAIN}` — o domínio em que o Caddy vai responder (lido da variável de
  ambiente `DOMAIN`); o Caddy também já redireciona automaticamente todo o
  tráfego HTTP (porta 80) para HTTPS (porta 443) para esse domínio.
- `tls {$ACME_EMAIL}` — habilita TLS automático via Let's Encrypt, usando o
  e-mail informado para avisos sobre expiração/problemas no certificado.
- `encode gzip` — compressão de respostas (mesma finalidade de otimizações já
  presentes no `frontend/nginx.conf`).
- `reverse_proxy frontend:8080` — encaminha todo o tráfego para o serviço
  `frontend` (resolvido pelo DNS interno do Docker), preservando o cabeçalho
  `X-Forwarded-Proto` que o `frontend/nginx.conf` já espera repassar ao backend.

Se o seu domínio/e-mail não vierem do `.env` por algum motivo, você pode
substituir `{$DOMAIN}` e `{$ACME_EMAIL}` diretamente pelos valores reais — mas
prefira as variáveis de ambiente, que evitam _commitar_ esses dados no repositório.

### 4.4. Subir com o overlay HTTPS

Com o `.env` atualizado (passo 4.2), suba (ou recrie) os contêineres incluindo o
overlay `docker-compose.https.yml`:

```bash
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Esse comando é **idêntico no Windows (PowerShell) e no Linux** — é uma das
vantagens de usar Docker Compose. As únicas diferenças cross-platform nesta etapa
são as ferramentas auxiliares usadas para gerar segredos/strings aleatórias, caso
você ainda não tenha preenchido o `.env`:

- **Linux/macOS**: `openssl rand -base64 48` (disponível nativamente)
- **Windows**: use o **Git Bash** (vem com o Git para Windows) ou o **WSL2** para
  rodar o mesmo comando `openssl`; alternativamente, no PowerShell:
  `[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))`

> **Importante**: se os contêineres já estavam rodando com o compose básico
> (sem o overlay), este mesmo comando os recria já incluindo o serviço `caddy`
> e aplicando as variáveis novas — não é necessário rodar `docker compose down`
> antes (isso descartaria o volume de certificados em emissões futuras).

### 4.5. Primeira emissão do certificado

Acompanhe os logs do Caddy para ver a emissão do certificado acontecendo:

```bash
docker compose -f docker-compose.yml -f docker-compose.https.yml logs -f caddy
```

O que esperar:

- Mensagens indicando contato com a API do Let's Encrypt, validação do domínio
  (desafio HTTP-01 na porta 80) e, em seguida, "certificate obtained successfully"
  (ou equivalente). Isso costuma levar de **alguns segundos a poucos minutos**.
- Assim que o certificado é emitido, o Caddy começa a responder em
  `https://exames.suaempresa.com.br` automaticamente — não é preciso reiniciar
  nada manualmente.

Se a emissão falhar, as causas mais comuns são:

- **DNS ainda não propagado** — confirme com `dig`/`Resolve-DnsName` (seção 2.1)
  que o domínio já resolve para o IP correto antes de tentar novamente.
- **Porta 80 bloqueada/não encaminhada** — o desafio HTTP-01 do Let's Encrypt
  precisa alcançar o Caddy pela porta 80; revise o firewall (seção 2.2) e
  qualquer NAT/balanceador na frente do servidor.
- **Limite de tentativas (_rate limit_) do Let's Encrypt** — após várias
  tentativas falhas para o mesmo domínio em pouco tempo, o Let's Encrypt passa a
  recusar novos pedidos por um período. Corrija a causa raiz (DNS/porta) e
  aguarde antes de tentar novamente; veja a seção 8 para testar com o ambiente
  de homologação (_staging_), que não tem esse limite.

## 5. Cenário secundário — desenvolvimento/teste local com certificado autoassinado

Se você quiser testar como o sistema se comporta em HTTPS **antes** de ter um
domínio público (por exemplo, em uma máquina de desenvolvimento), use um
certificado autoassinado/local com a ferramenta [`mkcert`](https://github.com/FiloSottile/mkcert):

- **Linux** (Debian/Ubuntu): `sudo apt install mkcert && mkcert -install`
- **Windows**: `choco install mkcert` (Chocolatey) ou `scoop install mkcert`, depois `mkcert -install`

Gere um certificado para `localhost` e configure manualmente seu proxy local para
usá-lo (fora do escopo deste overlay, que é voltado a produção com Let's Encrypt).
O navegador confiará no certificado **somente na máquina onde você rodou
`mkcert -install`**.

> **Atenção**: certificados autoassinados/locais **nunca devem ir para produção**
> — outros navegadores/usuários vão exibir alertas de "conexão não seguro" e a
> conexão não estará realmente protegida por uma autoridade confiável.

## 6. Verificação — confirmando que está tudo funcionando

Depois de subir o overlay e o certificado ser emitido (seção 4.5), confira cada
item abaixo (substitua `exames.suaempresa.com.br` pelo seu domínio real):

1. **Handshake TLS e certificado válido**

   ```bash
   curl -vI https://exames.suaempresa.com.br
   ```

   Espera-se `HTTP/2 200` (ou similar) e o bloco do _handshake_ TLS sem erros de
   certificado.

2. **Emissor e validade do certificado**

   ```bash
   openssl s_client -connect exames.suaempresa.com.br:443 -servername exames.suaempresa.com.br </dev/null 2>/dev/null \
     | openssl x509 -noout -issuer -dates
   ```

   Deve mostrar o emissor como **Let's Encrypt** (geralmente "R3" ou "E1") e as
   datas de validade (emitido recentemente, expira em ~90 dias).
   - **Windows**: rode o mesmo comando via **Git Bash** ou **WSL2** (o OpenSSL não
     vem por padrão no PowerShell).

3. **Cadeado no navegador**: abra `https://exames.suaempresa.com.br`, clique no
   ícone de cadeado na barra de endereço e confirme que o certificado é válido e
   emitido por "Let's Encrypt".

4. **Redirecionamento HTTP → HTTPS**

   ```bash
   curl -vI http://exames.suaempresa.com.br
   ```

   Espera-se um redirecionamento `301`/`308` para `https://...` — comportamento
   automático do Caddy, sem necessidade de configuração extra.

5. **CORS funcionando após a troca de origem**
   - Confirme que `CORS_ALLOWED_ORIGINS` no `.env` foi alterado para
     `https://exames.suaempresa.com.br` **e** que o backend foi recriado para ler
     o novo valor:
     ```bash
     docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build backend
     ```
   - Teste diretamente com `curl`:
     ```bash
     curl -H "Origin: https://exames.suaempresa.com.br" -I https://exames.suaempresa.com.br/api/v1/health
     ```
     A resposta deve incluir o cabeçalho `Access-Control-Allow-Origin:
https://exames.suaempresa.com.br`.
   - Por fim, faça login pela interface no navegador e confira no DevTools
     (aba _Network_/_Console_) que não há erros de CORS nem avisos de
     "_mixed content_" (recursos carregados via `http://` em uma página `https://`).

6. **Logs e estado dos serviços**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.https.yml ps
   docker compose -f docker-compose.yml -f docker-compose.https.yml logs caddy | grep -i certificate
   ```
   Todos os serviços (incluindo `caddy`) devem aparecer saudáveis/em execução, e
   os logs do Caddy devem indicar que o certificado foi obtido e está sendo
   monitorado para renovação.

## 7. Renovação e manutenção

### 7.1. Renovação automática

O Caddy renova o certificado **automaticamente**, tipicamente cerca de 30 dias
antes do vencimento — não é necessário configurar cron, systemd timers nem o
Agendador de Tarefas do Windows. Para confirmar que a renovação está agendada,
use o mesmo comando de logs do item 6 acima; o Caddy registra quando verifica e
renova certificados.

### 7.2. Verificando a validade do certificado periodicamente

Repita o comando do item 2 da seção 6 (`openssl x509 -noout -dates`) sempre que
quiser confirmar a data de expiração atual — útil para auditorias periódicas de
segurança.

### 7.3. Backup do volume de certificados

Os certificados ficam no volume Docker nomeado `caddy_data` (declarado no
`docker-compose.https.yml`). Faça backup dele periodicamente — isso evita ter
que reemitir certificados (o que poderia esbarrar em limites do Let's Encrypt)
caso o servidor precise ser reconstruído:

```bash
docker run --rm -v exames-sistema_caddy_data:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/caddy_data_backup.tar.gz -C /data .
```

> O nome exato do volume pode variar conforme o nome do projeto Compose; confirme
> com `docker volume ls`.

## 8. Solução de problemas comuns

| Sintoma                                                           | Causa provável                                                                                                  | O que fazer                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Certificado não é emitido / Caddy fica reiniciando                | DNS não propagado, porta 80 bloqueada, ou _rate limit_ do Let's Encrypt                                         | Revise as seções 2.1/2.2; para testar sem esbarrar no limite, configure temporariamente o ambiente de homologação (_staging_) do Let's Encrypt no `Caddyfile` (`acme_ca https://acme-staging-v02.api.letsencrypt.org/directory` dentro do bloco `tls`) — o certificado de teste não será confiável no navegador, mas confirma que o fluxo de emissão funciona |
| Aviso de "conteúdo misto" (_mixed content_) no navegador          | Algum recurso (script, imagem, chamada de API) ainda referenciando `http://` explicitamente                     | Confirme que `VITE_API_BASE_URL` continua relativo (`/api/v1`, sem esquema/host fixo) e que não há URLs absolutas `http://` _hardcoded_ no frontend                                                                                                                                                                                                           |
| Chamadas à API falham com erro de CORS após mudar para HTTPS      | `CORS_ALLOWED_ORIGINS` ainda aponta para `http://localhost:8089` ou o backend não foi recriado                  | Atualize a variável no `.env` para `https://SEU_DOMINIO` e recrie o backend (`docker compose ... up -d --build backend`)                                                                                                                                                                                                                                      |
| Loop de redirecionamento (`ERR_TOO_MANY_REDIRECTS`)               | Cabeçalho `X-Forwarded-Proto` não chega corretamente ao backend, fazendo-o pensar que a requisição ainda é HTTP | Confirme que o `Caddyfile` mantém `header_up X-Forwarded-Proto {scheme}` e que o `frontend/nginx.conf` continua repassando `proxy_set_header X-Forwarded-Proto $scheme;` (já vem assim por padrão)                                                                                                                                                            |
| Navegador continua resolvendo o domínio para o IP/conteúdo antigo | Cache de DNS local desatualizado                                                                                | **Linux**: `sudo systemd-resolve --flush-caches` (ou `sudo resolvectl flush-caches`); **Windows**: `ipconfig /flushdns` no PowerShell/`cmd`; também verifique se não há entradas residuais em `/etc/hosts` (Linux) ou `C:\Windows\System32\drivers\etc\hosts` (Windows)                                                                                       |

## 9. Referências

- [INSTALACAO.md](INSTALACAO.md) — guia de instalação básica (HTTP local), pré-requisitos de Docker
- [SEGURANCA_E_PRIVACIDADE.md](SEGURANCA_E_PRIVACIDADE.md) — modelo de ameaças e controles de segurança/privacidade do sistema
- [Documentação oficial do Caddy](https://caddyserver.com/docs/) — referência completa do `Caddyfile` e do TLS automático
- [Documentação do Let's Encrypt](https://letsencrypt.org/docs/) — como funciona a emissão de certificados via ACME, limites de uso (_rate limits_) e ambiente de homologação
