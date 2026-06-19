# Embed Foxglove in Control

We will replace the axis-based control map with a real embedded Foxglove Web/Studio interface on `/control` if embedding is technically possible, connected to `ws://10.10.220.180:8765` through `foxglove_bridge`. Foxglove is the chosen operational map surface because it already supports ROS map visualization patterns used by the M3Pro course, while mission creation and robot commands remain mediated by the Health Robot application and backend security model.

## Consequences

- `/control` becomes the operational mission page, while `/map` remains the mapping/admin page.
- The application must treat Foxglove as visualization only, not as the owner of mission state or mission commands.
- The Foxglove bridge is an explicit exception to the usual frontend/backend boundary for visualization; mission commands must still go through the backend.
- Mission creation, reusable annotated points, and delivery workflow remain Health Robot domain concepts.
