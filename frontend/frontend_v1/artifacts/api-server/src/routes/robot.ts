import { Router, type IRouter } from "express";
import { GetRobotStatusResponse } from "@workspace/api-zod";

const router: IRouter = Router();

let robotState = {
  status: "idle" as "idle" | "moving" | "charging" | "delivering" | "error",
  battery: 78,
  positionX: 120,
  positionY: 85,
  speed: 0,
  connectionQuality: 95,
  activeMission: null as string | null,
  deliveriesToday: 7,
  lastUpdated: new Date().toISOString(),
};

let lastUpdate = Date.now();

function updateRobotState() {
  const now = Date.now();
  const elapsed = (now - lastUpdate) / 1000;
  lastUpdate = now;

  if (robotState.status === "charging") {
    robotState.battery = Math.min(100, robotState.battery + 0.5 * elapsed);
    if (robotState.battery >= 100) {
      robotState.status = "idle";
    }
  } else if (robotState.status === "idle" || robotState.status === "moving" || robotState.status === "delivering") {
    robotState.battery = Math.max(0, robotState.battery - 0.05 * elapsed);
    if (robotState.battery < 15) {
      robotState.status = "charging";
    }
  }

  if (robotState.status === "moving" || robotState.status === "delivering") {
    robotState.positionX += (Math.random() - 0.5) * 2;
    robotState.positionY += (Math.random() - 0.5) * 2;
    robotState.positionX = Math.max(0, Math.min(500, robotState.positionX));
    robotState.positionY = Math.max(0, Math.min(400, robotState.positionY));
    robotState.speed = 0.5 + Math.random() * 0.5;
  } else {
    robotState.speed = 0;
  }

  robotState.connectionQuality = 90 + Math.random() * 10;
  robotState.lastUpdated = new Date().toISOString();
}

router.get("/status", (_req, res) => {
  updateRobotState();
  const data = GetRobotStatusResponse.parse(robotState);
  res.json(data);
});

export default router;
