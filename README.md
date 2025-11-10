# Português Prático — Exercícios de Português

Site estático com exercícios (múltipla escolha, lacuna e verdadeiro/falso), player com feedback, filtros, tema claro/escuro, acessibilidade, histórico local e editor de JSON no navegador.

- Live: Vercel (recomendado) ou GitHub Pages
- Stack: HTML + CSS + JS (vanilla). Sem build/bundler.
- Privacidade: dados de estudo ficam no localStorage do navegador do usuário.

## Recursos

- Listagem com filtros (texto, categoria, dificuldade) e tema claro/escuro
- Player com:
  - múltipla escolha, lacuna e V/F
  - navegação (anterior/próxima), resumo, progresso
  - acessibilidade (focus trap, setas nos rádios, ARIA)
- Histórico local (Store):
  - tentativas, sessões, métricas por questão, export/import JSON, CSV
- Editor no navegador (override local do JSON):
  - carregar do servidor/arquivo, validar, formatar, aplicar override (preview), desativar/limpar, baixar

## Estrutura