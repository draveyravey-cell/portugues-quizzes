# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.
Este arquivo segue (na medida do possível) o padrão “Keep a Changelog” e SemVer.

## [Unreleased]
- Planejamento das próximas partes/iterações.
- Sugestões: banco de questões maior por import, modos de estudo, timers, relatórios avançados.

## [1.0.0] — MVP concluído (Parte 10)
### Added
- Documentação completa: README.md.
- Deploy:
  - Vercel: vercel.json (Cache-Control: no-store para data/exercicios.json).
  - GitHub Pages: workflow .github/workflows/deploy.yml.
- Schema JSON de exercícios: assets/schema/exercicios.schema.json.
- Config do VS Code mapeando schema: .vscode/settings.json.
- 404.html básico para rotas inválidas.

### Notes
- Nenhuma mudança funcional no app; foco em build, deploy e documentação.

## [0.9.0] — Editor/Preview de JSON (Parte 9)
### Added
- Seção Editor (#editor) para:
  - Carregar JSON do servidor.
  - Carregar de arquivo local.
  - Validar/formatar o JSON.
  - Aplicar override local (preview) via localStorage.
  - Desativar/limpar override e baixar JSON.
- Novo arquivo: assets/js/editor.js.
- Navegação: link “Editor”.

### Changed
- app.js:
  - Suporte a override local (lê de localStorage quando habilitado).
  - Recarrega lista ao evento “dataset:override-changed”.

## [0.8.0] — Acessibilidade e UX (Parte 8)
### Added
- A11y:
  - Skip link “Pular para o conteúdo”.
  - Foco visível consistente (:focus-visible).
  - Focus trap no modal (a11y.js).
  - Navegação por setas em grupos de rádio (a11y.js).
  - ARIA em grupos de opções e na barra de progresso (role="progressbar").
  - Respeito a prefers-reduced-motion.
- Novo arquivo: assets/js/a11y.js.

### Changed
- player.js atualizado para integrar melhorias de A11y.

## [0.7.2] — Histórico avançado (Parte 7.2)
### Added
- Histórico:
  - Sessões detalhadas (início, fim, filtros, taxa de acerto).
  - Estatísticas por questão (tentativas, acertos, melhor sequência, última atividade).
  - Importar JSON (merge/replace).
  - Exportar CSV das tentativas.

### Fixed
- Histórico renderiza no reload (Store auto-init em storage.js e fallback em history.js).

## [0.7.1] — Persistência + Histórico básico (Parte 7.1)
### Added
- Store (localStorage): assets/js/storage.js
  - Sessões, tentativas, per-questão, export/import, clear.
  - Evento global “store:changed”.
- Integração do Player com a Store (grava tentativas/sessões).
- Histórico básico (#historico):
  - Cards com métricas (tentativas, acertos, distintas, última atividade).
  - Tentativas recentes (lista).
  - Exportar JSON e limpar histórico.

### Fixed
- player.js: corrigido template literal malformado no openSummary (erro de parsing com `${}`).

## [0.6.0] — Sequência, navegação e resumo (Parte 6)
### Added
- Player:
  - startSequence(list, index): navegação Anterior/Próxima.
  - Indicador de progresso (barra).
  - Resumo ao final (acertos, percentual, status por questão).

## [0.5.0] — Player para Lacuna e V/F + refatoração (Parte 5)
### Added
- Tipos de exercício:
  - Lacuna (input de texto, Enter para verificar).
  - Verdadeiro/Falso (rádio).
- Estilos para lacuna.
- Refatoração: lógica do player isolada em assets/js/player.js (app.js foca em dados e UI geral).

## [0.4.0] — Player (múltipla escolha) (Parte 4)
### Added
- Modal/overlay do Player com:
  - Enunciado, alternativas, verificação, feedback e explicação.
  - Fechamento por ESC/click fora/botão, retorno do foco.

## [0.3.0] — Filtros e persistência (Parte 3)
### Added
- Filtros por categoria e dificuldade, gerados dinamicamente a partir do JSON.
- Persistência de busca e filtros (localStorage).
- “ESC” limpa busca.

### Changed
- Busca agora inclui enunciado, tema, categoria e texto_base.
- Removido id duplicado no main.
- Render e UX da listagem refinadas.

## [0.2.0] — Tema e navegação (Parte 2)
### Added
- Tema claro/escuro com persistência.
- Destaque de seção ativa no menu (IntersectionObserver).
- Scroll suave com compensação do header.

### Changed
- Layout responsivo aprimorado.

## [0.1.0] — Estrutura inicial (Parte 1)
### Added
- Scaffold do projeto (index.html, assets/css/styles.css, assets/js/app.js, data/exercicios.json).
- Header, hero, busca e listagem em grid.
- Carregamento do JSON via fetch e filtro por texto.
- Amostra mínima de exercícios no JSON.

---

## Notas gerais
- O JSON de exercícios pode ser um array na raiz ou `{ "questoes": [] }`.
- O Editor (Parte 9) permite override local sem alterar o arquivo no servidor.
- A Store (histórico) persiste dados apenas no navegador (privacidade do usuário).

## Histórico de arquivos adicionados (highlights)
- 7.1: assets/js/storage.js, assets/js/history.js.
- 7.2: history.js avançado.
- 8.0: assets/js/a11y.js.
- 9.0: assets/js/editor.js.
- 10.0: README.md, vercel.json, .github/workflows/deploy.yml, assets/schema/exercicios.schema.json, .vscode/settings.json, 404.html.

## Padronização de versão
- 0.x.y: fases de desenvolvimento por “Parte”.
- 1.0.0: MVP completo (Partes 1–10).