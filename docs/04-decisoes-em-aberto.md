# 04 — Decisões em aberto

Cada item aqui muda a forma do contrato. Enquanto estiverem sem resposta, escrever contrato é
chutar. Formato: o que está em jogo, as opções, e a recomendação com o custo dela.

Status: 🔴 aberto · 🟢 decidido (registrar a decisão e a data aqui quando fechar).

---

## D1 🔴 Ponto de entrada da pontuação: trigger ou RPC?

Hoje são os dois, e é isso que gera o lote-lixo do [S3](03-defeitos-e-riscos.md).

- **(a) Só RPC.** Dropar `trg_compras_processar`. A aplicação passa a ser obrigada a chamar
  `fn_processar_compra` depois de gravar os itens. Qualquer `INSERT` manual em `compras` pelo
  Studio deixa de pontuar.
- **(b) Só trigger.** Mudar o trigger para disparar no fim da transação
  (`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`), quando os itens já existem. O app
  para de chamar a RPC. Pontuação passa a ser inescapável, mas invisível no código da aplicação.
- **(c) Trigger em `compra_itens`.** Recalcula a cada mudança de item. Muitas execuções por
  compra.

**Recomendação: (a).** A pontuação é um passo de negócio com pré-condições (itens gravados,
programa ativo, nível resolvido) e com erro que precisa chegar ao usuário com mensagem
decente. Trigger esconde isso e transforma erro de regra em erro de `INSERT`. O custo é que
mexer em `compras` na mão pelo Studio não pontua mais — aceitável, já que a decisão de projeto
é justamente parar de mexer no banco na mão.

---

## D2 🔴 Expiração e streak: qual campo é a verdade, e quem dispara?

Três campos concorrentes para duas regras ([S5](03-defeitos-e-riscos.md)):

| Regra | Campo que a UI escreve | O que o motor usa |
|---|---|---|
| Expiração de pontos | `programas_fidelidade.dias_expiracao_pontos` | `programas_fidelidade.validade_dias` |
| Perda de streak | `programas_fidelidade.dias_para_perder_streak` | `interval '30 days'` fixo no código |

Precisa decidir: (i) qual coluna sobrevive em cada caso — sugiro manter as que a UI já escreve
e dropar `validade_dias`, migrando o valor; (ii) se `validade_dias_custom` por cliente continua
existindo (hoje o motor faz `greatest(programa, cliente)`, o que significa que o custom só
consegue **aumentar** a validade, nunca reduzir); (iii) quem dispara a expiração — `pg_cron`
chamando a função direto no banco, ou um agendador externo batendo na rota HTTP.

**Recomendação:** manter `dias_expiracao_pontos` e `dias_para_perder_streak` como fonte única,
dropar `validade_dias` numa migration com backfill, manter o custom por cliente mas como
substituição (`coalesce(custom, programa)`) e não como `greatest`, e agendar por `pg_cron`
diário. `pg_cron` é mais simples e não depende da aplicação estar no ar; a rota HTTP fica como
gatilho manual para suporte.

---

## D3 🔴 Cliente é global da plataforma ou de cada lojista?

O schema afirma as duas coisas: `clientes` tem `lojista_id`, e `clientes_fidelidade` é o N:N
cliente×lojista. O código busca cliente global por CNPJ com service role, mas a RLS de
`clientes` filtra por `lojista_id`.

- **(a) Cliente global.** Uma pessoa, um cadastro, N programas de fidelidade. `clientes` perde
  `lojista_id`. É o que o README promete ("cadastro global", "pontos por lojista") e o que a
  área do cliente precisa para mostrar várias lojas.
- **(b) Cliente por lojista.** `clientes` fica com `lojista_id NOT NULL`, o mesmo CNPJ vira N
  linhas, `clientes_fidelidade` vira 1:1 e quase supérfluo. Isolamento fica trivial.

