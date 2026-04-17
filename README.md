# 🏢 Prototipo de Sistema para análise de dados - Cerne Ads

Protótipo de backend em FastAPI para integração com a Meta Ads API. Este serviço sincroniza dados de anúncios da Meta e expõe consultas locais para campanhas, conjuntos, anúncios, criativos e insights.

## O que ele faz

- cadastra e gerencia contas de anúncio Meta
- sincroniza campanhas, adsets, anúncios, criativos e insights
- mantém histórico local de dados sincronizados
- controla jobs assíncronos de sincronização e retentativas

## Tecnologias

- Python 3.12
- FastAPI
- Uvicorn
- SQLAlchemy
- Alembic
- PostgreSQL
- HTTPX
- python-dotenv

## Executando com Docker

1. Vá para a pasta do backend:

```bash
cd backend
```

2. Copie o arquivo de ambiente:

```bash
copy .env.example .env
```

3. Ajuste `DATABASE_URL` em `.env` se necessário.

4. Inicie a aplicação:

```bash
docker compose up --build
```

5. Acesse a API:

- `http://localhost:8000`
- documentação: `http://localhost:8000/docs`
- health check: `http://localhost:8000/health`

## Observações

- O serviço depende de um banco PostgreSQL configurado em `DATABASE_URL`.
- A sincronização é executada em background com `BackgroundTasks`.
- A API inclui endpoints para criar, consultar e retomar jobs de sync.
