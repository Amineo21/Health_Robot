from setuptools import setup

package_name = 'vision'

setup(
    name=package_name,
    version='0.1.0',
    packages=[package_name],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Daniel Komoe',
    maintainer_email='danielkomoe78@gmail.com',
    description='Vision node for Health Robot',
    license='MIT',
    entry_points={
        'console_scripts': [
            'vision_node = vision.vision_node:main',
        ],
    },
)
