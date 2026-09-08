# 00 — Plano de negócio e origem das decisões

Ditado pelo Sérgio em 08/set/2026. É a **fonte** das regras: quando o código e este documento
divergirem, o código é que está errado. Serve para não reabrir discussão já fechada em reunião
e para não repropor o que já foi descartado.

## O que o produto promete

**1. Pontuação progressiva.** Quanto mais o cliente compra de um lojista, mais ele arrecada.
É a razão de existir do sistema de níveis: o nível não é enfeite, é a alavanca da promessa.

**2. Frequência, não volume isolado.** Existe um limite de tempo entre compras para o cliente
manter o nível. Isso é deliberado e serve para impedir o cliente que compra uma vez por ano e
resgata um prêmio alto. Esse limite é o `dias_para_perder_streak` — ou seja, o campo que hoje é
**ignorado** pelo motor ([S5](03-defeitos-e-riscos.md)) é justamente o mecanismo central da
regra 2. Não é detalhe de configuração.

**3. Tudo personalizável por lojista.** Níveis, tetos e prazos são de cada lojista. Nada de
valor fixo no motor.

**4. Teto por produto existe para proteger margem.** O usuário piloto vende dois tipos de
produto: fabricação própria, de margem alta, e revenda, de margem baixa. Numa compra mista, ele
não pode ser obrigado a pontuar pouco por causa da revenda nem a pontuar acima da margem por
causa da fabricação. Daí o teto percentual por produto, que limita quanto daquele item vira
ponto.

> O motor **já implementa isso corretamente** hoje: aplica
> `least(teto_do_produto, percentual_do_nível)`. Um item de fabricação com teto de 10% num
> cliente de nível 5% pontua 5%; um item de revenda com teto de 2% pontua 2%, mesmo com o
> cliente em nível mais alto. **Com uma exceção grave: teto zero significa hoje "pontua o
> máximo", não "não pontua"** — ver [S11](03-defeitos-e-riscos.md).

**5. O cliente final tem portal próprio**, onde ele: vê em quais lojas tem pontos, quantos
pontos tem em cada uma, **registra uma compra** para ganhar pontos e **solicita um resgate**.

**6. O lojista é o revisor.** Ele verifica e aprova ou reprova as solicitações dos seus
clientes — tanto compras quanto resgates.

## Por que a arquitetura ficou como ficou

Contexto: projeto feito sozinho, sem separação front/back e sem infra containerizada. As
escolhas abaixo foram deliberadas, não acidente:

**1. O painel do lojista veio primeiro** para o usuário piloto já poder lançar vendas e testar
o sistema enquanto o resto era construído. É por isso que a área do cliente ficou como fachada
e o motor de resgate nunca rodou: não era ordem de prioridade, era estratégia de validação.

**2. Login do cliente só após comprar** em um lojista participante — para o sistema não ficar
aberto a qualquer cadastro. É a origem do campo `pode_fazer_login`.

**3. Cliente global é um meio-termo**, não um ideal de produto: veio da constatação de que o
mesmo cliente comprando em duas lojas geraria cadastro duplicado e, consequentemente, dois
logins para a mesma pessoa. O cadastro global resolve a duplicidade; ele não existe para
compartilhar dado entre lojistas — ao contrário, o isolamento entre lojistas é requisito
(ver D3.1 em [04](04-decisoes-em-aberto.md)).

## O que isso implica para a esteira

- O `dias_para_perder_streak` e a expiração de pontos deixam de ser "bug de configuração" e
  viram **regra de negócio central** — são o mecanismo da promessa 2. Prioridade alta.
- O teto por produto está certo na fórmula e errado no caso do zero. Como a promessa 4 é o
  motivo de o piloto ter aderido, o caso do zero é urgente.
- A área do cliente é transacional desde o desenho original (promessas 5 e 6), não um painel
  de leitura. Isso confirma D10 e D11.
- Níveis, tetos e prazos por lojista significam que **nenhum contrato pode assumir default
  global** — todo limite é lido do programa do lojista.
