import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx

from app.config import settings

from ..utils import WeatherUnavailableError

log = logging.getLogger(__name__)

BASE = "https://api.openweathermap.org/data/2.5"
OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
TTL_S = 600  # OpenWeather refreshes about every 10 minutes
TIMEOUT_S = 5.0
SLOTS = 8  # 3-hour forecast steps: the next 24 hours


@dataclass(frozen=True)
class Sky:
    description: str
    icon: str  # OpenWeather icon code: "01d" clear by day, "10n" rain at night


@dataclass(frozen=True)
class Now:
    dt: int
    temp: float
    feels_like: float
    humidity: int
    wind_speed: float
    sky: Sky


@dataclass(frozen=True)
class Slot:
    dt: int
    temp: float
    pop: float  # probability of precipitation, 0..1
    sky: Sky


@dataclass(frozen=True)
class Weather:
    now: Now
    next: list[Slot]


_cache: dict[tuple, tuple[float, Weather]] = {}
_locks: dict[tuple, asyncio.Lock] = {}


def _sky(item: dict[str, Any]) -> Sky:
    w = item["weather"][0]
    return Sky(description=str(w["description"]), icon=str(w["icon"]))


def parse(current: dict[str, Any], forecast: dict[str, Any]) -> Weather:
    try:
        now = Now(
            dt=int(current["dt"]),
            temp=float(current["main"]["temp"]),
            feels_like=float(current["main"]["feels_like"]),
            humidity=int(current["main"]["humidity"]),
            wind_speed=float(current["wind"]["speed"]),
            sky=_sky(current),
        )
        slots = [
            Slot(dt=int(s["dt"]), temp=float(s["main"]["temp"]), pop=float(s["pop"]), sky=_sky(s))
            for s in forecast["list"][:SLOTS]
        ]
    except (KeyError, IndexError, TypeError, ValueError) as e:
        log.warning("unexpected OpenWeather answer: %r", e)
        raise WeatherUnavailableError from e
    if not slots:
        log.warning("OpenWeather returned no forecast")
        raise WeatherUnavailableError
    return Weather(now=now, next=slots)


def _meteo_sky(code: int, day: bool, lang: str) -> Sky:
    if code == 0:
        kind, icon = "clear", "01"
    elif code in (1, 2):
        kind, icon = "partly cloudy", "02"
    elif code == 3:
        kind, icon = "cloudy", "04"
    elif code in (45, 48):
        kind, icon = "fog", "50"
    elif code in (51, 53, 55, 56, 57):
        kind, icon = "drizzle", "09"
    elif code in (61, 63, 65, 66, 67, 80, 81, 82):
        kind, icon = "rain", "10"
    elif code in (71, 73, 75, 77, 85, 86):
        kind, icon = "snow", "13"
    else:
        kind, icon = "thunderstorm", "11"
    vi = {"clear": "Trời quang", "partly cloudy": "Ít mây", "cloudy": "Nhiều mây", "fog": "Sương mù", "drizzle": "Mưa phùn", "rain": "Mưa", "snow": "Tuyết", "thunderstorm": "Dông"}
    return Sky(description=vi[kind] if lang == "vi" else kind.capitalize(), icon=icon + ("d" if day else "n"))


async def _fetch_open_meteo(lat: Decimal, lon: Decimal, lang: str) -> Weather:
    params = {
        "latitude": str(lat), "longitude": str(lon), "timezone": "UTC",
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
        "hourly": "temperature_2m,precipitation_probability,weather_code,is_day",
        "forecast_hours": 27,
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            response = await client.get(OPEN_METEO, params=params)
            response.raise_for_status()
        payload = response.json()
        current, hourly = payload["current"], payload["hourly"]
        times = hourly["time"]
        slots = [
            Slot(
                dt=int(datetime.fromisoformat(times[i]).replace(tzinfo=UTC).timestamp()),
                temp=float(hourly["temperature_2m"][i]),
                pop=float(hourly["precipitation_probability"][i]) / 100,
                sky=_meteo_sky(int(hourly["weather_code"][i]), bool(hourly["is_day"][i]), lang),
            )
            for i in range(0, min(len(times), 24), 3)
        ]
        if not slots:
            raise ValueError("no forecast slots")
        return Weather(
            now=Now(
                dt=int(datetime.fromisoformat(current["time"]).replace(tzinfo=UTC).timestamp()),
                temp=float(current["temperature_2m"]),
                feels_like=float(current["apparent_temperature"]),
                humidity=int(current["relative_humidity_2m"]),
                wind_speed=float(current["wind_speed_10m"]) / 3.6,
                sky=_meteo_sky(int(current["weather_code"]), bool(current["is_day"]), lang),
            ),
            next=slots,
        )
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        log.warning("Open-Meteo failed: %r", exc)
        raise WeatherUnavailableError from exc


async def _fetch(lat: Decimal, lon: Decimal, lang: str) -> Weather:
    params = {
        "lat": str(lat),
        "lon": str(lon),
        "units": "metric",
        "lang": lang,  # OpenWeather writes the sky's description ("mây rải rác") in it
        "appid": settings.openweather_api_key,
    }
    try:
        async with httpx.AsyncClient(base_url=BASE, timeout=TIMEOUT_S) as client:
            current, forecast = await asyncio.gather(
                client.get("/weather", params=params), client.get("/forecast", params=params)
            )
            current.raise_for_status()
            forecast.raise_for_status()
    except httpx.HTTPError as e:
        log.warning("OpenWeather failed: %r", e)
        raise WeatherUnavailableError from e
    return parse(current.json(), forecast.json())


async def weather_at(lat: Decimal, lon: Decimal, lang: str) -> Weather:
    """The weather at a place, cached per (place, language); one fetch at a time per key."""
    key = (str(lat), str(lon), lang)
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < TTL_S:
        return hit[1]
    async with _locks.setdefault(key, asyncio.Lock()):
        hit = _cache.get(key)
        if hit and time.monotonic() - hit[0] < TTL_S:
            return hit[1]
        if settings.openweather_api_key:
            try:
                weather = await _fetch(lat, lon, lang)
            except WeatherUnavailableError:
                weather = await _fetch_open_meteo(lat, lon, lang)
        else:
            weather = await _fetch_open_meteo(lat, lon, lang)
        _cache[key] = (time.monotonic(), weather)
        return weather
