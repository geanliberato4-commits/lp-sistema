# LP Personalizados — Sistema de Gestão

Sistema interno da LP Personalizados (fase 1): pedidos, painel com alertas, caixa e estoque.

## Como funciona

- **Página:** `index.html`, `app.js`, `estilo.css` e as imagens, publicadas no GitHub Pages.
- **Dados e login:** ficam no Supabase. As duas responsáveis veem os mesmos dados, no celular e no computador.
- **Segurança:** só usuários cadastrados na tabela `membros` conseguem ver ou mudar os dados. A chave em `config.js` é pública e pode ficar no site.

## Montagem (uma vez só)

1. **Banco de dados:** rodar os arquivos da pasta `supabase` em ordem (01 e depois 02) no projeto do Supabase (SQL Editor → colar → Run).
2. **Fechar o cadastro público:** em Authentication → Sign In / Providers, desligar "Allow new users to sign up".
3. **Criar as duas usuárias:** em Authentication → Users → Add user → Create new user, com e-mail e senha, marcando "Auto Confirm User".
4. **Liberar o acesso das duas:** no SQL Editor, trocando os e-mails e nomes:
   ```sql
   insert into public.membros (user_id, nome)
   select id, 'Nome 1' from auth.users where email = 'email1@exemplo.com'
   union all
   select id, 'Nome 2' from auth.users where email = 'email2@exemplo.com';
   ```
5. **Ligar a página ao banco:** em `config.js`, colar a URL do projeto e a chave pública (Project Settings → API Keys).
6. **Publicar:** no GitHub, em Settings → Pages, escolher "Deploy from a branch", branch `main`, pasta `/ (root)`.

## No celular

Abra o endereço do site e use "Adicionar à tela inicial". O sistema abre como um aplicativo, com a logo.

## Regras automáticas do banco

- O caixa não aceita receber mais do que o saldo de um pedido, o que evita lançamento duplicado.
- O estoque não fica negativo, e cada entrada ou saída atualiza a quantidade sozinha.
- Toda mudança de situação, recebimento e ajuste de custo vai para o histórico do pedido, com o nome de quem fez.
- Um pedido com lançamentos no caixa não pode ser apagado. Use a situação "Cancelado".
