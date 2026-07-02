# 🐉 O Tesouro do Cavaleiro Yuri — Chá de Fralda

Landing page (HTML + CSS + JavaScript puro) que lê a lista de presentes
direto de uma planilha do Google Sheets usando a biblioteca **SheetJS**.

- Itens marcados como **Comprado?** na planilha somem automaticamente do site.
- O site sempre busca a versão mais recente da planilha (sem cache).
- Busca por nome + filtro por categoria.
- 100% responsivo (feito pensando no celular).

## Arquivos
- `index.html` — estrutura da página
- `style.css` — tema dragão/medieval (azul, branco e dourado)
- `app.js` — leitura da planilha + busca/filtros
- `img/` — ilustrações
- `.nojekyll` — evita que o GitHub Pages processe a pasta

## Trocar a planilha
No arquivo `app.js`, edite o topo:
```js
const SHEET_ID   = "1c94jaSPwMC4cWvskXrbxszK8uESZlWNKeXqT3nYX6zc";
const SHEET_NAME = "Pergaminho";
```
> A planilha precisa estar compartilhada como **"Qualquer pessoa com o link · Leitor"**.

## Publicar no GitHub Pages
1. Crie um repositório no GitHub (ex.: `cha-do-yuri`).
2. Envie **todo o conteúdo desta pasta** para a raiz do repositório.
3. No GitHub: **Settings → Pages**.
4. Em *Build and deployment*, **Source = Deploy from a branch**.
5. Branch = `main` e pasta = `/ (root)` → **Save**.
6. Aguarde ~1 min. O site fica em `https://SEU-USUARIO.github.io/cha-do-yuri/`.
