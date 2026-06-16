from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    mqtt_host = LaunchConfiguration('mqtt_host')
    mqtt_port = LaunchConfiguration('mqtt_port')
    base_x = LaunchConfiguration('base_x')
    base_y = LaunchConfiguration('base_y')
    base_yaw = LaunchConfiguration('base_yaw')

    return LaunchDescription([
        DeclareLaunchArgument('mqtt_host', default_value='localhost'),
        DeclareLaunchArgument('mqtt_port', default_value='1883'),
        DeclareLaunchArgument('base_x', default_value='0.0'),
        DeclareLaunchArgument('base_y', default_value='0.0'),
        DeclareLaunchArgument('base_yaw', default_value='0.0'),
        Node(
            package='health_robot_bridge',
            executable='mqtt_ros_bridge_node',
            name='health_robot_mqtt_ros_bridge',
            output='screen',
            parameters=[{
                'mqtt_host': mqtt_host,
                'mqtt_port': mqtt_port,
                'base_x': base_x,
                'base_y': base_y,
                'base_yaw': base_yaw,
            }],
        ),
    ])
