# 04 — Decisões

Registro das decisões de negócio e arquitetura que precedem os contratos. Cada decisão fechada
vira premissa de contrato; cada pergunta aberta bloqueia o contrato da área correspondente.

O histórico das opções consideradas e do custo de cada uma está no git log deste arquivo.

---

## Decisões fechadas — 08/set/2026

### Escopo e processo

| # | Decisão | Consequência |
|---|---|---|
| **D9** | **Híbrido por área.** AS-IS onde já funciona (CRUD do lojista, produtos, importação, admin); TO-BE onde está quebrado (motor de pontos, expiração, resgate, área do cliente, segurança). | Todo contrato declara no cabeçalho se é AS-IS ou TO-BE, para o Sonnet saber se descreve ou corrige. |
| **D13** | **Contratos em Zod** em `src/contracts/` como fonte de request/response; `supabase gen types` para o shape das tabelas (gerado, nunca escrito à mão); um `docs/contratos/*.md` por domínio, em português, com regra e invariante. | É o `.md` que o Sonnet lê para implementar e contra o qual o Opus revisa. O Zod é o que o runtime cobra. |
| **D14** | **Correções de segurança saem na frente**, em migration própria, antes de qualquer contrato. | Revogar `GRANT ... TO anon` de tudo que muta e dropar as 6 policies `USING (true)`. Atenção: `lojistas` só tem essa policy — precisa de uma nova no lugar. |

### Modelo de domínio

| # | Decisão | Consequência |
|---|---|---|
| **D3** | **Cliente é uma identidade global** da plataforma, participando de N programas. | `clientes.lojista_id` sai; o vínculo passa a ser `clientes_fidelidade`. |
| **D3.1** | **Isolamento total entre lojistas.** A Loja A não sabe quem são os clientes da Loja B. O cadastro global existe **só** para o sistema garantir que a mesma pessoa não tenha dois logins. | Os dados cadastrais (nome, telefone, e-mail) passam a ser por lojista; a identidade global guarda apenas documento e usuário de autenticação. Isso divide a tabela `clientes` em duas — ver **R3**. |
| **D5** | **O cálculo de pontos mora só no Postgres.** O TypeScript grava os itens e lê de volta o que o banco calculou. | `buildCompraItens` para de calcular pontos; `compra_itens.percentual_aplicado` e `pontos_gerados` passam a ser preenchidos pelo banco. |
| **D6** | ~~Mais de um programa ativo é permitido~~ → **REVOGADA por R4 em 08/set:** multi-programa está fora de escopo. Volta a valer **um único programa ativo por lojista**. | `fn_programa_ativo` com `limit 1` deixa de ser ambiguidade. Falta decidir se vale travar por constraint — ver **N3**. |
| **D10** | **A área do cliente entra nesta rodada de contratos**, mesmo que a implementação venha depois. | Contratos de saldo, extrato e resgate servem aos dois públicos desde já. |

### Fluxo de compra

| # | Decisão | Consequência |
|---|---|---|
| **D11** | **Compra lançada pelo cliente é requisito vivo.** O cliente lança a própria compra e o lojista aprova; compra lançada pela loja já nasce aprovada. | `origem_compra` e o ramo "lote pendente" do motor deixam de ser código morto e viram caminho principal. Exige tela de aprovação no lojista e de lançamento no cliente. Com quais itens o cliente lança está em **R1**. |
| **D12** | **Compra retroativa é permitida**, para o lojista importar histórico anterior ao uso do sistema ("quantos pontos meu cliente teria se já usasse isso há um ano"). | O motor precisa pontuar coerentemente fora de ordem cronológica. Validade e evolução de nível em **R2**. |
| **D1** | **A pontuação passa a entrar só por RPC.** O trigger `trg_compras_processar` é dropado. | Acaba o lote-lixo de 0 pontos ([S3](03-defeitos-e-riscos.md)). `INSERT` manual em `compras` pelo Studio deixa de pontuar — aceitável, já que a decisão é parar de mexer no banco à mão. |
| **D5.1** | **`floor` continua por item**, não sobre o total da compra. Motivo: cada item pode ser bonificado com percentual diferente. | Ver a ressalva em **R6**: a granularidade do arredondamento é independente da granularidade do percentual. |
| **Q1** | **A prévia de pontos na tela de vendas vira `fn_simular_pontos(itens jsonb)`** no banco. | Preserva a UX sem reabrir a divergência entre duas fórmulas ([S6](03-defeitos-e-riscos.md)). |

