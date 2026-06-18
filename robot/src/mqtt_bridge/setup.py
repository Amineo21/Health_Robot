from setuptools import setup

package_name = 'mqtt_bridge'

setup(
    name=package_name,
    version='0.1.0',
    packages=[package_name],
    install_requires=['setuptools', 'paho-mqtt'],
    zip_safe=True,
    maintainer='Daniel Komoe',
    maintainer_email='danielkomoe78@gmail.com',
    description='MQTT ↔ ROS2 bridge for Health Robot',
    license='MIT',
    entry_points={
        'console_scripts': [
            'mqtt_bridge_node = mqtt_bridge.mqtt_bridge_node:main',
        ],
    },
)
