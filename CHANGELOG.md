# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.
Este arquivo segue (na medida do possível) o padrão “Keep a Changelog” e [SemVer].

Observação sobre versionamento (2.x):
- A partir da série 2.x, o terceiro dígito indica correções/melhorias da versão principal (patch). Ex.: `2.10.3` = terceira correção/melhoria sobre a `2.10.0`.

## [Unreleased]
- Planejamento das próximas partes/iterações.
- Sugestões:
  - Spaced Repetition (Leitner).
  - Coleções com tags/cores.
  - Provas para impressão com gabarito.
  - CI de validação de JSON por PR.
  - Banco de questões maior por import.
  - Modos de estudo adicionais.
  - Timers/cronômetros enriquecidos.
  - Relatórios/analytics avançados.

---

## [3.4.0] — SEO, desempenho e acessibilidade
### Added
- Metatags de SEO e Open Graph (título, descrição, imagem, keywords, robots) e JSON-LD para Website.
- Atalho de teclado Shift+Esc para limpar o intervalo de IDs.
### Changed
- Carregamento do SDK Supabase com `defer` e conexões antecipadas (`preconnect`/`dns-prefetch`).
### Files
- `index.html` (meta SEO/OG, JSON-LD, preconnect/dns-prefetch, defer do Supabase)
- `assets/js/range-viewer.js` (atalho Shift+Esc)

## [3.3.0] — Limpar intervalo na lista principal
### Added
- Botão “Limpar” ao lado de “Mostrar Itens” nos controles principais para remover o filtro por intervalo de IDs.
### Changed
- Integração do botão com a API do app para restauração imediata da visão completa.
### Files
- `index.html` (botão `#range-clear`)
- `assets/js/range-viewer.js` (ação de limpar)
- `assets/js/app.js` (API `App.clearIdRange()`)

## [3.2.0] — Intervalo integrado aos controles principais
### Changed
- Seletor de intervalo de IDs movido para a barra de controles em Exercícios, junto à busca/filtros.
- Itens filtrados pelo intervalo passam a aparecer no bloco de exercícios principais, com paginação/favoritos/player.
### Files
- `index.html` (inputs `#range-start`, `#range-end`, botão `#range-btn` e feedback)
- `assets/js/app.js` (filtro por `idRangeStart`/`idRangeEnd` em `applyFilters`; API `App.setIdRange()`)
- `assets/js/range-viewer.js` (aplica intervalo via API do app; mensagens de validação)

## [3.1.0] — Visualizador por intervalo (módulo dedicado)
### Added
- Módulo Range Viewer para exibir itens por intervalo de ID com validação, correção de intervalos invertidos e mensagens de erro.
### Files
- `assets/js/range-viewer.js` (novo)
- `index.html` (inclusão do script)

## [3.0.0] — Ampliação do dataset (CTI)
### Added
- Inclusão de 150 novos exercícios de Língua Portuguesa seguindo os critérios CTI:
  - Interpretação, Vocabulário (sinônimos/antônimos, padrão e técnico) e Gramática (ortografia, acentuação, flexão, crase, pronomes, conjugação/modos, concordâncias, regência, sintaxe).
  - Faixas adicionadas: 1101–1150, 1151–1200, 1201–1250.
### Improved
- Validação automática pós-inclusão (estruturas, alternativas, respostas e ausência de duplicidades de ID).
### Files
- `data/exercicios.json` (novos itens)

---

## [2.10.6] — Correções e polimentos (Coleções/Supabase)
### Fixed
- Sincronização de coleções em cenários com grande número de itens (paginado no fetch).
- Mensagens de status mais claras no badge (pendente/sincronizado).
- Casos extremos ao importar coleções: nomes em branco e `qids` duplicados.
### Improved
- União/remapeamento de itens de coleção mais robusto (deduplicação por par `collection_id::qid`).
- Logs de sync enriquecidos no evento `sync:status` (counts por domínio).

