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
