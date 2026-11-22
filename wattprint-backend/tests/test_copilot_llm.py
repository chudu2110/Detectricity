import json

import httpx

from app.config import settings
from app.modules.copilot.services import guard, llm


async def test_stream_bounds_completion_budget(monkeypatch):
    seen = []

    def respond(request):
        seen.append(json.loads(request.content))
        return httpx.Response(
            200,
            text='data: {"choices":[{"delta":{"content":"Ready"}}]}\n\ndata: [DONE]\n\n',
        )

    real_client = httpx.AsyncClient
    monkeypatch.setattr(settings, "openrouter_api_key", "test-key")
    monkeypatch.setattr(settings, "copilot_max_tokens", 2048)
    monkeypatch.setattr(
        llm.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(respond)),
    )
    turn = llm.Turn()
    assert "".join([part async for part in llm.stream([], None, turn)]) == "Ready"
    assert seen[0]["max_tokens"] == 2048


async def test_guard_uses_a_small_verdict_budget(monkeypatch):
    seen = []

    def respond(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": "safe"}}]})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(settings, "openrouter_api_key", "test-key")
    monkeypatch.setattr(settings, "copilot_guard_model", "test-guard")
    monkeypatch.setattr(
        guard.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(respond)),
    )
    assert await guard.unsafe("How much energy did we use?") is None
    assert seen[0]["max_tokens"] == 64