## [2.10.5] — Correções menores
### Fixed
- Renomear coleção agora dispara atualização imediata no grid.
- Botões do picker não “vazam” foco ao fechar o modal.
### Improved
- Tratamento de erro ao subir `collection_items` (upsert resiliente).

## [2.10.4] — Consistência de UI e sync
### Fixed
- Badge de status alternando incorretamente para “Local” após sync.
- Fechamento do picker com `ESC` em todos os navegadores suportados.
### Improved
- Desempenho do merge de coleções na importação (map interno + `Set`).

## [2.10.3] — Ajustes de compatibilidade
### Fixed
- Importação de coleções em JSON exportado por versões antigas.
- Trigger de `updated_at` não conflita com replace em massa.
### Improved
- Títulos e tooltips nos botões de Coleções.

## [2.10.2] — RLS e integridade
### Fixed
- RLS: políticas idempotentes no SQL (`DROP IF EXISTS`) para evitar erro em migrações repetidas.
- Índices checados antes de criar (idempotência total).
### Improved
- Mensagens SQL e comentários para manutenção futura.

## [2.10.1] — Hotfix de sincronização
### Fixed
- Falha intermitente ao upsert de items imediatamente após criar a coleção.
### Improved
- Ordem: upsert `collections` → upsert `collection_items` com redundância de `user_id`.

## [2.10.0] — Coleções conectadas ao Supabase
### Added
- Tabelas: `collections`, `collection_items` e `favorites` (com RLS e índices).
- Sync bidirecional (união) de favoritos e coleções:
  - Favoritos: união local+remoto (sem remoção remota nesta versão).
  - Coleções: união de meta (`id`/`name`) e de itens (`qid`).
- UI:
  - Botão “Coleções” nos cards (abrir picker).
  - Seção “Coleções”: criar/renomear/excluir, exportar/importar, iniciar estudo por coleção.

---

## [2.9.0] — Deep link, Destaque e Badge de status
### Added
- Deep link de busca/filtros/visão/paginação (URL guarda `q`, `cat`, `dif`, `view`, `p`, `ps`) com suporte a voltar/avançar do navegador.
- Destaque do termo buscado no enunciado (`<mark>`, acentos ignorados).
- Badge de status na topbar: Local/Online/Offline/Sync pendente/Sincronizado há X min.
### Changed
- `app.js` refatorado para sincronizar estado ↔ URL sem poluir histórico durante digitação.

---

## [2.8.0] — Favoritos, Caderno de erros e Simulado
### Added
- Favoritos:
  - Estrela (⭐) nos cards para marcar/desmarcar favoritos.
  - Chip “Favoritos” na listagem para filtrar apenas os marcados.
- Caderno de erros:
  - Chip “Erros” lista as questões em que a última tentativa foi incorreta (`perQ.lastCorrect = false`).
- Simulado (core + refinos):
  - Iniciar a partir da visão atual (respeita busca/filtros/chips/visões).
  - Selecionar quantidade de questões e duração.
  - Timer flutuante com pausar/retomar; finalização automática ao esgotar tempo.
  - Sem feedback durante o simulado; resumo ao final.
  - Resumo detalhado: tempo total, acertos por categoria e por dificuldade; status por questão.
  - Revisar erros (refazer apenas incorretas, com feedback).
  - Exportar resultado (JSON) e Imprimir resumo.
- UI/UX:
  - Sprite de ícones SVG (botões com ícones).
  - Blocos “Como usar?” em Exercícios, Histórico, Editor e Conta (`<details>`).
  - Tooltips acessíveis (`data-tip`/`title`).
  - Empty states ilustrados e fundo decorativo em SVG.
### Changed
- `player.js`:
  - Suporte a exam mode (sem feedback imediato), eventos `player:summary` e `player:closed`.
  - Botão “Revisar erros” no resumo; export/print no resumo.
- `app.js`:
  - Chips de visão (Todos/Favoritos/Erros).
  - Exposição de `App.getFilteredItems()` para o simulado.
  - Compatível com paginação/visões.