### Saldo, validade e resgate

| # | Decisão | Consequência |
|---|---|---|
| **D2** | **`dias_expiracao_pontos` e `dias_para_perder_streak` são a fonte única.** `validade_dias` é dropada com backfill; o `interval '30 days'` fixo em `fn_rebuild_cliente_fidelidade` passa a ler o campo. Expiração agendada por `pg_cron` diário, com a rota HTTP como gatilho manual de suporte. | Resolve [S5](03-defeitos-e-riscos.md). |
| **D4** | **Os tipos de saldo são separados**: "a liberar" (compra ainda não aprovada) e "reservado" (resgate pendente). | Resolve [S8](03-defeitos-e-riscos.md). Com D11, "a liberar" deixa de ser hipótese e vira o caso comum. |
| **D8** | **Saldo negativo é abatido pelos pontos das compras seguintes.** | Deixa de ser só um indicador: `fn_processar_compra` passa a quitar dívida antes de creditar. Fonte da verdade do negativo passa a ser o livro-razão `pontos_movimentacoes`, e `ajustes_pontos` é dropada. Exibição e limite do abatimento em **R5**. |
| **D7** | **Resgate: hoje o lojista faz; o alvo é o cliente solicitar e o lojista aprovar ou recusar.** | Mesma forma de `compras`: origem + status. O prêmio é validado no servidor (`ativo`, `nivel_minimo_id`) e `pontos_solicitados` é derivado de `premios.pontos_necessarios`, nunca aceito do cliente. |
| **Q3** | **O acesso do cliente é liberado pelo lojista.** O cliente precisa estar cadastrado em ao menos uma loja para ter login; comprando em outra loja, essa loja é acrescentada ao cadastro global existente. | Sem auto-cadastro nesta rodada. |

---

# Perguntas abertas

## R1 🔴 A compra lançada pelo cliente tem itens?

O motor pontua **por item**, com teto por produto, e cada item aponta para um `produtos.id` do
lojista. Se o cliente lança a compra, de onde vêm os itens?

- **(a) Cliente escolhe do catálogo do lojista.** Exige expor a lista de produtos ao cliente, o
  que revela descrições e, se não for filtrado, os tetos de bonificação.
- **(b) Cliente lança só o valor total** e o lojista completa os itens ao aprovar. Simples para
  o cliente, mas até a aprovação não há como calcular pontos nem mostrar prévia — o lote
  pendente nasceria com 0.
- **(c) Cliente anexa a nota ou o cupom** e informa o total; o lojista confere e lança os itens.
- **(d) Compra sem itens pontua pelo total**, com um percentual padrão do nível; itens viram
  opcionais e servem só para refinar a bonificação.

É a lacuna que mais bloqueia contrato: sem ela não dá para escrever nem o contrato de compra,
nem o de aprovação, nem o do lote pendente.

## R2 🔴 Compra retroativa: validade e nível

Duas subquestões independentes.

**(i) A validade conta a partir de quando?** Com validade de 180 dias, uma compra importada de
11 meses atrás nasce vencida. Isso é o desejado — a resposta honesta a "quantos pontos ele
teria hoje" — ou a importação de histórico é uma ação promocional de migração, em que os
pontos passam a valer a partir de hoje?

**(ii) O histórico reconstrói a evolução de nível?** Hoje a compra é pontuada com o nível que o
cliente tem **naquele momento**. Importando 12 meses de uma vez, o cliente entra já no nível
final e o histórico inteiro seria pontuado com ele, o que infla o resultado. A alternativa é
processar em ordem cronológica, com o nível subindo mês a mês — mais fiel, mas exige um modo de
importação em lote separado do lançamento normal.

## R3 🔴 Onde fica o dado cadastral com isolamento total?

