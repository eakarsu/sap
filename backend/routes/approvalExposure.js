const express = require('express');

const router = express.Router();

router.post('/score', (req, res) => {
  const approvals = Array.isArray(req.body?.approvals)
    ? req.body.approvals
    : [
        { id: 'PO-1009', value: 82000, daysWaiting: 6, approverLoad: 14 },
        { id: 'INV-228', value: 12000, daysWaiting: 2, approverLoad: 4 },
      ];
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