- `storage.js`:
  - v2.2 com favoritos (`getFavorites`/`isFavorite`/`toggleFavorite`), mantendo merge/sync e `perQ`.
### Files
- `index.html` (ícones SVG, painéis de ajuda, controles do simulado e timer)
- `assets/css/styles.css` (chips/estrela, pager, simulado/timer, resumo, tooltips, empty states)
- `assets/js/app.js` (visões, favoritos e integração com o simulado)
- `assets/js/player.js` (exam mode, resumo detalhado, revisar erros, export/print)
- `assets/js/storage.js` (v2.2 com favoritos)
- `assets/js/exam.js` (novo, timer + pausar/retomar e start do simulado)
- `assets/js/ui.js` (novo, tooltips e abertura automática dos helps)
### Notes
- Favoritos são locais nesta versão; no futuro podem ser sincronizados (via Supabase) como extensão.

---

## [2.7.1] — Correções (Auth/Conta)
### Fixed
- Aba “Conta” exibindo “Visitante” mesmo logado em algumas condições de carregamento.
- Botões “Sair” e “Sincronizar agora” ligados antes do Auth estar pronto.
### Improved
- Evento `auth:state` emitido também no carregamento inicial (sessão persistida).

## [2.7.0] — Login, Conta e Sincronização (Supabase)
### Added
- Autenticação (e-mail/senha) via Supabase; sessão persistida.
- Sincronização bidirecional de tentativas (pull + merge + push) com RLS.
- Auto-sync periódico e sync após mudanças locais (`store:changed`).
- Aba “Conta”:
  - Status (Conectado/Visitante), e-mail/UID e conectividade.
  - Métricas de sync (último pull/push) + “Sincronizar agora”.
  - Auto-sync (on/off/intervalo) e tempo online (sessão/total por usuário).
- Eventos globais: `auth:state` e `sync:status`.
### Changed
- `storage.js` v2 (tentativas/`perQ` compatível; `mergeAttempts`; sync meta por usuário).
- `auth.js` (emite `auth:state` e integra Sync; painel de conta).
- `sync.js` (fetch paginado; upsert por `id`; idempotência).
- `account.js` (aba Conta com UI de sync e métricas; tempo de sessão).
### Notes
- Requer Supabase configurado (URL + anon key em `APP_CONFIG`) e a tabela `public.attempts` com policies RLS.

---

## [2.6.0] — Paginação + Novo Dataset
### Added
- Paginação: Primeira/Anterior/1…N/Próxima/Última, itens por página (persistente).
- Dataset: 200 exercícios de Crase (IDs 1001–1200).
### Changed
- `app.js`: listagem com paginação e integração com filtros/busca.
- `styles.css`: estilos do pager.
- `data/exercicios.json`: substituído pelos 200 itens.

---

## [2.5.0] — Preparação de UI/UX
### Added
- Base para componentes de ajuda/tooltips e estado vazio.
### Improved
- Estrutura de CSS modular para suportar chips, badges e novos painéis.

---

## [2.4.1] — Correções menores
### Fixed
- Pequenos ajustes de layout em telas menores.
- Vários títulos/`aria-label`s revisados para leitura por leitores de tela.

## [2.4.0] — Estabilidade e limpeza
### Improved
- Refactors internos para facilitar futuras integrações (coleções/sync).
- Tratamento uniforme de mensagens (`msg` `aria-live`).

---

## [2.3.3] — Correções
### Fixed
- Proteções contra estados nulos em datasets vazios.
- Falhas de normalização de acentos em buscas.

## [2.3.2] — Correções
### Fixed
- Evitar duplo render em algumas transições de filtro.

## [2.3.1] — Correções
### Fixed
- Tipos não suportados no player exibem mensagem consistente.

## [2.3.0] — Melhorias gerais
### Improved
- Organização de scripts e funções utilitárias (`normalizar`/`escape`/`stripAccents`).

---

## [2.2.0] — Store v2 (base para sync)
### Added
- Store v2 com merge/sync meta por usuário e reprocessamento de `perQ`.
### Improved
- Export/Import robusto para evoluções futuras.

