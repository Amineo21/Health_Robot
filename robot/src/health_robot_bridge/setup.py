from glob import glob
from setuptools import setup

package_name = 'health_robot_bridge'

setup(
    name=package_name,
    version='0.1.0',
    packages=[package_name],
    data_files=[
        ('share/ament_index/resource_index/packages', [f'resource/{package_name}']),
        (f'share/{package_name}', ['package.xml']),
        (f'share/{package_name}/launch', glob('launch/*.launch.py')),
    ],
    install_requires=['setuptools', 'paho-mqtt'],
    zip_safe=True,
    maintainer='Health Robot Team',
    maintainer_email='ehoura@example.com',
    description='MQTT to ROS2 bridge for Health Robot commands and telemetry',
    license='MIT',
    entry_points={
        'console_scripts': [
            'mqtt_ros_bridge_node = health_robot_bridge.mqtt_ros_bridge_node:main',
        ],
    },
)
