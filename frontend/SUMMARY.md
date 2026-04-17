# Meta Ads Frontend — Resumo Técnico

> Frontend puro HTML/CSS/JS sem frameworks para consumir a API do protótipo FastAPI.
> API rodando em `http://localhost:8000` · Frontend servido via Live Server (VS Code) ou `python server.py`

---

## Arquivos

```
meta-ads-frontend/
├── index.html      — shell da SPA: sidebar, main, toast container
├── style.css       — design system dark: variáveis, cards, tabelas, badges, modal, toast, progress bar
├── app.js          — roteador hash + 6 páginas + cliente HTTP
├── server.py       — servidor HTTP simples (porta 5500) para uso sem Live Server
└── SUMMARY.md      — este arquivo
```

---

## Arquitetura

- **Roteamento:** hash (`#accounts`, `#sync`, `#jobs`, `#explorer`, `#insights`) via `window.location.hash`
- **State:** objetos JS simples por rota, sem reatividade, re-render manual
- **HTTP:** `fetch` nativo, wrapper `api(method, path, body, params)` → `GET`, `POST`, `PUT`, `DEL`
- **Notificações:** toasts auto-removidos em 3.5s (success / error / info)
- **Modais:** função `modal(title, content, footer)` cria overlay + fechar por click fora
- **CORS:** habilitado na API com `CORSMiddleware(allow_origins=["*"])` no `app/main.py`

---

## Páginas

### Contas (`#accounts`)
- Tabela de contas cadastradas com account_id, nome, moeda, timezone, status, criado em
- Modal **Nova Conta**: campos account_id, app_id, app_secret, access_token → `POST /accounts`
- Modal **Editar Conta**: atualiza access_token, app_id, app_secret → `PUT /accounts/{id}`
- Botão **Excluir** com confirmação → `DELETE /accounts/{id}` (cascade no backend)
- Botão **Ver Disponíveis**: envia credenciais, lista contas sem salvar → `POST /accounts/available`

### Sync (`#sync`)
- Seletor de conta + botões de sync estrutural (full, campaigns, adsets, ads, creatives)
- Sync insights: date_from, date_to, chunk_size_days → cria job em background → exibe job_id
- Resultado exibido como JSON formatado inline

### Jobs (`#jobs`)
- Tabela com progress bar, retry_count/max_retries, status badge
- **Auto-refresh** toggle (polling a cada 5s via `setInterval`)
- **Cancelar** (`POST /jobs/{id}/cancel`) e **Retomar** (`POST /jobs/{id}/resume`)
- Modal de detalhe com todos os campos do job
- Filtros: account_id, status, job_type

### Explorador (`#explorer`)
Drill-down hierárquico em 4 níveis com breadcrumb de navegação:

**Nível 1 — Campanhas**
- Seletor de conta + date range + granularidade
- Tabela de campanhas com status, orçamentos, botão **Ver ▸**

**Nível 2 — Campanha selecionada**
- Info grid da campanha (objetivo, status, orçamentos, contadores)
- Insights da campanha: tiles de totais + tabela colapsável (`<details>`)
- Tabela de conjuntos (adsets completos via `GET /adsets?campaign_id=`)

**Nível 3 — Conjunto selecionado**
- Info grid do conjunto + seção de público-alvo com:
  - Faixa etária, gênero, países, regiões, cidades (tags visuais)
  - Interesses, comportamentos, públicos customizados, exclusões
  - JSON completo do `targeting` em `<details>` colapsável
- Insights do conjunto: tiles + tabela com `full_view_impressions` / `full_view_reach`
- Tabela de anúncios do conjunto

**Nível 4 — Anúncio selecionado**
- Info grid do anúncio (status, creative_id, lance, domínio, agendamento)
- Insights do anúncio: tiles + tabela com `cost_per_unique_click`
- **Criativo embutido** (auto-fetched por `creative_id`):
  - Thumbnail, título, corpo do anúncio, CTA, tipo
  - Link para imagem externa
  - `object_story_spec` e `asset_feed_spec` em `<details>` colapsáveis

### Insights (`#insights`)
- Tabs: Campanhas / Conjuntos / Anúncios
- Filtros: conta, date range, granularidade (daily/weekly/monthly), ID específico
- Totalizadores (impressões, cliques, gasto) acima da tabela
- Tabela com scroll horizontal com todas as métricas:
  - Columns base: Impressões, Alcance, Frequência, Cliques, Link Clicks, Gasto, CTR, CTR Link, CPM, CPC, CPP, Engajamento
  - Conjuntos: + Impressões Completas, Alcance Completo
  - Anúncios: + Custo/Click Único

---

## Endpoints da API consumidos

