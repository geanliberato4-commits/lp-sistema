# LP Personalizados — Sistema de Gestão

Sistema interno da LP Personalizados (fase 1): pedidos, painel com alertas, caixa e estoque.

## Como funciona

- **Página:** `index.html`, `app.js`, `estilo.css` e as imagens, publicadas no GitHub Pages.
- **Dados e login:** ficam no Supabase. As duas responsáveis veem os mesmos dados, no celular e no computador.
- **Segurança:** só usuários cadastrados na tabela `membros` conseguem ver ou mudar os dados. A chave em `config.js` é pública e pode ficar no site.

## Montagem

Já está tudo montado: o banco de dados (arquivos da pasta `supabase`, em ordem) foi aplicado no projeto **lp-personalizados** e o site está no GitHub Pages.

**Primeiro acesso:** ao abrir o site pela primeira vez, aparece a tela "Primeiro acesso" para criar o login (nome, e-mail e senha). Depois que ele é criado, essa tela some e só esse login entra.

**Recomendado:** no Supabase, em Authentication → Sign In / Providers, desligar "Allow new users to sign up". Mesmo ligado, quem se cadastrar por fora não vê nenhum dado.

## No celular

Abra o endereço do site e use "Adicionar à tela inicial". O sistema abre como um aplicativo, com a logo.

## O que o sistema faz

- **Pedidos:** cadastro com produtos da ficha técnica ou itens personalizados, canal de venda, taxas da Shopee estimadas, prazos e sinal. Dá para editar e excluir. A exclusão é lógica: o pedido fica guardado em "Excluídos", com motivo, data e quem excluiu.
- **Baixa automática:** quando o pedido chega na etapa escolhida em Ajustes (padrão: Em produção), os materiais da ficha saem do estoque uma única vez. Editar o pedido ajusta só a diferença. Cancelar ou excluir permite devolver ao estoque o que não foi usado. Se faltar material, o sistema avisa quanto precisa, quanto tem e quanto comprar.
- **Produtos:** ficha técnica com os materiais do estoque, mão de obra, embalagem e outros custos, além de foto e variações. A precificação mostra sugestões de 80%, 100% e 150% sobre o custo, um percentual próprio, as taxas da Shopee, o lucro líquido e o cálculo inverso (quanto cobrar para lucrar X).
- **Orçamentos:** itens cadastrados ou personalizados (com materiais), situação, editar, duplicar, copiar a mensagem para o WhatsApp, gerar PDF com a logo (sem custos internos) e transformar em pedido.
- **Caixa:** lançamentos, totais por categoria e resultado por pedido (estimado e realizado). Devoluções a clientes entram como saída, sem apagar o recebimento.
- **Agenda:** quadro com as etapas (setas no celular, arrastar no computador) e calendário pelos prazos.
- **Clientes:** histórico de pedidos e orçamentos, total comprado, endereço, data especial (com aviso no painel) e WhatsApp.
- **Compras:** lista de compras com as etapas pendente, comprado e recebido. Ao receber, o estoque e o custo são atualizados e o pagamento vai para o caixa ou vira conta a pagar.
- **Contas:** contas a pagar e a receber (com repetição mensal), botão de pagar que lança no caixa uma vez só e previsão do caixa para 30 dias.
- **Arte e anexos:** arte com versões, fotos, PDFs e registro da aprovação do cliente, numa pasta privada.
- **Relatórios:** resumo comparado com o período anterior e com o mesmo período do ano passado, canais, situações, lucro por produto, despesas, materiais consumidos e estoque, com exportação em PDF e Excel.
- **Senha e cópia:** esqueci minha senha (por e-mail), trocar senha e cópia de segurança de todos os dados em Excel (em Ajustes).
- **Ajustes:** taxas da Shopee (% e tarifa fixa por pedido ou por item), outras despesas, etapa da baixa e meta do mês.

## Estoque e custo dos materiais

- **Editar material:** no Estoque, botão "Editar" muda nome, unidade, categoria, quantidade, mínimo, fornecedor e custo. Mudar a quantidade fica registrado como ajuste.
- **Custo por unidade:** informe a embalagem (ex.: pacote), quantas unidades vêm nela (500) e o valor (R$ 25,00). O sistema calcula R$ 0,05 por folha.
- **Compra de embalagens:** em "Entrada", informe quantas embalagens comprou e o valor pago. O estoque soma as unidades, a compra entra no caixa e o custo por unidade é atualizado.
- **Materiais do pedido:** na tela do pedido, "Materiais usados" → "+ Adicionar material". A quantidade sai do estoque e o custo entra no lucro do pedido (ex.: 20 folhas × R$ 0,05 = R$ 1,00). O custo fica guardado com o preço do dia, e "Remover" devolve ao estoque.

## Regras automáticas do banco

- O caixa não aceita receber mais do que o saldo de um pedido, o que evita lançamento duplicado.
- O estoque não fica negativo, e cada entrada ou saída atualiza a quantidade sozinha.
- Toda mudança de situação, recebimento e ajuste de custo vai para o histórico do pedido, com o nome de quem fez.
- Um pedido com lançamentos no caixa não pode ser apagado. Use a situação "Cancelado".

## Configuração para o "Esqueci minha senha"

No Supabase, em Authentication → URL Configuration, coloque em **Site URL**: `https://geanliberato4-commits.github.io/lp-sistema/`. Sem isso, o link do e-mail volta para um endereço errado.