**Recomendação: (a).** É o modelo que o produto vende e o único em que a área do cliente faz
sentido. O custo é LGPD e privacidade: se o mesmo cadastro é visível a dois lojistas, um
lojista não pode ver o que o cliente comprou no outro — a RLS de `clientes` fica mais delicada,
e dados como telefone/e-mail passam a ser compartilhados entre tenants. Isso precisa estar
escrito no contrato, não descoberto depois.

---

## D4 🔴 O que "saldo pendente" significa para o cliente?

Hoje mistura pontos de compra não aprovada com pontos reservados por resgate pendente
([S8](03-defeitos-e-riscos.md)) — dois significados opostos no mesmo número.

**Recomendação:** separar em `saldo_a_liberar` (compra não aprovada) e `saldo_reservado`
(resgate pendente), e mostrar só o segundo ao cliente como "comprometido". Custo: mudança de
schema em `clientes_fidelidade` e revisão de toda tela que hoje lê `saldo_pendente`.

---

## D5 🔴 Onde mora o cálculo de pontos?

Hoje mora em dois lugares que discordam ([S6](03-defeitos-e-riscos.md)).

- **(a) Só no banco.** O TypeScript grava itens com o valor, e lê de volta o que o banco
  calculou. Fonte única, transacional, imune a cliente malicioso.
- **(b) Só no TypeScript.** O banco vira armazenamento burro. Mais fácil de testar e de
  versionar, mas exige que ninguém escreva no banco por fora — e hoje o Studio é usado.
- **(c) Banco calcula, TypeScript simula.** Uma função pura em TS para prévia na tela, com
  teste de equivalência contra o banco. Duas implementações, de propósito e com rede de
  proteção.

Ligado a isto: **o nível usado é o de antes da compra** ([02](02-motor-de-pontos-as-is.md),
passo 6). Uma compra que promove o cliente de Prata para Ouro é pontuada como Prata. Isso é
intencional? E o **arredondamento é `floor` por item** — 10 itens de R$ 9,99 a 5% dão 4 pontos
(`floor(0,4995)` dez vezes = 0), enquanto `floor` sobre o total daria 4. Hoje o cliente perde
os centavos de cada item.

**Recomendação: (a) agora, (c) quando a área do cliente exigir prévia.** E `floor` sobre o
total da compra, não por item — a perda por item é invisível e sempre contra o cliente.

---

## D6 🔴 Um programa ativo por lojista, ou vários?

`fn_programa_ativo` faz `order by created_at desc limit 1` — se houver dois ativos, um deles é
silenciosamente ignorado. Não há constraint impedindo.

**Recomendação:** um único programa ativo por lojista, com índice único parcial
(`UNIQUE (lojista_id) WHERE ativo`). Multi-programa é feature de outro momento e hoje só
produz ambiguidade. Custo: se já existir lojista com dois ativos em produção, a migration
falha e precisa de limpeza antes.

---

## D7 🔴 O fluxo de resgate entra no escopo? E quem cria o resgate?

O motor existe inteiro e nunca rodou ([S7](03-defeitos-e-riscos.md)). Faltam: quem cria
(cliente pelo app? lojista pelo balcão? os dois?), e as validações
(`pontos_necessarios`, `ativo`, `nivel_minimo_id`).

**Recomendação:** lojista cria pelo balcão nesta rodada; cliente só solicita quando a área
dele existir. Validar prêmio no servidor e derivar `pontos_solicitados` de
`premios.pontos_necessarios` em vez de aceitar do cliente.

---

## D8 🔴 Saldo negativo: qual é a fonte da verdade?

Hoje ninguém escreve em `ajustes_pontos` e o rebuild zera a dívida
([S4](03-defeitos-e-riscos.md)).

- **(a)** Cancelamento passa a inserir em `ajustes_pontos`; rebuild continua lendo de lá.
- **(b)** Rebuild passa a derivar o negativo de `pontos_movimentacoes` e `ajustes_pontos` é
  dropada.

**Recomendação: (b).** Já existe um livro-razão append-only com o tipo `saldo_negativo`
registrado corretamente; ter uma segunda tabela para o mesmo fato é como o bug nasceu.
Custo: a query de rebuild fica mais cara, e é preciso decidir como uma dívida é **quitada**
(hoje não há caminho: uma compra nova não abate o negativo, ela só soma no disponível).
Essa segunda parte é regra de negócio nova e precisa de resposta explícita.