| Método | Endpoint | Página |
|--------|----------|--------|
| `GET` | `/accounts` | Contas, Explorador |
| `POST` | `/accounts` | Contas |
| `PUT` | `/accounts/{id}` | Contas |
| `DELETE` | `/accounts/{id}` | Contas |
| `POST` | `/accounts/available` | Contas |
| `POST` | `/sync/{id}/full` | Sync |
| `POST` | `/sync/{id}/campaigns` | Sync |
| `POST` | `/sync/{id}/adsets` | Sync |
| `POST` | `/sync/{id}/ads` | Sync |
| `POST` | `/sync/{id}/creatives` | Sync |
| `POST` | `/sync/{id}/insights/campaigns` | Sync |
| `POST` | `/sync/{id}/insights/adsets` | Sync |
| `POST` | `/sync/{id}/insights/ads` | Sync |
| `GET` | `/jobs` | Jobs |
| `GET` | `/jobs/{id}` | Jobs |
| `POST` | `/jobs/{id}/resume` | Jobs |
| `POST` | `/jobs/{id}/cancel` | Jobs |
| `GET` | `/accounts/{id}/campaigns` | Explorador |
| `GET` | `/accounts/{id}/campaigns/{cid}` | Explorador |
| `GET` | `/accounts/{id}/adsets` | Explorador |
| `GET` | `/accounts/{id}/adsets/{aid}` | Explorador |
| `GET` | `/accounts/{id}/ads` | Explorador |
| `GET` | `/accounts/{id}/ads/{aid}` | Explorador |
| `GET` | `/accounts/{id}/creatives/{cid}` | Explorador |
| `GET` | `/insights/campaigns` | Explorador, Insights |
| `GET` | `/insights/adsets` | Explorador, Insights |
| `GET` | `/insights/ads` | Explorador, Insights |

---

## O que a próxima IA deve implementar

### P0 — Essencial

1. **Gráficos de insights** — linha temporal de spend/impressões/CTR usando Chart.js ou canvas puro. Colocar dentro do nível de Campanha e AdSet no Explorador.

2. **Filtro de status na listagem de campanhas** — o seletor de status no Explorador ainda não filtra ao buscar campanhas.

3. **Paginação** — as tabelas buscam `limit: 200` fixo. Adicionar paginação (prev/next) nas tabelas de campanhas, adsets, ads.

4. **Loading states por seção** — mostrar spinner ou skeleton em cada card enquanto os dados carregam, em vez de atualizar toda a página.

### P1 — Melhoria de UX

5. **Persist date range** — salvar `dateFrom`, `dateTo`, `granularity` e `account_id` no `localStorage` para não perder ao navegar entre páginas.

6. **Export CSV** — botão de download CSV na tabela de insights (converter `data[]` para CSV e criar Blob download).

7. **Comparação de períodos** — campo "período anterior" nos insights para calcular variação % (∆ spend, ∆ CTR etc.).

8. **Preview de thumbnail no Explorador** — na tabela de anúncios do nível 3, mostrar miniatura do criativo (quando disponível) direto na coluna.

9. **Indicador de qualidade** — mostrar `quality_ranking`, `engagement_rate_ranking`, `conversion_rate_ranking` nos insights de campanha com ícone colorido (above average = verde, below = vermelho).

### P2 — Funcionalidades Novas

10. **Dashboard home** — página `#dashboard` como tela inicial com totais de contas, campanhas ativas, gasto do mês atual, jobs rodando, usando tiles e mini-gráficos.

11. **Busca global** — input de busca no header que filtra campanhas/conjuntos/anúncios por nome em tempo real (client-side sobre os dados carregados).

12. **Alertas de rate limit** — quando um job entra em `retry_after`, mostrar countdown no card do job na página Jobs.

13. **Dark/light mode toggle** — botão no sidebar footer para alternar tema (salvar em localStorage).

14. **Annotations nos gráficos** — marcar no gráfico de timeline os dias em que houve mudança de orçamento ou pausa/reativação (usando `meta_updated_time`).

---

## Contexto técnico para a próxima IA

- A API usa **IDs do Meta como PK** (strings, ex: `act_123`, `123456`), não UUIDs
- Orçamentos retornados em **centavos** — dividir por 100 para exibir (já feito via `fmt.budget`)
- Insights retornam `spend` como `numeric(12,2)` — não precisa dividir
- `targeting` é JSONB — pode ser `null` se o adset não foi sincronizado com `targeting` no fields
- Jobs de insights rodam em **BackgroundTasks** do FastAPI — polling necessário (já implementado)
- O endpoint `GET /accounts/{id}/campaigns/{cid}` retorna `AdSetBrief` (sem orçamento/objetivo) — no Explorador, a lista completa de adsets vem de `GET /accounts/{id}/adsets?campaign_id=`
- CORS já está configurado: `allow_origins=["*"]` em `app/main.py`
