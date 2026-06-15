# Base ROS2 Humble sur Ubuntu 22.04 (compatible Jetson avec NVIDIA L4T)
FROM ros:humble-ros-base

# Dépendances système
RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-colcon-common-extensions \
    python3-rosdep \
    ros-humble-nav2-bringup \
    ros-humble-nav2-msgs \
    ros-humble-slam-toolbox \
    ros-humble-cv-bridge \
    libopencv-dev \
    python3-opencv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /robot_ws

# Copier les packages ROS2
COPY src/ src/

# Initialiser rosdep et installer les dépendances des packages
RUN rosdep init || true && \
    rosdep update && \
    rosdep install --from-paths src --ignore-src -r -y

# Compiler le workspace
RUN /bin/bash -c "source /opt/ros/humble/setup.bash && colcon build --symlink-install"

# Copier les configs et launch files
COPY config/ config/
COPY launch/ launch/
COPY maps/ maps/

# Script d'entrée — source ROS2 + notre workspace, puis lance les nodes
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["ros2", "launch", "/robot_ws/launch/navigation.launch.py"]
