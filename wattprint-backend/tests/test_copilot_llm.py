import json

import httpx

from app.config import settings
from app.modules.copilot.services import guard, llm
from app.modules.copilot.services.chat import Answer


async def test_stream_bounds_completion_budget(monkeypatch):
    seen = []

    def respond(request):
        seen.append(json.loads(request.content))
        return httpx.Response(
            200,
            text='data: {"choices":[{"delta":{"content":"Ready"}}]}\n\ndata: [DONE]\n\n',
        )

    real_client = httpx.AsyncClient
    monkeypatch.setattr(settings, "openai_api_key", "")
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
    assert seen[0]["usage"] == {"include": True}


async def test_stream_uses_direct_openai_key_and_usage_options(monkeypatch):
    seen = []

    def respond(request):
        seen.append(request)
        return httpx.Response(
            200,
            text=(
                'data: {"choices":[{"delta":{"content":"Ready"}}]}\n\n'
                'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":1}}\n\n'
                'data: [DONE]\n\n'
            ),
        )

    real_client = httpx.AsyncClient
    monkeypatch.setattr(settings, "openai_api_key", "direct-test-key")
    monkeypatch.setattr(settings, "openrouter_api_key", "other-test-key")
    monkeypatch.setattr(settings, "copilot_max_tokens", 512)
    monkeypatch.setattr(
        llm.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(respond)),
    )
    turn = llm.Turn()
    assert "".join([part async for part in llm.stream([], None, turn)]) == "Ready"
    request = seen[0]
    body = json.loads(request.content)
    assert str(request.url) == "https://api.openai.com/v1/chat/completions"
    assert request.headers["Authorization"] == "Bearer direct-test-key"
    assert body["model"] == "gpt-4o-mini"
    assert body["max_completion_tokens"] == 512
    assert body["stream_options"] == {"include_usage": True}
    assert "usage" not in body
    assert "max_tokens" not in body
    assert turn.usage == {"prompt_tokens": 3, "completion_tokens": 1}


async def test_guard_uses_a_small_verdict_budget(monkeypatch):
    seen = []

    def respond(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": "safe"}}]})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "openrouter_api_key", "test-key")
    monkeypatch.setattr(settings, "copilot_guard_model", "test-guard")
    monkeypatch.setattr(
        guard.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(respond)),
    )
    assert await guard.unsafe("How much energy did we use?") is None
    assert seen[0]["max_tokens"] == 64


async def test_guard_uses_openai_moderation(monkeypatch):
    seen = []

    def respond(request):
        seen.append(request)
        return httpx.Response(
            200, json={"results": [{"flagged": True, "categories": {"violence": True}}]}
        )

    real_client = httpx.AsyncClient
    monkeypatch.setattr(settings, "openai_api_key", "direct-test-key")
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    monkeypatch.setattr(
        guard.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(respond)),
    )
    assert await guard.unsafe("test question") == "violence"
    request = seen[0]
    assert str(request.url) == "https://api.openai.com/v1/moderations"
    assert request.headers["Authorization"] == "Bearer direct-test-key"
    assert json.loads(request.content) == {
        "model": "omni-moderation-latest",
        "input": "test question",
    }

def test_missing_cost_is_not_recorded_as_zero():
    answer = Answer("vi")
    answer.count({"prompt_tokens": 2, "completion_tokens": 1})
    assert answer.usage["cost"] is None
    answer.count({"cost": 0.1})
    assert answer.usage["cost"] == 0.1
