from setuptools import setup

package_name = 'obstacle_avoidance'

setup(
    name=package_name,
    version='0.1.0',
    packages=[package_name],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Daniel Komoe',
    maintainer_email='danielkomoe78@gmail.com',
    description='Obstacle avoidance node for Health Robot',
    license='MIT',
    entry_points={
        'console_scripts': [
            'obstacle_avoidance_node = obstacle_avoidance.obstacle_avoidance_node:main',
        ],
    },
)
