from setuptools import setup

package_name = 'mission_recovery'

setup(
    name=package_name,
    version='0.1.0',
    packages=[package_name],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Daniel Komoe',
    maintainer_email='danielkomoe78@gmail.com',
    description='Recuperation autonome de la fourniture au point de stock (scan + bras M3 Pro)',
    license='MIT',
    entry_points={
        'console_scripts': [
            'mission_recovery_node = mission_recovery.mission_recovery_node:main',
        ],
    },
)
