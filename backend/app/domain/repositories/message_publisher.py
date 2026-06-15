from __future__ import annotations

from typing import Any, Protocol


class MessagePublisher(Protocol):
    def publish_json(
        self,
        topic: str,
        payload: dict[str, Any],
        qos: int = 1,
        retain: bool = False,
    ) -> None: ...
