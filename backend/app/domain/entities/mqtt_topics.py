ROBOT_COMMAND_TOPIC = "robot/command"
ROBOT_COMMAND_NAVIGATION_TOPIC = "robot/command/navigation"
ROBOT_COMMAND_TELEOP_TOPIC = "robot/command/teleop"
ROBOT_COMMAND_SAFETY_TOPIC = "robot/command/safety"
ROBOT_STATUS_TOPIC = "robot/status"
ROBOT_BATTERY_TOPIC = "robot/battery"
ROBOT_EMERGENCY_TOPIC = "robot/emergency"
ROBOT_NAV2_PATH_TOPIC = "robot/nav2/path"
ROBOT_NAV2_FEEDBACK_TOPIC = "robot/nav2/feedback"
ROBOT_UI_ALERTS_TOPIC = "robot/ui/alerts"
ROBOT_PUSH_NOTIFICATIONS_TOPIC = "robot/notifications/push"
ROBOT_ADMIN_TOPIC = "robot/admin/restart"
ROBOT_NAV_GOAL_TOPIC = "robot/nav/goal"
ROBOT_CMD_VEL_TOPIC = "robot/cmd_vel"

ROBOT_POSE_TOPIC = "robot/pose"
ROBOT_NAV_CANCEL_TOPIC = "robot/nav/cancel"
ROBOT_NAV_PATH_DISPLAY_TOPIC = "robot/nav/path_display"

# Recuperation autonome de la fourniture au point de stock (scan + bras).
ROBOT_MISSION_RECOVERY_REQUEST_TOPIC = "robot/mission/recovery_request"  # backend -> robot
ROBOT_MISSION_RECOVERY_DONE_TOPIC = "robot/mission/recovery_done"        # robot -> backend

SUBSCRIPTION_TOPICS: tuple[tuple[str, int], ...] = (
    (ROBOT_BATTERY_TOPIC, 1),
    (ROBOT_STATUS_TOPIC, 0),
    (ROBOT_EMERGENCY_TOPIC, 1),
    (ROBOT_NAV2_PATH_TOPIC, 0),
    (ROBOT_NAV2_FEEDBACK_TOPIC, 0),
    (ROBOT_POSE_TOPIC, 0),
    (ROBOT_NAV_PATH_DISPLAY_TOPIC, 0),
    (ROBOT_MISSION_RECOVERY_DONE_TOPIC, 1),
)