---

## [2.1.1] — Hotfix
### Fixed
- Pequenas regressões visuais após refatorações.

## [2.1.0] — Melhorias de manutenção
### Improved
- Código modularizado e comentários/documentação interna.

---

## [2.0.3] — Correções
### Fixed
- Estilos inconsistentes em navegadores sem `color-mix`.

## [2.0.2] — Correções
### Fixed
- Restauração de filtros e paginação após reload.

## [2.0.1] — Correções
### Fixed
- Tratamento de erros de `fetch` do JSON (fallbacks/avisos).

## [2.0.0] — Base 2.x (pós-MVP)
### Added
- Organização do projeto para a série 2.x (refactors, separação de responsabilidades).
- Preparação para recursos: paginação, auth/sync e simulado.

---

## [1.1.0] — Pós-MVP (polimentos)
### Improved
- Documentação (`README`/Changelog) e schema JSON.
- Pequenos ajustes de CSS e acessibilidade.

---

## [1.0.0] — MVP concluído (Partes 1–10)
### Added
- Documentação completa: `README.md`.
- Deploy:
  - Vercel: `vercel.json` (`Cache-Control: no-store` para `data/exercicios.json`).
  - GitHub Pages: workflow `.github/workflows/deploy.yml`.
- Schema JSON de exercícios: `assets/schema/exercicios.schema.json`.
- Config do VS Code mapeando schema: `.vscode/settings.json`.
- `404.html` básico para rotas inválidas.
### Notes
- Nenhuma mudança funcional no app; foco em build, deploy e documentação.

---

## [0.9.0] — Editor/Preview de JSON (Parte 9)
### Added
- Seção Editor (`#editor`) para:
  - Carregar JSON do servidor.
  - Carregar de arquivo local.
  - Validar/formatar o JSON.
  - Aplicar override local (preview) via `localStorage`.
  - Desativar/limpar override e baixar JSON.
- Novo arquivo: `assets/js/editor.js`.
- Navegação: link “Editor”.
### Changed
- `app.js`:
  - Suporte a override local (lê de `localStorage` quando habilitado).
  - Recarrega lista ao evento `dataset:override-changed`.

## [0.8.0] — Acessibilidade e UX (Parte 8)
### Added
- A11y:
  - Skip link “Pular para o conteúdo”.
  - Foco visível consistente (`:focus-visible`).
  - Focus trap no modal (`a11y.js`).
  - Navegação por setas em grupos de rádio (`a11y.js`).
  - ARIA em grupos de opções e na barra de progresso (`role="progressbar"`).
  - Respeito a `prefers-reduced-motion`.
- Novo arquivo: `assets/js/a11y.js`.
### Changed
- `player.js` atualizado para integrar melhorias de A11y.

## [0.7.2] — Histórico avançado (Parte 7.2)
### Added
- Histórico:
  - Sessões detalhadas (início, fim, filtros, taxa de acerto).
  - Estatísticas por questão (tentativas, acertos, melhor sequência, última atividade).
  - Importar JSON (merge/replace).
  - Exportar CSV das tentativas.
### Fixed
- Histórico renderiza no reload (Store auto-init em `storage.js` e fallback em `history.js`).

## [0.7.1] — Persistência + Histórico básico (Parte 7.1)
### Added
- Store (`localStorage`): `assets/js/storage.js`
  - Sessões, tentativas, per-questão, export/import, clear.
  - Evento global `store:changed`.
- Integração do Player com a Store (grava tentativas/sessões).
- Histórico básico (`#historico`):
  - Cards com métricas (tentativas, acertos, distintas, última atividade).
  - Tentativas recentes (lista).
  - Exportar JSON e limpar histórico.
### Fixed
- `player.js`: corrigido template literal malformado no `openSummary` (erro de parsing com `${}`).

## [0.6.0] — Sequência, navegação e resumo (Parte 6)
### Added
- Player:
  - `startSequence(list, index)`: navegação Anterior/Próxima.
  - Indicador de progresso (barra).
  - Resumo ao final (acertos, percentual, status por questão).

