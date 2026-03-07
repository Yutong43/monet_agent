"""Shared Finnhub client singleton."""

import os

import finnhub

_finnhub_client: finnhub.Client | None = None


def get_finnhub() -> finnhub.Client:
    """Get or create the Finnhub client (lazy singleton)."""
    global _finnhub_client
    if _finnhub_client is None:
        _finnhub_client = finnhub.Client(api_key=os.environ["FINNHUB_API_KEY"])
    return _finnhub_client