De D3.1: se a Loja B não pode saber nada dos clientes da Loja A, então nome, telefone e e-mail
não podem ser um registro único compartilhado. O desenho que decorre disso:

```
pessoas            (identidade global — documento, auth_user_id)   ← invisível aos lojistas
   └──1:N── clientes  (por lojista — nome, telefone, email, código externo)
                └──1:1── clientes_fidelidade (saldo, streak, nível)
```

Confirma esse desenho? E a pergunta que ele abre: **qual e-mail vira o login** quando duas
lojas cadastram e-mails diferentes para o mesmo documento? Opções: o e-mail da primeira loja
que liberou o acesso; um e-mail que o cliente escolhe no primeiro acesso; ou o login passa a
ser por documento em vez de e-mail.

## R4 🔴 "Mais de um programa ativo": por lojista ou por cliente?

A resposta de D6 foi "permitir que o cliente tenha mais de um programa ativo", e as duas
leituras têm consequências bem diferentes:

- **(a) Um cliente em vários lojistas, cada um com seu programa.** Já é assim hoje, via
  `clientes_fidelidade`. Nada muda.
- **(b) Um mesmo lojista com dois programas ativos ao mesmo tempo**, com o cliente participando
  dos dois. Aí muda bastante: `fn_programa_ativo` não pode mais devolver um único id; a compra
  precisa saber **contra qual programa** pontua, ou pontua nos dois gerando dois lotes; e
  `clientes_fidelidade` passa a ser por programa e não por lojista, o que muda a chave única e a
  própria definição de "saldo do cliente naquela loja".

Se for (b), vale definir também: um programa pode ter escopo — por categoria de produto, por
período, campanha sazonal — ou são dois programas gerais concorrentes?

## R5 🔴 Como o abatimento do saldo negativo aparece?

De D8, a compra seguinte quita a dívida. Falta definir:

- **Visibilidade** — a compra mostra "0 pontos ganhos" ou "200 ganhos, 200 abatidos"?
  Recomendação: o lote nasce com o valor cheio e uma movimentação de quitação o consome, para o
  extrato contar a história inteira.
- **Limite** — o abatimento consome 100% dos pontos até quitar, ou tem teto (por exemplo, no
  máximo metade de cada compra), para o cliente não passar meses sem ganhar nada?
- **Prazo** — a dívida prescreve junto com a validade dos pontos que a originaram, ou fica
  indefinidamente?

## R6 🟡 Ressalva sobre o `floor` por item (D5.1)

Só para garantir que a decisão foi tomada com a informação certa: **percentual por item e
arredondamento por item são coisas independentes.** Dá para manter cada item com seu próprio
percentual de bonificação e ainda assim truncar uma vez só, no fim:

```
-- hoje, e decidido em D5.1
pontos = Σ floor(subtotal_i × pct_i / 100)

-- alternativa, com o mesmo percentual por item
pontos = floor( Σ (subtotal_i × pct_i / 100) )
```

A diferença é só onde a fração é descartada. Com 10 itens de R$ 9,99 a 5%, a primeira fórmula
dá 0 pontos e a segunda dá 4. A perda é sempre contra o cliente e cresce com o número de itens.
Mantendo D5.1 como está, o comportamento é intencional e o contrato vai registrá-lo assim — é
só confirmar que era isso mesmo.

---

# Rodada 2 — respostas de 08/set/2026

Origem das regras: [00-plano-de-negocio.md](00-plano-de-negocio.md).

