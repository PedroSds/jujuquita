# Jujuquita

Vitrine de moda infantil e painel de administração integrados ao Supabase.

## Vercel

Importe este repositório na Vercel. A configuração na raiz usa `npm run build` e publica a pasta `dist`. O projeto dispensa dependências de produção e já aponta para o Supabase da loja.

| Página | Endereço |
| --- | --- |
| Vitrine | `/` |
| Coleção | `/colecao.html` |
| Produto | `/produto.html?id=<id>` |
| Administração | `/jujuadmin` |

O painel usa a credencial existente no Supabase Auth e verifica a permissão administrativa. A senha pode ser trocada em **Senha do painel**. A loja usa o número cadastrado em **Configurações** para preparar o pedido no WhatsApp.

## Desenvolvimento local

Execute `npm start` para abrir a loja em `http://localhost:4173`. Execute `npm run build` para conferir os arquivos que a Vercel publica.
