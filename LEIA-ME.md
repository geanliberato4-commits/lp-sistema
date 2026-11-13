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

## Regras automáticas do banco

- O caixa não aceita receber mais do que o saldo de um pedido, o que evita lançamento duplicado.
- O estoque não fica negativo, e cada entrada ou saída atualiza a quantidade sozinha.
- Toda mudança de situação, recebimento e ajuste de custo vai para o histórico do pedido, com o nome de quem fez.
- Um pedido com lançamentos no caixa não pode ser apagado. Use a situação "Cancelado".
