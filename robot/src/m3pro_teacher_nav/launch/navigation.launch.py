"""
Launch Nav2 autonomous navigation with a pre-built map.

Prerequisites:
  - Yahboom bringup must already be running (lidar + odometry + cmd_vel)
  - A map must have been saved previously with slam_toolbox

NOTE: We rely on the Yahboom bringup's robot_state_publisher for TF.
Do not launch a second one — the microcontroller clock offset causes conflicts.

Usage:
  ros2 launch m3pro_teacher_nav navigation.launch.py map:=/path/to/map.yaml
"""
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import AnyLaunchDescriptionSource, PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    nav_share = FindPackageShare("m3pro_teacher_nav")
    nav2_bringup_share = FindPackageShare("nav2_bringup")

    rviz_path = PathJoinSubstitution([nav_share, "rviz", "nav2_view.rviz"])
    # Saved-map navigation wants a more conservative planner than mapping mode:
    # stay inside known map space and do not let live scan noise rewrite the
    # global route.
    nav2_params = PathJoinSubstitution([nav_share, "config", "nav2_navigation_params.yaml"])

    return LaunchDescription([
        DeclareLaunchArgument("map", description="Full path to the map YAML file"),
        DeclareLaunchArgument("rviz", default_value="true"),
        DeclareLaunchArgument("rosbridge", default_value="true"),
        DeclareLaunchArgument("use_sim_time", default_value="false"),

        # --- Sensor fusion ---
        Node(
            package="m3pro_teacher_demos",
            executable="sensor_fusion_rgb_demo",
            parameters=[{
                "simulate": False,
                "front_scan_topic": "/scan0",
                "rear_scan_topic": "/scan1",
                "enable_beep": False,
            }],
            output="screen",
        ),

        # --- Nav2 bringup (AMCL + planners + controllers + behaviors) ---
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(
                PathJoinSubstitution([nav2_bringup_share, "launch", "bringup_launch.py"])
            ),
            launch_arguments={
                "map": LaunchConfiguration("map"),
                "params_file": nav2_params,
                "use_sim_time": LaunchConfiguration("use_sim_time"),
                "autostart": "true",
            }.items(),
        ),

        IncludeLaunchDescription(
            AnyLaunchDescriptionSource(
                PathJoinSubstitution([FindPackageShare("rosbridge_server"),
                                      "launch", "rosbridge_websocket_launch.xml"])
            ),
            launch_arguments={"port": "9090", "address": "0.0.0.0"}.items(),
            condition=IfCondition(LaunchConfiguration("rosbridge")),
        ),

        # --- RViz ---
        Node(
            package="rviz2",
            executable="rviz2",
            arguments=["-d", rviz_path],
            condition=IfCondition(LaunchConfiguration("rviz")),
            output="screen",
        ),
    ])
