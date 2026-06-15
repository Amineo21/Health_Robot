from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare
import os


def generate_launch_description():
    # Chemin vers les configs
    config_dir = os.path.join(os.path.dirname(__file__), '..', 'config')
    nav2_params = os.path.join(config_dir, 'nav2_params.yaml')
    map_file = DeclareLaunchArgument(
        'map',
        default_value=os.path.join(os.path.dirname(__file__), '..', 'maps', 'ehpad_map.yaml'),
        description='Chemin vers la carte SLAM sauvegardée'
    )

    # Bridge MQTT ↔ ROS2
    mqtt_bridge_node = Node(
        package='mqtt_bridge',
        executable='mqtt_bridge_node',
        name='mqtt_bridge_node',
        output='screen',
    )

    # Node de navigation (notre code)
    navigation_node = Node(
        package='navigation',
        executable='navigation_node',
        name='navigation_node',
        output='screen',
    )

    # Node d'évitement d'obstacles
    obstacle_avoidance_node = Node(
        package='obstacle_avoidance',
        executable='obstacle_avoidance_node',
        name='obstacle_avoidance_node',
        output='screen',
    )

    # Node de vision (classification obstacles)
    vision_node = Node(
        package='vision',
        executable='vision_node',
        name='vision_node',
        output='screen',
    )

    # Nav2 — stack complète de navigation autonome
    nav2 = IncludeLaunchDescription(
        PathJoinSubstitution([
            FindPackageShare('nav2_bringup'),
            'launch',
            'bringup_launch.py'
        ]),
        launch_arguments={
            'map': LaunchConfiguration('map'),
            'params_file': nav2_params,
            'use_sim_time': 'false',
        }.items()
    )

    return LaunchDescription([
        map_file,
        mqtt_bridge_node,
        navigation_node,
        obstacle_avoidance_node,
        vision_node,
        nav2,
    ])
