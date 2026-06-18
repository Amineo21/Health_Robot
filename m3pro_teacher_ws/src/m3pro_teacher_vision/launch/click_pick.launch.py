"""
Click-to-pick demo (arm-only, no base motion).

Starts:
  - click_to_pick_node  (reads pixel clicks, runs the pick sequence)
  - web_server_node     (serves pick.html + MJPEG camera stream)
  - rosbridge_websocket (WebSocket for browser <-> ROS)

NOT started here (launch separately):
  - Yahboom bringup (lidar/odom/arm driver):
      ros2 launch slam_mapping bringup.launch.py
  - Camera:
      ros2 launch slam_mapping app_camera.launch.py

Open the page in your browser: http://<robot-ip>:8080/pick.html
"""
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    vision_share = FindPackageShare("m3pro_teacher_vision")
    params = PathJoinSubstitution([vision_share, "config", "detection_params.yaml"])

    return LaunchDescription([
        DeclareLaunchArgument("http_port", default_value="8080"),
        DeclareLaunchArgument("ws_port",   default_value="9090"),

        # Bridge the two unconnected TF trees: robot URDF (base_link)
        # and camera driver (camera_link). The Yahboom URDF defines the
        # Camera mount at (0.091, 0, 0.093) from base_link.
        Node(
            package="tf2_ros",
            executable="static_transform_publisher",
            name="base_to_camera_static_tf",
            arguments=[
                "--x", "0.091", "--y", "0.0", "--z", "0.093",
                "--qx", "0", "--qy", "0", "--qz", "0", "--qw", "1",
                "--frame-id", "base_link",
                "--child-frame-id", "camera_link",
            ],
            output="screen",
        ),

        # Yahboom's KDL-based IK service (/get_kinemarics) — used by click_to_pick
        Node(
            package="arm_kin",
            executable="kin_srv",
            name="kinemarics_arm",
            output="screen",
        ),

        Node(
            package="m3pro_teacher_vision",
            executable="click_to_pick_node",
            name="click_to_pick_node",
            parameters=[params],
            output="screen",
        ),

        Node(
            package="m3pro_teacher_web",
            executable="web_server_node",
            name="web_server_node",
            parameters=[{"port": LaunchConfiguration("http_port")}],
            output="screen",
        ),

        Node(
            package="rosbridge_server",
            executable="rosbridge_websocket",
            name="rosbridge_websocket",
            parameters=[{"port": LaunchConfiguration("ws_port")}],
            output="screen",
        ),
    ])
