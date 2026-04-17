# Meta Ads Monolith

Projeto backend em FastAPI que serve como protótipo monolítico para integração com a Meta Ads API.

## Visão geral

Este serviço realiza:
- cadastro e gestão de contas de anúncio Meta
- sincronização de campanhas, conjuntos, anúncios, criativos e insights
- consulta de dados armazenados localmente
- controle de jobs assíncronos para sincronização e atualização em lote

O serviço foi projetado como um protótipo incremental de API, com foco em ingestão de dados da Meta e exposição de relatórios/insights.

## Principais componentes

### API

- `app/main.py`: aplicação FastAPI principal com suporte a CORS e endpoint de health check
- `app/routers/`: rotas organizadas por domínio
  - `accounts.py`: CRUD de contas de anúncio e listagem de contas/páginas acessíveis pelo token
  - `jobs.py`: consulta e controle de jobs de sincronização
  - `sync.py`: endpoints para iniciar sincronizações de dados Meta em background
  - `query.py`: consultas de campanhas, adsets, anúncios, criativos e insights agregados
  - `write.py`: endpoints de escrita/atualização sob demanda

### Banco de dados

- `app/core/database.py`: conexão SQLAlchemy com PostgreSQL
- `app/core/config.py`: configuração de ambiente com `pydantic-settings`
- `app/models/`: definições de tabelas e entidades
  - `AdAccount`: cadastro de conta de anúncio Meta
  - `SyncJob`: execução de jobs de sincronização, controle de estado e retries
  - e outras entidades de anúncios, campanhas, criativos e insights

### Serviços

- `app/services/meta_client.py`: cliente leve para Meta Graph API (listar contas, páginas e validar token)
- `app/services/sync_service.py`: lógica de sincronização de entidades Meta para PostgreSQL
- `app/services/insight_worker.py`: worker de background para processamento de jobs e cálculo de insights

### Infraestrutura

- `Dockerfile`: imagem Python 3.12 + Uvicorn para execução do serviço
- `docker-compose.yml`: define serviços `api` e `db` (Postgres 16)
- `alembic/` e `alembic.ini`: suporte a migrações de banco de dados
- `requirements.txt`: dependências do projeto
- `meta-ads-monolith.postman_collection.json`: coleção Postman para testar a API

## Tecnologias usadas

- Python 3.12
- FastAPI
- Uvicorn
- SQLAlchemy
- Alembic
- PostgreSQL
- Pydantic Settings
- HTTPX
- python-dotenv

## Como rodar

1. Copie o exemplo de variáveis de ambiente:

```bash
cd social-metric-project/meta-ads-monolith
copy .env.example .env
```

2. Ajuste `DATABASE_URL` em `.env` se necessário.

3. Inicie com Docker Compose:

```bash
docker compose up --build
```

4. A API ficará disponível em:

- `http://localhost:8000`
- documentação OpenAPI: `http://localhost:8000/docs`

## Endpoints principais

- `GET /health`: status do serviço
- `POST /accounts/available`: listar contas de anúncio acessíveis pelo token Meta
- `POST /accounts`: cadastrar conta de anúncio
- `GET /accounts`: listar contas cadastradas
- `GET /accounts/{account_id}/pages`: listar páginas do Facebook vinculadas à conta
- `GET /jobs`: listar jobs de sincronização
- `GET /jobs/{job_id}`: consultar status de job
- `POST /sync/{account_id}/full`: iniciar sincronização completa
- `POST /sync/{account_id}/campaigns`: sincronizar campanhas
- `POST /sync/{account_id}/adsets`: sincronizar conjuntos
- `POST /sync/{account_id}/ads`: sincronizar anúncios
- `POST /sync/{account_id}/creatives`: sincronizar criativos
- `POST /sync/{account_id}/insights/campaigns`: sincronizar insights de campanhas
- `POST /sync/{account_id}/insights/adsets`: sincronizar insights de conjuntos
- `POST /sync/{account_id}/insights/ads`: sincronizar insights de anúncios
- `POST /sync/{account_id}/insights/placements`: sincronizar insights de posicionamento

## Observações

- O serviço espera PostgreSQL acessível a partir de `DATABASE_URL`.
- O sync é executado em background usando `BackgroundTasks` do FastAPI.
- A API possui alias de endpoints para consultas de insights com `account_id` em path e query.

## O que testar primeiro

- Acesso ao Swagger em `/docs`
- `POST /accounts/available` com token válido
- `POST /sync/{account_id}/full` e depois `GET /jobs/{job_id}`
- Consultas de insights em `/accounts/{account_id}/insights/*`
