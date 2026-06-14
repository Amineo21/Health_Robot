from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status

from app.application.dto.admin_user_dto import (
    CreateUserRequest,
    ResetUserPasswordRequest,
    UpdateUserRequest,
    UserResponse,
)
from app.application.use_cases.user_management_errors import (
    LastActiveAdminError,
    UserAlreadyExistsError,
    UserNotFoundError,
)
from app.presentation.api.dependencies import AdminUserDep, UseCasesDep

router = APIRouter(prefix="/admin/users", tags=["admin users"])


def _to_response(user) -> UserResponse:
    return UserResponse.from_domain(user)


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a human user",
    description=(
        "Creates a human account managed by the EHPAD/robot admin. "
        "There is no public registration endpoint; only admins can create caregivers or other admins."
    ),
    response_description="Created user without password fields.",
    responses={
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can create users."},
        409: {"description": "A user already exists with this email."},
    },
)
def create_user(
    use_cases: UseCasesDep,
    _admin_user: AdminUserDep,
    payload: CreateUserRequest,
) -> UserResponse:
    try:
        user = use_cases.create_user.execute(
            email=payload.email,
            name=payload.name,
            role=payload.role,
            password=payload.password,
        )
    except UserAlreadyExistsError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists") from None
    return _to_response(user)


@router.get(
    "",
    response_model=list[UserResponse],
    summary="List human users",
    description="Lists admin and caregiver accounts. Requires an admin bearer token.",
    response_description="Human users without password fields.",
    responses={
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can list users."},
    },
)
def list_users(use_cases: UseCasesDep, _admin_user: AdminUserDep) -> list[UserResponse]:
    return [UserResponse.from_domain(user) for user in use_cases.list_users.execute()]


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update a human user",
    description=(
        "Updates account profile, role, or active state. Requires an admin bearer token. "
        "The last active admin cannot be deactivated or demoted."
    ),
    response_description="Updated user without password fields.",
    responses={
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can update users, and the last active admin is protected."},
        404: {"description": "User not found."},
        409: {"description": "A user already exists with this email."},
    },
)
def update_user(
    use_cases: UseCasesDep,
    _admin_user: AdminUserDep,
    user_id: Annotated[str, Path(min_length=1)],
    payload: UpdateUserRequest,
) -> UserResponse:
    try:
        user = use_cases.update_user.execute(
            user_id=user_id,
            email=payload.email,
            name=payload.name,
            role=payload.role,
            is_active=payload.is_active,
        )
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found") from None
    except UserAlreadyExistsError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists") from None
    except LastActiveAdminError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot remove the last active admin") from None
    return _to_response(user)


@router.post(
    "/{user_id}/reset-password",
    response_model=UserResponse,
    summary="Reset a user password",
    description="Replaces a user's password with a new admin-provided password. Requires an admin bearer token.",
    response_description="User whose password was reset, without password fields.",
    responses={
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can reset passwords."},
        404: {"description": "User not found."},
    },
)
def reset_user_password(
    use_cases: UseCasesDep,
    _admin_user: AdminUserDep,
    user_id: Annotated[str, Path(min_length=1)],
    payload: ResetUserPasswordRequest,
) -> UserResponse:
    try:
        user = use_cases.reset_user_password.execute(user_id=user_id, password=payload.password)
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found") from None
    return _to_response(user)


@router.delete(
    "/{user_id}",
    response_model=UserResponse,
    summary="Deactivate a human user",
    description=(
        "Soft-deletes a user by setting is_active=false. Requires an admin bearer token. "
        "The last active admin cannot be deactivated."
    ),
    response_description="Deactivated user without password fields.",
    responses={
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can deactivate users, and the last active admin is protected."},
        404: {"description": "User not found."},
    },
)
def deactivate_user(
    use_cases: UseCasesDep,
    _admin_user: AdminUserDep,
    user_id: Annotated[str, Path(min_length=1)],
) -> UserResponse:
    try:
        user = use_cases.deactivate_user.execute(user_id)
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found") from None
    except LastActiveAdminError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot remove the last active admin") from None
    return _to_response(user)
