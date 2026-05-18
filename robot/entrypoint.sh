#!/bin/bash
set -e

# Source ROS2
source /opt/ros/humble/setup.bash

# Source notre workspace compilé
source /robot_ws/install/setup.bash

exec "$@"
