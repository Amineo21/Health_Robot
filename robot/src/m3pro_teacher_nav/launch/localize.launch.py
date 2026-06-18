"""
NAVIGATION mode — localization on a saved map.

Brings up:
  - slam_toolbox (mode=localization) — subscribes to /initialpose, publishes map->odom via scan-match
  - Nav2 controller / planner / behaviors / bt_navigator / costmaps
  - rosbridge_server on :9090 for Foxglove + web dashboard

Prerequisites:
  - Yahboom bringup running (base_bringup.launch.py)
  - A previously-saved map pair on disk, e.g. /tmp/m3pro_map.{data,posegraph,yaml,pgm}

Usage:
  ros2 launch m3pro_teacher_nav localize.launch.py map:=/tmp/m3pro_map
  ros2 launch m3pro_teacher_nav localize.launch.py map:=/home/jetson/maps/salle
"""
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import AnyLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    nav_share = FindPackageShare("m3pro_teacher_nav")

    slam_params = PathJoinSubstitution([nav_share, "config", "slam_toolbox_localization_params.yaml"])
    nav2_params = PathJoinSubstitution([nav_share, "config", "nav2_params.yaml"])

    use_sim_time = LaunchConfiguration("use_sim_time")
    map_arg = LaunchConfiguration("map")

    nav2_node_names = [
        "controller_server",
        "smoother_server",
        "planner_server",
        "behavior_server",
        "bt_navigator",
    ]

    return LaunchDescription([
        DeclareLaunchArgument("use_sim_time", default_value="false"),
        DeclareLaunchArgument("map", default_value="/root/maps/m3pro_map",
                              description="Saved map base name (without .data/.posegraph suffix). "
                                          "Default points at the container's volume-mounted /root/maps/."),
        DeclareLaunchArgument("rosbridge", default_value="true",
                              description="Also start rosbridge_server on :9090"),

        # --- SLAM in LOCALIZATION mode ---
        # Must use `localization_slam_toolbox_node` (NOT async_) — that's the
        # binary that subscribes to /initialpose for kidnapped-robot recovery.
        Node(
            package="slam_toolbox",
            executable="localization_slam_toolbox_node",
            name="slam_toolbox",
            parameters=[
                slam_params,
                {
                    "use_sim_time": use_sim_time,
                    "map_file_name": map_arg,
                },
            ],
            output="screen",
        ),

        # --- Nav2 ---
        Node(package="nav2_controller", executable="controller_server",
             name="controller_server", parameters=[nav2_params], output="screen"),
        Node(package="nav2_smoother", executable="smoother_server",
             name="smoother_server", parameters=[nav2_params], output="screen"),
        Node(package="nav2_planner", executable="planner_server",
             name="planner_server", parameters=[nav2_params], output="screen"),
        Node(package="nav2_behaviors", executable="behavior_server",
             name="behavior_server", parameters=[nav2_params], output="screen"),
        Node(package="nav2_bt_navigator", executable="bt_navigator",
             name="bt_navigator", parameters=[nav2_params], output="screen"),
        Node(
            package="nav2_lifecycle_manager",
            executable="lifecycle_manager",
            name="lifecycle_manager_navigation",
            parameters=[{
                "autostart": True,
                "node_names": nav2_node_names,
                "bond_timeout": 4.0,
            }],
            output="screen",
        ),

        # --- Rosbridge for Foxglove + web dashboard (same port as mapping mode) ---
        IncludeLaunchDescription(
            AnyLaunchDescriptionSource(
                PathJoinSubstitution([FindPackageShare("rosbridge_server"),
                                      "launch", "rosbridge_websocket_launch.xml"])
            ),
            launch_arguments={"port": "9090", "address": "0.0.0.0"}.items(),
            condition=IfCondition(LaunchConfiguration("rosbridge")),
        ),
    ])
