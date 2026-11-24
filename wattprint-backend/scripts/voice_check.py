"""Check the real voice provider end to end: an answer read aloud (TTS), then heard back (STT).

Uses the keys in .env (ASTRALX_API_KEY). Prints what each step returned, how long it took and how
much of the answer survived the round trip; exits 1 when a step fails, so it can gate a release.

    uv run python -m scripts.voice_check            # Vietnamese
    uv run python -m scripts.voice_check en
"""

import asyncio
import re
import sys
import time

from app.config import settings
from app.modules.copilot.services import voice
from app.modules.copilot.utils import VoiceUnavailableError

ANSWERS = {
    "vi": "Kỳ này nhà bạn dùng 262,2 kWh [1], khoảng 647.018 đ [1]. Điện nền ban đêm là 126 W.",
    "en": "This cycle your home used 262.2 kWh [1], about 647,018 VND [1]. Standby is 126 W.",
}


def words(text: str) -> set[str]:
    return set(re.findall(r"\w+", text.casefold()))


async def main(lang: str) -> int:
    if not settings.astralx_api_key:
        print("FAIL no ASTRALX_API_KEY in .env: voice is off (the app answers voice_unavailable)")
        return 1
    answer = ANSWERS[lang]
    said = voice.spoken(answer, lang)
    print(f"text   : {answer}\nspoken : {said}")
    started = time.monotonic()
    audio, first = b"", None
    try:
        async for chunk in voice.speech(answer, lang):
            first = first or time.monotonic() - started
            audio += chunk
    except VoiceUnavailableError as e:
        name = f"{settings.astralx_tts_model}/{settings.astralx_tts_voice}"
        print(f"FAIL tts {name}: {e.__cause__!r}")
        return 1
    took = time.monotonic() - started
    print(f"tts    : {len(audio)} bytes, first audio {first:.1f}s, all {took:.1f}s")
    started = time.monotonic()
    try:
        heard = await voice.transcribe(audio, "audio/mpeg", lang)
    except VoiceUnavailableError as e:
        print(f"FAIL stt {settings.astralx_stt_model}: {e.__cause__!r}")
        return 1
    print(f"stt    : {heard['text']!r} ({time.monotonic() - started:.1f}s)")
    kept = len(words(said) & words(heard["text"])) / max(1, len(words(said)))
    print(f"heard back {kept:.0%} of the spoken words")
    return 0 if kept >= 0.7 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "vi")))