| # | Resolução |
|---|---|
| **R1** | **A compra do cliente vem de nota ou cupom e traz todos os itens individualmente.** Fecha a opção (b): o lote pendente nasce com os pontos já calculados, não com zero. Abre a questão de mapeamento de item — **N1**. |
| **R2 (ii)** | **Compra retroativa é lançada uma a uma**, mesmo dentro de uma importação em lote, para que a evolução de nível seja registrada e evolua a cada compra. Ou seja: a importação é um laço cronológico sobre o fluxo normal, não um caminho paralelo. `expira_em` continua indefinido — **N2**. |
| **R3** | **Suspensa.** Onde fica o dado cadastral sob isolamento total continua em aberto, a ser retomado depois da conversa de negócio. Até lá, nenhum contrato pode assumir a divisão `pessoas`/`clientes`. |
| **R4** | **Multi-programa está fora de escopo.** Não estava no escopo original e o custo supera o benefício. Volta a valer um único programa ativo por lojista, e a `fn_programa_ativo` com `limit 1` deixa de ser ambiguidade — **N3** só pergunta se vale travar isso por constraint. |
| **R5** | **Abatimento de dívida:** o cliente vê que ganhou X e que X foi usado no abatimento, com a movimentação de quitação no histórico. Por padrão **100%** dos pontos da compra vão para o abatimento. A dívida **não prescreve**. |
| **R6** | Pendente da recomendação abaixo, agora que o plano de negócio está escrito — **N4**. |

## N1 🔴 Como o item da nota vira um `produtos.id` do lojista?

`compra_itens.produto_id` é `NOT NULL` e aponta para o catálogo do lojista. A nota do cliente
traz descrições do documento fiscal, que não são as descrições cadastradas. Sem uma regra de
correspondência, a compra do cliente não pontua.

- **(a) Importação do XML/QR da nota**, casando item por código. Exige `produtos` ganhar um
  código externo (hoje não tem — só `clientes` tem `codigo_externo`).
- **(b) Cliente escolhe do catálogo** enquanto digita a nota. Expõe a lista de produtos e os
  tetos.
- **(c) Cliente digita livre e o lojista casa na aprovação.** Move o trabalho para o lojista, o
  que conflita com a promessa 6, em que ele só "verifica e aprova".
- **(d) Item não reconhecido cai num produto genérico** com teto padrão do programa.

Vale a pena decidir isto junto com uma pergunta anterior: qual documento o cliente anexa — foto,
PDF, chave de acesso, QR? Você já tem automação de NF-e em outros projetos, o que torna (a)
mais barato aqui do que pareceria.

## N2 🔴 Pontos retroativos nascem expirados?

Com validade de 180 dias, a compra importada de 11 meses atrás já nasce vencida. As duas
leituras são defensáveis e o plano de negócio não decide entre elas:

- **Fiel** — `expira_em = data_compra + validade`. Responde honestamente "quantos pontos ele
  teria hoje", e boa parte do histórico importado nasce sem saldo.
- **Promocional** — o histórico serve para posicionar o cliente no nível certo, e os pontos
  valem a partir da importação.

Recomendação: **fiel**, com o lojista podendo escolher importar "só para nível" (reconstrói
streak e nível sem gerar lote). Preserva a honestidade do número e ainda entrega o efeito de
migração que motiva o lojista.

## N3 🟡 Travar um programa ativo por lojista com constraint?

Com R4, multi-programa saiu de escopo. Um índice único parcial
(`unique (lojista_id) where ativo`) transforma o `limit 1` de hoje, que escolhe silenciosamente,
em erro explícito. Recomendo criar. Custo: se já houver lojista com dois programas ativos em
produção, a migration falha e exige limpeza antes — o que, por si só, é informação útil.

## N4 🔴 O `floor` à luz da promessa 1 — recomendação revista

O plano diz que **quanto mais o cliente compra, mais ele arrecada**, e que o teto por produto
existe para proteger margem. As duas coisas continuam valendo com o `floor` no total:

```
Σ floor(subtotal_i × pct_i / 100)     -- hoje: trunca cada item
floor( Σ subtotal_i × pct_i / 100 )   -- alternativa: trunca uma vez
```

O percentual continua sendo por item nas duas. A diferença é só onde a fração morre. Numa cesta
mista do piloto — 12 itens de revenda a 2% e 3 de fabricação a 8% — a versão por item pode
descartar mais de 10 pontos por compra, sempre contra o cliente, e uma cesta de itens baratos
pode fechar em zero mesmo com total relevante. Isso trabalha contra a promessa 1 exatamente no
caso que o piloto mais tem: compra mista com muitos itens.

**Recomendação: trocar para `floor` no total**, mantendo o percentual por item. Nada da regra 4
se perde e a regra 1 para de ser corroída pelo arredondamento.