---

## D9 🔴 Os contratos descrevem o sistema atual ou o sistema alvo?

- **(a) AS-IS congelado.** Contrato documenta o comportamento de hoje, bugs inclusive; as
  correções viram mudanças de contrato depois, uma a uma.
- **(b) TO-BE.** Contrato já descreve o comportamento correto; o código atual passa a estar
  "fora de conformidade" e a esteira o traz para o contrato.

**Recomendação: (b), com [03](03-defeitos-e-riscos.md) como lista de dívida.** O sistema não
tem usuário em produção sofrendo com uma mudança de comportamento, então congelar o errado só
cria trabalho dobrado. Custo: o diff que o Sonnet vai gerar fica grande, e a revisão do Opus
precisa ser feita por área e não de uma vez.

---

## D10 🔴 A área do cliente entra nesta rodada?

Hoje é fachada com JSON hardcoded. Ela é o que puxa D3 (cliente global), D4 (semântica de
pendente) e D7 (quem pede resgate).

**Recomendação:** entrar no escopo dos **contratos** agora, mesmo que a implementação fique
para depois. Definir o contrato da área do cliente é o que força as decisões D3/D4/D7 a serem
tomadas de forma coerente; adiar isso significa escrever contratos do lojista que vão precisar
mudar quando o cliente chegar.

---

## D11 🔴 Compra pendente e recusada: existe fluxo real?

`compra_status` tem `pendente`, `aprovada`, `recusada`, `cancelada`, e `origem_compra` tem
`cliente` e `lojista`. Mas o TypeScript sempre envia `status: "aprovada"` e
`origem: "lojista"` por padrão, e não há tela de aprovação de compra. O ramo "lote pendente"
do motor existe e nunca é exercitado.

Pergunta: isso é resquício de uma ideia (cliente lança a própria compra e o lojista aprova) ou
é requisito vivo? Se for resquício, simplificar o motor removendo o estado reduz muito a
superfície de teste.

---

## D12 🔴 Compra retroativa: como se comporta?

`expira_em` é `now() + dias`, não `data_compra + dias`. Lançar hoje uma compra de três meses
atrás dá ao cliente pontos com validade cheia. E o streak é reconstruído por `data_compra`
ordenada, então inserir uma compra retroativa reordena o histórico e pode mudar o nível atual —
mas os lotes **já criados** continuam com o percentual do nível antigo.

Precisa decidir se compra retroativa é permitida, e se for, se ela reprocessa o histórico ou
só entra na ponta.

**Recomendação:** `expira_em = data_compra + dias` (com o lote já nascendo expirado se for o
caso), e proibir data futura. Reprocessamento retroativo de histórico eu deixaria de fora:
é caro e a chance de erro é alta.

---

## D13 🔴 Em que formato os contratos são escritos?

Opções que fazem sentido para esta stack: tipos TypeScript + **Zod** como fonte única
(validação em runtime nos route handlers e inferência de tipo), tipos gerados do banco
(`supabase gen types`), e um documento de contrato de API por rota.

**Recomendação:** Zod como fonte única de request/response por rota, em `src/contracts/`,
somado a `supabase gen types` para o shape das tabelas (gerado, nunca escrito à mão), e um
`docs/contratos/*.md` por domínio descrevendo regra e invariante em português — é esse último
que o Sonnet lê para implementar, e é contra ele que o Opus revisa.

---

## D14 🔴 As correções de segurança S1 e S2 entram na esteira ou saem na frente?

São dois buracos abertos agora, num banco com dados reais de beta. A correção é pequena
(revogar grants, dropar 6 policies) mas mexe em produção.

**Recomendação: sair na frente**, como uma migration própria, antes de qualquer contrato.
Custo: precisa de um teste manual das telas depois de aplicar, porque a tabela `lojistas` só
tem a policy permissiva — dropá-la sem colocar outra no lugar quebra a leitura do próprio
lojista.
