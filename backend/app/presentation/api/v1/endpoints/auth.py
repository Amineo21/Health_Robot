from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.application.dto.auth_dto import AuthenticatedUserResponse, LoginRequest, TokenResponse
from app.application.use_cases.authenticate_user import InactiveUserError, InvalidCredentialsError
from app.presentation.api.dependencies import CurrentUserDep, UseCasesDep

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password",
    description=(
        "Authenticates a human user and returns a bearer JWT. "
        "Default MVP users are admin@health-robot.local and caregiver@health-robot.local."
    ),
    response_description="JWT access token and authenticated user profile.",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Invalid email or password."},
        status.HTTP_403_FORBIDDEN: {"description": "User exists but is inactive."},
    },
)
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


@router.get(
    "/me",
    response_model=AuthenticatedUserResponse,
    summary="Get current authenticated user",
    description="Returns the profile associated with the bearer token sent in the Authorization header.",
    response_description="Authenticated user profile without password fields.",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Missing, invalid, or expired bearer token."},
        status.HTTP_403_FORBIDDEN: {"description": "Authenticated user is inactive."},
    },
)
def get_me(current_user: CurrentUserDep) -> AuthenticatedUserResponse:
    return AuthenticatedUserResponse.from_domain(current_user)


@router.post(
    "/logout",
    summary="Logout current user",
    description="Symbolic MVP logout. The frontend should delete the JWT on the client side.",
    response_description="Logout acknowledgement.",
    responses={status.HTTP_401_UNAUTHORIZED: {"description": "Missing, invalid, or expired bearer token."}},
)
def logout(_current_user: CurrentUserDep) -> dict[str, str]:
    return {"status": "logged_out"}
