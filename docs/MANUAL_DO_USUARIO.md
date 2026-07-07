# Manual do Usuário

## 1. Acesso ao sistema

Acesse o endereço informado pelo administrador (por padrão, `http://localhost:8089`) e
informe e-mail e senha na tela de login.

- A sessão é mantida **apenas durante a aba aberta** (não sobrevive ao fechamento do
  navegador) — uma medida de proteção: se você usa um computador compartilhado, feche a
  aba ao terminar.
- Em caso de falha de autenticação, a mensagem exibida é genérica
  ("Credenciais inválidas") — por segurança, o sistema não informa se o problema foi o
  e-mail ou a senha.
- Se você esqueceu a senha, contate um administrador para redefini-la.

### Trocar a senha

No menu do usuário (canto superior direito), selecione **Alterar senha**, informe a
senha atual e a nova senha (mínimo de 8 caracteres). Após a troca, todas as suas demais
sessões ativas são automaticamente encerradas — você precisará entrar novamente nos
outros dispositivos.

### Sair de todos os dispositivos

A opção **Sair de todos os dispositivos** (logout global) invalida imediatamente todas
as sessões abertas com sua conta — útil se você suspeitar que sua senha foi
comprometida ou esqueceu uma sessão aberta em outro computador.

## 2. Papéis e permissões

O sistema possui três papéis. Suas opções de menu e ações disponíveis variam de acordo
com o papel atribuído à sua conta:

| Papel       | O que pode fazer                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **ADMIN**   | Tudo que `GESTOR` pode, além de gerenciar usuários do sistema e os catálogos (técnicos, pacientes, exames) — criação, edição e remoção |
| **GESTOR**  | Consultar e filtrar lançamentos, visualizar relatórios/resumos e exportar resultados em CSV                                            |
| **TECNICO** | Registrar e editar seus próprios lançamentos de exames                                                                                 |

Se uma opção de menu ou botão não aparece para você, é porque seu papel não tem
permissão para aquela ação — não se trata de um erro do sistema.

## 3. Painel inicial

Ao entrar, você vê um resumo com:

- **Mês atual**: total de registros, quantidade de exames e faturamento do mês corrente.
- **Histórico geral**: os mesmos indicadores acumulados desde o início da operação.

Esses números refletem apenas os lançamentos aos quais você tem permissão de visualizar.

## 4. Cadastros (Técnicos, Pacientes, Exames)

Disponível para `ADMIN` (e consulta para `GESTOR`, conforme configurado). Cada tela de
cadastro permite:

- **Listar** registros ativos, com paginação.
- **Buscar** por nome.
- **Criar** um novo registro, preenchendo os campos obrigatórios do formulário.
- **Editar** um registro existente.
- **Remover** um registro — a remoção é lógica (o registro deixa de aparecer nas
  listagens e seleções, mas seu histórico de lançamentos é preservado para fins de
  auditoria e conformidade).

> **Atenção ao cadastrar pacientes**: documento (CPF) e contato são informações
> sensíveis. O sistema os armazena de forma cifrada — mesmo assim, informe apenas o
> necessário e nunca compartilhe essas telas com pessoas não autorizadas.

## 5. Lançamentos — registro e consulta

A tela de **Lançamentos** é o núcleo funcional do sistema.

### 5.1. Registrar um lançamento

Clique em **Novo lançamento** e preencha:

| Campo       | Descrição                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------- |
| Técnico     | Quem realizou o exame                                                                         |
| Paciente    | Em quem o exame foi realizado (busca por nome — digite ao menos 2 letras)                     |
| Exame       | Qual exame foi realizado (o valor padrão do catálogo é sugerido automaticamente)              |
| Data        | Data em que o exame foi realizado                                                             |
| Quantidade  | Número de procedimentos realizados nesse lançamento                                           |
| Valor       | Valor cobrado/atribuído ao lançamento (pode ser ajustado em relação ao valor padrão do exame) |
| Observações | Campo livre opcional                                                                          |

Técnicos só conseguem criar/editar lançamentos vinculados à sua própria conta de
técnico — o sistema impõe essa regra mesmo que o campo apareça editável na interface.

### 5.2. Consultar com filtros

A barra de filtros no topo da lista permite combinar, simultaneamente:

- **Exame** — selecione um item do catálogo.
- **Técnico** — selecione um técnico cadastrado.
- **Paciente** — digite ao menos duas letras do nome para buscar e selecionar.
- **Período (data do exame)** — escolha um intervalo de datas; para um único dia,
  selecione a mesma data como início e fim.

Os filtros podem ser usados isoladamente ou em conjunto (ex.: "todos os exames do tipo
Hemograma feitos pela técnica Ana em março"). Use **Limpar filtros** para recomeçar a
busca do zero. A lista é paginada e ordenável (por data, data de criação ou valor).

### 5.3. Exportar resultados em CSV

Disponível para `ADMIN` e `GESTOR`. Clique em **Exportar CSV** para baixar, em formato
de planilha, exatamente os lançamentos que correspondem aos filtros aplicados no
momento — útil para relatórios externos, conferências e prestação de contas.

> Toda exportação gera automaticamente um registro na trilha de auditoria, identificando
> quem exportou, quando e com quais filtros — o sistema rastreia a saída de dados da
> mesma forma que rastreia o acesso a eles.

## 6. Boas práticas de uso

- Não compartilhe sua conta nem sua senha — a trilha de auditoria identifica ações por
  usuário individual, e contas compartilhadas comprometem essa rastreabilidade.
- Prefira sempre os filtros de consulta a navegar página por página por toda a base —
  além de mais rápido, reduz a quantidade de dados sensíveis exibidos na tela.
- Ao encerrar o uso em um computador compartilhado, feche a aba do navegador — a sessão
  não persiste além disso.
- Em caso de dúvida sobre uma permissão ou comportamento que pareça incorreto, contate
  um administrador antes de tentar contornar o sistema.
