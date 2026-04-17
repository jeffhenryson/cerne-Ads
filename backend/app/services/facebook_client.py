"""
FacebookClient — camada de comunicação com a Meta Graph API v24.0.
"""
import httpx
from typing import Generator

BASE_URL = "https://graph.facebook.com/v24.0/"

RATE_LIMIT_CODES = {80004, 613}


class FacebookAPIError(Exception):
    def __init__(self, message: str, code: int | None = None):
        self.code = code
        super().__init__(message)


class RateLimitError(FacebookAPIError):
    """Raised quando a API retorna código 80004 ou 613."""
    def __init__(self, retry_after: int = 900):
        self.retry_after = retry_after
        super().__init__(
            f"Rate limit atingido — tente novamente em {retry_after}s",
            code=80004,
        )


class FacebookClient:
    def __init__(self, account_id: str, access_token: str):
        self.account_id = account_id
        self.access_token = access_token

    @staticmethod
    def _raise_api_error(error: dict) -> None:
        """Monta mensagem de erro detalhada com tudo que a Meta API retorna."""
        code = error.get("code")
        subcode = error.get("error_subcode")
        msg = error.get("message", "Erro desconhecido")
        user_msg = error.get("error_user_msg") or error.get("error_user_title")
        fbtrace = error.get("fbtrace_id")

        detail = f"Meta API error (code {code}"
        if subcode:
            detail += f", subcode {subcode}"
        detail += f"): {msg}"
        if user_msg and user_msg != msg:
            detail += f" | {user_msg}"
        if fbtrace:
            detail += f" [trace {fbtrace}]"

        if code in RATE_LIMIT_CODES:
            raise RateLimitError(retry_after=900)
        raise FacebookAPIError(detail, code=code)

    def get(self, path: str, params: dict | None = None) -> dict:
        """
        Executa GET síncrono em BASE_URL + path.
        Lança RateLimitError para códigos 80004/613, FacebookAPIError para demais erros.
        Timeout: 30 segundos.
        """
        merged = {"access_token": self.access_token, **(params or {})}
        with httpx.Client(timeout=30) as client:
            resp = client.get(BASE_URL + path, params=merged)

        data = resp.json()
        if "error" in data:
            self._raise_api_error(data["error"])

        return data

    def post(self, path: str, data: dict) -> dict:
        """POST para BASE_URL + path. access_token vai no body."""
        payload = {"access_token": self.access_token, **data}
        with httpx.Client(timeout=30) as client:
            resp = client.post(BASE_URL + path, data=payload)
        result = resp.json()
        if "error" in result:
            self._raise_api_error(result["error"])
        return result

    def delete(self, path: str) -> dict:
        """DELETE para BASE_URL + path."""
        params = {"access_token": self.access_token}
        with httpx.Client(timeout=30) as client:
            resp = client.delete(BASE_URL + path, params=params)
        result = resp.json()
        if "error" in result:
            self._raise_api_error(result["error"])
        return result

    def update_campaign_status(self, campaign_id: str, status: str) -> dict:
        """PATCH /{campaign_id} com {"status": status}."""
        return self.post(campaign_id, {"status": status})

    def delete_campaign(self, campaign_id: str) -> dict:
        """DELETE /{campaign_id} na Meta API."""
        return self.delete(campaign_id)

    def paginate(self, path: str, params: dict | None = None) -> Generator[list[dict], None, None]:
        """
        Itera sobre todas as páginas de resultados usando paging.cursors.after.
        Faz yield de cada lista `data` retornada pela API.
        Lança RateLimitError / FacebookAPIError em caso de erro.
        """
        current_params = dict(params or {})

        while True:
            data = self.get(path, current_params)
            records = data.get("data", [])
            if records:
                yield records

            paging = data.get("paging", {})
            after = paging.get("cursors", {}).get("after")
            if not after or not paging.get("next"):
                break

            current_params["after"] = after