## [0.5.0] — Player para Lacuna e V/F + refatoração (Parte 5)
### Added
- Tipos de exercício:
  - Lacuna (input de texto, `Enter` para verificar).
  - Verdadeiro/Falso (rádio).
- Estilos para lacuna.
- Refatoração: lógica do player isolada em `assets/js/player.js` (`app.js` foca em dados e UI geral).

## [0.4.0] — Player (múltipla escolha) (Parte 4)
### Added
- Modal/overlay do Player com:
  - Enunciado, alternativas, verificação, feedback e explicação.
  - Fechamento por `ESC`/click fora/botão, retorno do foco.

## [0.3.0] — Filtros e persistência (Parte 3)
### Added
- Filtros por categoria e dificuldade, gerados dinamicamente a partir do JSON.
- Persistência de busca e filtros (`localStorage`).
- `ESC` limpa busca.
### Changed
- Busca agora inclui enunciado, tema, categoria e `texto_base`.
- Removido `id` duplicado no `main`.
- Render e UX da listagem refinadas.

## [0.2.0] — Tema e navegação (Parte 2)
### Added
- Tema claro/escuro com persistência.
- Destaque de seção ativa no menu (`IntersectionObserver`).
- Scroll suave com compensação do header.
### Changed
- Layout responsivo aprimorado.

## [0.1.0] — Estrutura inicial (Parte 1)
### Added
- Scaffold do projeto (`index.html`, `assets/css/styles.css`, `assets/js/app.js`, `data/exercicios.json`).
- Header, hero, busca e listagem em grid.
- Carregamento do JSON via `fetch` e filtro por texto.
- Amostra mínima de exercícios no JSON.

---

## Notas gerais
- O JSON de exercícios pode ser um array na raiz ou `{ "questoes": [] }`.
- O Editor permite override local sem alterar o arquivo no servidor.
- A Store persiste dados localmente no navegador; parte deles pode ser sincronizada (Supabase) a partir da série 2.x.
- Privacidade: histórico local permanece no navegador do usuário, salvo quando o usuário optar por autenticar e sincronizar.

## Histórico de arquivos adicionados (highlights)
- 2.10.x: `sync.js` (v3); `storage.js` (v2.3) com coleções; `collections.js`; UI dos cards (botão Coleções).
- 2.9.0: deep link/URL, highlight e status badge (`app.js`/`styles.css`).
- 2.8.0: `exam.js`; `player.js` (exam); `storage.js` (v2.2); `ui.js`; melhorias de UI/UX; ícones SVG; ajuda (`<details>`).
- 2.7.x: `auth.js`; `sync.js` (v2); `account.js`; SQL Supabase (attempts).
- 2.6.0: paginação (`app.js`/`styles.css`) e novo dataset (200 crase).
- 1.0.0: `README`, `vercel.json`, workflow Pages, schema JSON, settings do VS Code e `404.html`.
- 7.1: `assets/js/storage.js`, `assets/js/history.js`.
- 7.2: `history.js` avançado.
- 8.0: `assets/js/a11y.js`.
- 9.0: `assets/js/editor.js`.
- 10.0: documentação e infra de deploy.

## Padronização de versão
- `0.x.y`: fases de desenvolvimento por “Parte”.
- `1.x.y`: MVP e polimentos imediatos (Partes 1–10).
- `2.x.y`: evoluções pós-MVP (auth/sync, paginação, favoritos, simulado, coleções, UX).
- `x.y.Z`: correções/melhorias sobre a versão principal `y`.

[SemVer]: https://semver.org/lang/pt-BR/
## [3.4.1] — Higienização de títulos (Figuras)
### Changed
- Títulos de exercícios de figuras que revelavam a resposta (ex.: “Ironia”, “Metonímia”, “Hipérbole”) foram trocados por um tema neutro (“Figuras: identificar recurso”).
### Files
- `data/exercicios.json` (ajuste de `tema` em itens pontuais)