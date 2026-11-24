"""Provider discovery and the file-export adapter boundary."""

from dataclasses import dataclass
from typing import NoReturn, Protocol, TypedDict


class SourceStatus(TypedDict):
    id: str
    name: str
    status: str
    reason: str


class ProviderBlockedError(RuntimeError):
    """The adapter cannot import because a prerequisite has not been met."""


class ExportAdapter(Protocol):
    def source(self) -> SourceStatus:
        """Return current availability without attempting an import."""
        ...

    def import_export(self, payload: bytes) -> None:
        """Import exact export bytes, or raise ProviderBlockedError if unavailable."""
        ...


class StravaExportAdapter:
    _reason = (
        "Awaiting a real Strava export to verify file import. Provide one original "
        "activity file or a small activity-only subset of a bulk export, kept outside Git. "
        "Export instructions: "
        "https://support.strava.com/hc/en-us/articles/216918437-Exporting-your-Data-and-Bulk-Export"
    )

    def source(self) -> SourceStatus:
        return {"id": "strava", "name": "Strava", "status": "blocked", "reason": self._reason}

    def import_export(self, payload: bytes) -> NoReturn:
        raise ProviderBlockedError(self._reason)


@dataclass(frozen=True)
class BlockedExportAdapter:
    """Discovery-only placeholder until a provider's acquisition path is verified."""

    id: str
    name: str
    reason: str

    def source(self) -> SourceStatus:
        return {"id": self.id, "name": self.name, "status": "blocked", "reason": self.reason}

    def import_export(self, payload: bytes) -> NoReturn:
        raise ProviderBlockedError(self.reason)


_ADAPTERS: tuple[ExportAdapter, ...] = (
    StravaExportAdapter(),
    BlockedExportAdapter(
        "lyfta", "Lyfta",
        "Export format unverified. Check the app or vendor support for a native export "
        "linking workouts, exercises and sets with timestamps and load units.",
    ),
    BlockedExportAdapter(
        "google_fit", "Google Fit / Health Connect",
        "No verified file import. Provide a supported export if available. New legacy "
        "Google Fit sync is not planned; direct Health Connect reads require an approved "
        "Android bridge.",
    ),
    BlockedExportAdapter(
        "fatsecret", "FatSecret",
        "Personal diary API access requires user authorization and terms that permit "
        "local retention. No diary or weight export format has been verified.",
    ),
    BlockedExportAdapter(
        "how_we_feel", "How We Feel",
        "Confirm whether the installed app can export check-ins or request account-held "
        "data. For verification, provide emotion, timestamps and tags without notes, "
        "location or attachments.",
    ),
    BlockedExportAdapter(
        "bend", "Bend",
        "No export format verified. Check the app or vendor support for a sample of "
        "completed sessions with dates, duration and region metadata.",
    ),
    BlockedExportAdapter(
        "betterme", "BetterMe",
        "Direct import is unverified. Provide a portability sample from the relevant "
        "app version, or verify which records it writes before considering a Health Connect bridge.",
    ),
    BlockedExportAdapter(
        "mdf", "MDF",
        "App identity unconfirmed. Provide the full name, publisher or store link before "
        "checking for an export of dated habit completions.",
    ),
    BlockedExportAdapter(
        "zepp", "Zepp",
        "Direct import is unverified. Provide a Zepp App portability sample and the "
        "device and app version. Strava sharing is only a candidate for workout data.",
    ),
)

_OPTIONAL_ADAPTERS: tuple[ExportAdapter, ...] = (
    BlockedExportAdapter(
        "youtube", "YouTube",
        "Optional source. Confirm which records are needed and verify an owner-provided "
        "export before implementing import.",
    ),
)


def sources(*, include_optional: bool = False) -> list[SourceStatus]:
    """Return fresh API-ready status records in registry order."""
    adapters = _ADAPTERS + _OPTIONAL_ADAPTERS if include_optional else _ADAPTERS
    return [adapter.source() for adapter in adapters]
