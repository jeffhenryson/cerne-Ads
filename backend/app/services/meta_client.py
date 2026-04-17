"""
Cliente HTTP mínimo para a Meta Graph API — Fase 2.
Responsável apenas por validar token e listar contas de anúncio.
"""
import httpx

META_BASE = "https://graph.facebook.com/v24.0"

AD_ACCOUNT_FIELDS = "id,name,currency,timezone_name,account_status,business"


class MetaAPIError(Exception):
    def __init__(self, message: str, code: int | None = None):
        self.code = code
        super().__init__(message)


class InvalidTokenError(MetaAPIError):
    """Token inválido ou sem permissão (código 190)."""
    pass


def list_available_accounts(access_token: str) -> list[dict]:
    """
    Chama GET /me/adaccounts e retorna todas as contas de anúncio
    acessíveis pelo token. Levanta InvalidTokenError se token inválido.
    """
    accounts = []
    after = None

    with httpx.Client(timeout=30) as client:
        while True:
            params = {
                "fields": AD_ACCOUNT_FIELDS,
                "limit": 100,
                "access_token": access_token,
            }
            if after:
                params["after"] = after

            resp = client.get(f"{META_BASE}/me/adaccounts", params=params)
            data = resp.json()

            if "error" in data:
                error = data["error"]
                code = error.get("code")
                msg = error.get("message", "Erro desconhecido")
                if code == 190:
                    raise InvalidTokenError(f"Token inválido (code 190): {msg}", code=190)
                raise MetaAPIError(f"Meta API error (code {code}): {msg}", code=code)

            accounts.extend(data.get("data", []))

            paging = data.get("paging", {})
            cursors = paging.get("cursors", {})
            after = cursors.get("after")
            if not after or not paging.get("next"):
                break

    return accounts


def list_pages(access_token: str) -> list[dict]:
    """
    Chama GET /me/accounts e retorna as páginas do Facebook
    acessíveis pelo token. Levanta InvalidTokenError se token inválido.
    """
    pages = []
    after = None

    with httpx.Client(timeout=30) as client:
        while True:
            params = {
                "fields": "id,name,category",
                "limit": 100,
                "access_token": access_token,
            }
            if after:
                params["after"] = after

            resp = client.get(f"{META_BASE}/me/accounts", params=params)
            data = resp.json()

            if "error" in data:
                error = data["error"]
                code = error.get("code")
                msg = error.get("message", "Erro desconhecido")
                if code == 190:
                    raise InvalidTokenError(f"Token inválido (code 190): {msg}", code=190)
                raise MetaAPIError(f"Meta API error (code {code}): {msg}", code=code)

            pages.extend(data.get("data", []))

            paging = data.get("paging", {})
            cursors = paging.get("cursors", {})
            after = cursors.get("after")
            if not after or not paging.get("next"):
                break

    return pages


def get_account_info(access_token: str, account_id: str) -> dict:
    """
    Busca os dados de uma conta específica. Usado no POST /accounts
    para preencher name, currency, timezone_name, account_status.
    """
    accounts = list_available_accounts(access_token)
    # account_id pode vir com ou sem prefixo act_
    for acc in accounts:
        if acc.get("id") == account_id or acc.get("id") == f"act_{account_id.replace('act_', '')}":
            return acc
    raise MetaAPIError(
        f"Conta {account_id} não encontrada nas contas acessíveis pelo token fornecido."
    )
