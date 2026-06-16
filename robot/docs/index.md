---
title: Home
nav_order: 1
---

# M3 Pro Robotics Course

Hands-on ROS 2 course for the **Yahboom ROSMASTER M3 Pro**: a mecanum-wheel
mobile robot with two 2D lidars, an RGB-D camera, an IMU and a 6-axis arm
with a gripper.

This site collects **recipes**: short, copy-paste workflows for the things
you actually do in the lab. Pick a language below.

[Read in English](en.html){: .btn .btn-primary .mr-2 }
[Lire en francais](fr.html){: .btn }

---

## What you will find here

| Topic | English | Francais |
| --- | --- | --- |
| Connect to the robot | [Getting started](en/getting-started.html) | [Demarrage](fr/demarrage.html) |
| Mapping and autonomous navigation | [Navigation](en/navigation.html) | [Navigation](fr/navigation.html) |
| Control the 6-axis arm | [Arm control](en/arm.html) | [Bras](fr/bras.html) |
| Run the whole stack together | [Integration](en/integration.html) | [Integration](fr/integration.html) |
| Web dashboard, Foxglove, RViz | [Dashboard](en/dashboard.html) | [Tableau de bord](fr/tableau-de-bord.html) |
| Copy-paste code snippets | [Recipes](en/recipes.html) | [Recettes](fr/recettes.html) |
| Fix common errors | [Troubleshooting](en/troubleshooting.html) | [Depannage](fr/depannage.html) |

## The robot in one picture

```text
                 RGB-D camera            6-axis arm + gripper
                      |                        |
   front lidar  --[  ROSMASTER M3 Pro  ]--  rear lidar
                      |
              4 mecanum wheels (omnidirectional)
                      |
        STM32 MCU  <-->  Jetson (ROS 2 Humble, Docker)
```

- **MCU (STM32):** wheels, IMU, battery, LED, buzzer. Talks to ROS through
  the micro-ROS agent.
- **Jetson:** runs ROS 2 Humble inside a Docker container. All course nodes
  run here.
- **Your laptop:** runs RViz, Foxglove or a browser to watch and command
  the robot over the network.
