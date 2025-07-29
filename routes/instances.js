const express = require("express");
const router = express.Router();
const awsService = require("../services/awsServices");

// POST /instances - Launch VM
router.post("/create", async (req, res) => {
  const result = await awsService.createInstance(req.body);
  res.json(result);
});

router.post("/:id/start", async (req, res) => {
  const output = await awsService.startSSMSession(req.params.id);
  res.json(output);
});

router.post("/:id/stop", async (req, res) => {
  const output = await awsService.stopInstance(req.params.id);
  res.json(output);
});

router.post("/:id/pause", async (req, res) => {
  const output = await awsService.hibernateInstance(req.params.id);
  res.json(output);
});


router.post('/connect', async (req, res) => {
  const { instanceId, command } = req.body;

  try {
    const result = await awsService.sendCommandToInstance(instanceId, command);
    res.json(result);
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: err.message || "Unexpected error" });
  }
});

module.exports = router;
