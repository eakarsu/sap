const express = require('express');

const router = express.Router();

router.post('/score', (req, res) => {
  const approvals = req.body?.approvals;
  if (!Array.isArray(approvals) || approvals.length === 0) {
    return res.status(400).json({ error: 'A non-empty approvals array is required' });
  }
  const scored = approvals.map((item) => {
    const exposure = Math.round(Number(item.value || 0) * (Number(item.daysWaiting || 0) / 30) * (1 + Number(item.approverLoad || 0) / 20));
    return {
      id: item.id || 'approval',
      exposure,
      priority: exposure > 25000 ? 'critical' : exposure > 8000 ? 'watch' : 'normal',
      action: exposure > 25000 ? 'delegate approver or trigger escalation' : 'keep in queue',
    };
  });
  res.json({ scored, totalExposure: scored.reduce((sum, row) => sum + row.exposure, 0) });
});

module.exports = router;
