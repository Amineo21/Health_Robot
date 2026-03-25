import { Router, type IRouter } from "express";
import {
  GetMissionsResponse,
  CreateMissionBody,
  UpdateMissionStatusBody,
  UpdateMissionStatusResponse,
} from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

type Mission = {
  id: string;
  type: "medical_delivery" | "meal_distribution";
  destination: string;
  status: "pending" | "in_progress" | "completed" | "cancelled" | "failed";
  priority: "low" | "medium" | "high" | "urgent";
  notes: string | null;
  startTime: string | null;
  completedTime: string | null;
  createdAt: string;
};

let missions: Mission[] = [
  {
    id: "MSN-001",
    type: "medical_delivery",
    destination: "Room 203",
    status: "completed",
    priority: "high",
    notes: "Medical kit delivery - urgent supplies",
    startTime: new Date(Date.now() - 3600000).toISOString(),
    completedTime: new Date(Date.now() - 3000000).toISOString(),
    createdAt: new Date(Date.now() - 4000000).toISOString(),
  },
  {
    id: "MSN-002",
    type: "meal_distribution",
    destination: "Floor 2",
    status: "completed",
    priority: "medium",
    notes: "Lunch distribution - diabetic meal",
    startTime: new Date(Date.now() - 7200000).toISOString(),
    completedTime: new Date(Date.now() - 6600000).toISOString(),
    createdAt: new Date(Date.now() - 7800000).toISOString(),
  },
  {
    id: "MSN-003",
    type: "medical_delivery",
    destination: "Room 105",
    status: "in_progress",
    priority: "urgent",
    notes: "Medication delivery - pain management",
    startTime: new Date(Date.now() - 600000).toISOString(),
    completedTime: null,
    createdAt: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: "MSN-004",
    type: "meal_distribution",
    destination: "Room 301",
    status: "pending",
    priority: "low",
    notes: "Dinner delivery",
    startTime: null,
    completedTime: null,
    createdAt: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "MSN-005",
    type: "medical_delivery",
    destination: "Room 412",
    status: "completed",
    priority: "medium",
    notes: null,
    startTime: new Date(Date.now() - 9000000).toISOString(),
    completedTime: new Date(Date.now() - 8400000).toISOString(),
    createdAt: new Date(Date.now() - 9600000).toISOString(),
  },
  {
    id: "MSN-006",
    type: "meal_distribution",
    destination: "Room 207",
    status: "failed",
    priority: "medium",
    notes: "Room was locked - resident in therapy",
    startTime: new Date(Date.now() - 5400000).toISOString(),
    completedTime: null,
    createdAt: new Date(Date.now() - 6000000).toISOString(),
  },
];

let missionCounter = 7;

router.get("/", (_req, res) => {
  const data = GetMissionsResponse.parse(missions);
  res.json(data);
});

router.post("/", (req, res) => {
  const body = CreateMissionBody.parse(req.body);
  const newMission: Mission = {
    id: `MSN-${String(missionCounter++).padStart(3, "0")}`,
    type: body.type,
    destination: body.destination,
    status: "pending",
    priority: body.priority,
    notes: body.notes ?? null,
    startTime: null,
    completedTime: null,
    createdAt: new Date().toISOString(),
  };
  missions.push(newMission);
  res.status(201).json(newMission);
});

router.patch("/:id", (req, res) => {
  const { id } = req.params;
  const body = UpdateMissionStatusBody.parse(req.body);

  const mission = missions.find((m) => m.id === id);
  if (!mission) {
    res.status(404).json({ error: "Mission not found" });
    return;
  }

  mission.status = body.status;

  if (body.status === "in_progress" && !mission.startTime) {
    mission.startTime = new Date().toISOString();
  }
  if (body.status === "completed" || body.status === "failed" || body.status === "cancelled") {
    mission.completedTime = new Date().toISOString();
  }

  const data = UpdateMissionStatusResponse.parse(mission);
  res.json(data);
});

export default router;
