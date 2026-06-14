ROBOT_COMMAND_TOPIC = "robot/command"
ROBOT_STATUS_TOPIC = "robot/status"
ROBOT_BATTERY_TOPIC = "robot/battery"
ROBOT_EMERGENCY_TOPIC = "robot/emergency"
ROBOT_NAV2_PATH_TOPIC = "robot/nav2/path"
ROBOT_NAV2_FEEDBACK_TOPIC = "robot/nav2/feedback"
ROBOT_UI_ALERTS_TOPIC = "robot/ui/alerts"
ROBOT_PUSH_NOTIFICATIONS_TOPIC = "robot/notifications/push"
ROBOT_ADMIN_TOPIC = "robot/admin/restart"

SUBSCRIPTION_TOPICS: tuple[tuple[str, int], ...] = (
    (ROBOT_BATTERY_TOPIC, 1),
    (ROBOT_STATUS_TOPIC, 0),
    (ROBOT_EMERGENCY_TOPIC, 1),
    (ROBOT_NAV2_PATH_TOPIC, 0),
    (ROBOT_NAV2_FEEDBACK_TOPIC, 0),
)
