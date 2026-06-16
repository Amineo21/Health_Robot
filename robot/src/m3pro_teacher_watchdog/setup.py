from setuptools import setup

package_name = "m3pro_teacher_watchdog"

setup(
    name=package_name,
    version="0.1.0",
    packages=[package_name],
    data_files=[
        ("share/ament_index/resource_index/packages", [f"resource/{package_name}"]),
        (f"share/{package_name}", ["package.xml"]),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="Teacher",
    maintainer_email="teacher@example.com",
    description="Launch supervisor for the M3 Pro teacher stack.",
    license="MIT",
    entry_points={
        "console_scripts": [
            "watchdog_node = m3pro_teacher_watchdog.watchdog_node:main",
        ],
    },
)
