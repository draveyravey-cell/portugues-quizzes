# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.
Este arquivo segue (na medida do possível) o padrão “Keep a Changelog” e SemVer.

## [Unreleased]
- Planejamento das próximas partes/iterações.
- Sugestões: banco de questões maior por import, modos de estudo, timers, relatórios avançados.

## [2.8.0] — Favoritos, Caderno de erros e Simulado
### Added
- Favoritos:
  - Estrela (⭐) nos cards para marcar/desmarcar favoritos.
  - Chip “Favoritos” na listagem para filtrar apenas os marcados.
- Caderno de erros:
  - Chip “Erros” lista as questões em que a última tentativa foi incorreta (perQ.lastCorrect = false).
- Simulado (core + refinos):
  - Iniciar simulado a partir da visão atual (respeita busca/filtros/chips).
  - Selecionar quantidade de questões e duração.
  - Timer flutuante com pausar/retomar; finalização automática ao esgotar tempo.
  - Sem feedback durante o simulado; resumo ao final.
  - Resumo detalhado: tempo total, acertos por categoria e por dificuldade; status por questão.
  - Revisar erros (refazer apenas incorretas, com feedback).
  - Exportar resultado (JSON) e Imprimir resumo.
- UI/UX:
  - Sprite de ícones SVG (botões com ícones).
  - Blocos “Como usar?” em Exercícios, Histórico, Editor e Conta (details).
  - Tooltips acessíveis (data-tip/title).
  - Empty states ilustrados e fundo decorativo em SVG.

### Changed
- player.js:
  - Suporte a exam mode (sem feedback imediato), eventos player:summary e player:closed.
  - Botão “Revisar erros” no resumo; export/print no resumo.
- app.js:
  - Chips de visão (Todos/Favoritos/Erros).
  - Exposição de App.getFilteredItems() para o simulado.
  - Compatível com paginação/visões.
- storage.js:
  - v2.2 com favoritos (getFavorites/isFavorite/toggleFavorite), mantendo merge/sync e perQ.

### Files
- index.html (ícones SVG, painéis de ajuda, controles do simulado e timer)
- assets/css/styles.css (chips/estrela, pager já existente, simulado/timer, resumo, tooltips, empty states)
- assets/js/app.js (visões, favoritos e integração com o simulado)
- assets/js/player.js (exam mode, resumo detalhado, revisar erros, export/print)
- assets/js/storage.js (v2.2 com favoritos)
- assets/js/exam.js (novo, timer + pausar/retomar e start do simulado)
- assets/js/ui.js (novo, tooltips e abertura automática dos helps)

### Notes
- Favoritos são locais; no futuro podem ser sincronizados (via Supabase) como extensão.

## [2.7.0] — Login, Conta e Sincronização (Supabase)
### Added
- Autenticação (e-mail/senha) via Supabase.
- Sincronização bidirecional de tentativas (pull + merge + push) com RLS.
- Auto-sync periódico e sync após mudanças locais (store:changed).
- Aba “Conta”:
  - Status (Conectado/Visitante), e-mail/UID e conectividade.
  - Métricas de sync (último pull/push) + “Sincronizar agora”.
  - Auto-sync (on/off/intervalo) e tempo online (sessão/total por usuário).
- Eventos globais: auth:state e sync:status.

### Changed
- storage.js v2 (tentativas/perQ compatível; mergeAttempts; sync meta por usuário).
- auth.js (emite auth:state e integra Sync; painel de conta).
- sync.js (fetch paginado; upsert por id; idempotente).
- account.js (aba Conta com UI de sync e métricas; tempo de sessão).

### Notes
- Requer Supabase configurado (URL + anon key em APP_CONFIG) e a tabela public.attempts com policies RLS.

## [2.6.0] — Paginação e novo banco de exercícios
### Added
- Paginação: Primeira/Anterior/1…N/Próxima/Última, itens por página (persistente).
- Dataset: 200 exercícios de Crase (IDs 1001–1200).

### Changed
- app.js: listagem com paginação e integração com filtros/busca.
- styles.css: estilos do pager.
- data/exercicios.json: substituído pelos 200 itens.

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
- 2.6.0: paginação (app.js/styles.css).
- 2.7.0: auth.js, sync.js, account.js (aba Conta).
- 2.8.0: exam.js, ui.js, storage.js (v2.2), player.js e atualizações no index/styles/app.

## Padronização de versão
- 0.x.y: fases de desenvolvimento por “Parte”.
- 1.0.0: MVP completo (Partes 1–10).
- 2.x.y: evoluções pós-MVP (auth/sync, paginação, favoritos, simulado, UI).