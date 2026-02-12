"""
Centralized Logging Module for LocBook Backend.

Usage:
    # In entry points (main.py, bot_runner.py, worker_runner.py):
    from src.core.logger import setup_logging
    setup_logging()

    # In any module:
    import logging
    logger = logging.getLogger(__name__)
    logger.info("Hello")
"""

import logging
import sys
import os

# ── ANSI Colors ──────────────────────────────────────────────────────────────

class _Colors:
    RESET  = "\033[0m"
    GREY   = "\033[38;5;245m"
    BLUE   = "\033[38;5;75m"
    YELLOW = "\033[38;5;220m"
    RED    = "\033[38;5;196m"
    BOLD   = "\033[1m"


LEVEL_COLORS = {
    "DEBUG":    _Colors.GREY,
    "INFO":     _Colors.BLUE,
    "WARNING":  _Colors.YELLOW,
    "ERROR":    _Colors.RED,
    "CRITICAL": _Colors.RED + _Colors.BOLD,
}


# ── Custom Formatter ─────────────────────────────────────────────────────────

class ColorFormatter(logging.Formatter):
    """
    Compact, colored log formatter.
    Output: `12:09:16 INFO  [module.name] message`
    """

    def format(self, record: logging.LogRecord) -> str:
        # Shorten the logger name: src.modules.bot.handlers -> bot.handlers
        name = record.name
        if name.startswith("src."):
            parts = name.split(".")
            # Keep last 2 segments for readability
            name = ".".join(parts[-2:]) if len(parts) > 2 else ".".join(parts[1:])

        color = LEVEL_COLORS.get(record.levelname, _Colors.RESET)
        time_str = self.formatTime(record, "%H:%M:%S")
        level = record.levelname.ljust(5)

        msg = f"{_Colors.GREY}{time_str}{_Colors.RESET} {color}{level}{_Colors.RESET} [{_Colors.BOLD}{name}{_Colors.RESET}] {record.getMessage()}"

        if record.exc_info and not record.exc_text:
            record.exc_text = self.formatException(record.exc_info)
        if record.exc_text:
            msg += f"\n{color}{record.exc_text}{_Colors.RESET}"

        return msg


# ── Noisy Third-Party Loggers ────────────────────────────────────────────────

SUPPRESSED_LOGGERS = [
    "httpx",
    "httpcore",
    "telegram",
    "telegram.ext",
    "apscheduler",
    "sqlalchemy.engine",
    "asyncio",
    "uvicorn.access",
]


# ── Setup Function ───────────────────────────────────────────────────────────

_is_configured = False

def setup_logging(level: str | None = None):
    """
    Configure the root logger. Safe to call multiple times (idempotent).

    Args:
        level: Override log level. If None, reads from Settings.LOG_LEVEL (default: INFO).
    """
    global _is_configured
    if _is_configured:
        return
    _is_configured = True

    # Resolve level
    if level is None:
        level = os.environ.get("LOG_LEVEL", "INFO")

    numeric_level = getattr(logging, level.upper(), logging.INFO)

    # Configure root logger
    root = logging.getLogger()
    root.setLevel(numeric_level)

    # Remove existing handlers to avoid duplicates
    root.handlers.clear()

    # Console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric_level)
    handler.setFormatter(ColorFormatter())
    root.addHandler(handler)

    # Suppress noisy third-party loggers
    for name in SUPPRESSED_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)

    logging.getLogger("root").debug(f"Logging configured: level={level.upper()}")
