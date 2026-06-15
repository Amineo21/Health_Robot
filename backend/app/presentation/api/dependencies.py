from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from app.application.use_cases.container import ApplicationUseCases


def get_use_cases(request: Request) -> ApplicationUseCases:
    return request.app.state.use_cases


UseCasesDep = Annotated[ApplicationUseCases, Depends(get_use_cases)]
