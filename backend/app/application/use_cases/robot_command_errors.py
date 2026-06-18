from __future__ import annotations


class RobotCommandForbiddenError(PermissionError):
    pass


class RobotCommandRejectedError(ValueError):
    pass
