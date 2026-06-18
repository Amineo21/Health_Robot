# setup/ - Instructor and lab-setup scripts

> These scripts are for **instructors and lab technicians** preparing a
> robot. They are **not** part of the student exercises. Students do not
> need to run anything in this folder. The exercises assume the robot is
> already prepared.

All scripts are run **from a Mac or Linux machine on the same network as
the robot**, unless noted otherwise. They reach the robot over SSH as
`jetson@<robot-ip>`. Pass the robot IP as the first argument or via the
`ROBOT_HOST` environment variable.

## Robot preparation (run once per robot)

| Script | What it does |
| --- | --- |
| `deploy_workspace_to_robot.sh` | Copy this workspace to the robot and build it inside the Docker container. |
| `install_microros_service.sh` | Install the micro-ROS agent as an auto-restarting Docker service (MCU bridge). |
| `install_persistence.sh` | Make the full robot stack survive reboots (autostart container + saved maps). |
| `setup_container_bashrc.sh` | Configure the ROS environment inside the container (`ROS_DOMAIN_ID`, sourcing). |
| `setup_vnc_on_robot.sh` | Configure a VNC server on the robot so RViz can be viewed remotely. |
| `setup_wifi_events.sh` | Install Wi-Fi connect/disconnect hooks on the Jetson. |

## Day-to-day operation

| Script | What it does |
| --- | --- |
| `Docker_M3Pro_Joy.sh` | Host-side autostart that (re)creates the `m3pro` container. |
| `container_autostart.sh` | Runs inside the container as PID 1, launches bringup + camera + SLAM/Nav2 + dashboard. |
| `restart_microros_agent.sh` | Restart the micro-ROS agent and verify `/battery` comes back. |
| `start_agent.sh` | Minimal start of the micro-ROS agent container. |
| `docker_exec_ros.sh` | Open a shell inside the robot's ROS container. |
| `start_slam_nav_on_robot.sh` | Start SLAM / Nav2 / localize on the robot from your Mac. |
| `start_camera_on_robot.sh` | Start the camera node only. |
| `start_live_showcase_on_robot.sh` | Start the live sensor-fusion showcase. |
| `start_sim_showcase_on_robot.sh` | Start the showcase in simulated-sensor mode. |
| `stop_showcase_on_robot.sh` | Stop the showcase nodes. |

## Container images

The micro-ROS agent defaults to the public image `microros/micro-ros-agent:humble`.
The robot base image (`rosmaster-m3pro-nano`) is platform-specific. If your lab
uses a private registry, override the image with an environment variable:

```bash
AGENT_IMAGE=<registry-host>:5000/micro-ros-agent:humble ./setup/restart_microros_agent.sh <robot-ip>
ROBOT_IMAGE=<registry-host>:5000/rosmaster-m3pro-nano:1.1.0   # used by Docker_M3Pro_Joy.sh
```

## Network defaults

- The robot is reached as `jetson@<robot-ip>` over SSH.
- ROS uses `ROS_DOMAIN_ID=30` and `FASTDDS_BUILTIN_TRANSPORTS=UDPv4`.
- Example lab IPs in the scripts (`192.168.50.x`) are placeholders. Pass the
  real IP as the first argument.
