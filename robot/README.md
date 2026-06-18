# M3 Pro Robotics Course

Hands-on ROS 2 course for the **Yahboom ROSMASTER M3 Pro**: a mecanum-wheel
mobile robot with two 2D lidars, an RGB-D camera, an IMU, and a 6-axis arm
with a gripper. The robot runs ROS 2 Humble inside a Docker container on a
Jetson.

## Documentation

The full course documentation is published with GitHub Pages, in English
and French:

**https://pandormedia.github.io/m3pro-robotics-course/**

It covers recipes for mapping and autonomous navigation, controlling the
arm, running the whole stack together, the web dashboard, Foxglove and
RViz, plus a code-snippet cookbook and a troubleshooting guide.

The `docs/` folder holds the source of that site.

## Repository layout

```text
docs/                       Documentation site (English + French), published via GitHub Pages
src/
  m3pro_teacher_demos        TF, URDF joint bridge, sensor-fusion demo nodes
  m3pro_teacher_description  Teaching URDF, RViz config, frames
  m3pro_teacher_nav          SLAM and Nav2 configuration and launch files
  m3pro_teacher_vision       Color detection and pick-and-place with the arm
  m3pro_teacher_watchdog     Supervisor for the launch stack
  m3pro_teacher_web          Browser dashboard (HTTP + rosbridge)
  m-explore-ros2             Frontier exploration (vendored, BSD licensed, see its LICENSE)
setup/                       Instructor and lab-setup scripts (see setup/README.md)
```

The repository also ships the detailed French course documents at the root:

- `ROS2_CE_QUIL_FAUT_SAVOIR.md` - ROS 2 essentials.
- `COURS_NAV2_DECOUVERTE.md` - Nav2 concepts.
- `EXO_NAV2.md`, `EXO_SLAM_NAV_BRAS.md` - graded exercises.
- `TUTO_DISCOVERY.md`, `TUTO_SLAM_NAV_BRINGUP.md` - step-by-step tutorials.
- `SNIPPETS_*.md` - annotated code extracts per package.

## Quick start

The robot software is built in three layers. Always start from the bottom.

```bash
# On the robot, inside the m3pro Docker container:
source /opt/ros/humble/setup.bash
source /root/m3pro_teacher_ws/install/setup.bash

# Layer 2: hardware bringup (must run before anything else)
ros2 launch slam_mapping bringup.launch.py

# Layer 3: an exercise, for example SLAM + Nav2
ros2 launch m3pro_teacher_nav slam_and_nav.launch.py
```

See the [Getting started](https://pandormedia.github.io/m3pro-robotics-course/en/getting-started.html)
page for the full procedure.

## Building the workspace

```bash
cd /root/m3pro_teacher_ws
colcon build --symlink-install
source install/setup.bash
```

## For instructors

Robot preparation and lab-setup scripts live in `setup/`. They are not part
of the student exercises. See `setup/README.md`.

## License

The `src/m-explore-ros2` package is third-party code under its own BSD
license (see `src/m-explore-ros2/LICENSE`). All other content is course
material owned by PANDOR Media.
