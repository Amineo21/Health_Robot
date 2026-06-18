from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.application.use_cases.authenticate_user import InactiveUserError
from app.application.use_cases.container import ApplicationUseCases
from app.application.use_cases.get_authenticated_user import AuthenticatedUserNotFoundError
from app.core.config import settings
from app.domain.entities.user import User, UserRole
from app.infrastructure.robot_maps.dashboard_client import RobotDashboardClient
from app.infrastructure.rosbridge.mqtt_rosbridge_bridge import MqttRosbridgeBridge

bearer_scheme = HTTPBearer(auto_error=False)


def get_use_cases(request: Request) -> ApplicationUseCases:
    return request.app.state.use_cases


UseCasesDep = Annotated[ApplicationUseCases, Depends(get_use_cases)]


def get_robot_rosbridge_bridge(request: Request) -> MqttRosbridgeBridge:
    return request.app.state.robot_rosbridge_bridge


def get_robot_dashboard_client(request: Request) -> RobotDashboardClient:
    return request.app.state.robot_dashboard_client


RobotRosbridgeBridgeDep = Annotated[MqttRosbridgeBridge, Depends(get_robot_rosbridge_bridge)]
RobotDashboardClientDep = Annotated[RobotDashboardClient, Depends(get_robot_dashboard_client)]


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    request: Request,
    use_cases: UseCasesDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    try:
        payload = request.app.state.token_service.decode_access_token(credentials.credentials)
    except JWTError:
        raise _unauthorized("Invalid token") from None

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise _unauthorized("Invalid token")

    try:
        return use_cases.get_authenticated_user.execute(user_id)
    except AuthenticatedUserNotFoundError:
        raise _unauthorized("Invalid token") from None
    except InactiveUserError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user") from None


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    allowed_roles = set(roles)

    def dependency(current_user: CurrentUserDep) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return current_user

    return dependency


AdminUserDep = Annotated[User, Depends(require_roles(UserRole.admin))]
CaregiverOrAdminDep = Annotated[User, Depends(require_roles(UserRole.admin, UserRole.caregiver))]


def require_robot_api_key(api_key: Annotated[str | None, Header(alias="X-Robot-Api-Key")] = None) -> None:
    if settings.robot_api_key is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Robot API key is not configured")
    if not hmac.compare_digest(api_key or "", settings.robot_api_key):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid robot API key")
