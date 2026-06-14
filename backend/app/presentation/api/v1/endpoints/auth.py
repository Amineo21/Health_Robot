from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.application.dto.auth_dto import AuthenticatedUserResponse, LoginRequest, TokenResponse
from app.application.use_cases.authenticate_user import InactiveUserError, InvalidCredentialsError
from app.presentation.api.dependencies import CurrentUserDep, UseCasesDep

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(use_cases: UseCasesDep, payload: LoginRequest) -> TokenResponse:
    try:
        result = use_cases.authenticate_user.execute(str(payload.email), payload.password)
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except InactiveUserError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user") from None

    return TokenResponse(
        access_token=result.access_token,
        expires_in=result.expires_in,
        user=AuthenticatedUserResponse.from_domain(result.user),
    )


@router.get("/me", response_model=AuthenticatedUserResponse)
def get_me(current_user: CurrentUserDep) -> AuthenticatedUserResponse:
    return AuthenticatedUserResponse.from_domain(current_user)


@router.post("/logout")
def logout(_current_user: CurrentUserDep) -> dict[str, str]:
    return {"status": "logged_out"}
