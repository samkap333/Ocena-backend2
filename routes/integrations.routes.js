const express = require('express');
const { SheetConnection } = require('../models/crm');

const router = express.Router();

router.get('/', (req, res) => res.json({ data: [] }));
router.post('/connect', (req, res) => res.status(201).json({ id: req.body.type, ...req.body, status: 'connected' }));
router.post('/:id/disconnect', (req, res) => res.json({ id: req.params.id, status: 'disconnected' }));
router.post('/:id/test', (req, res) => res.json({ id: req.params.id, ok: true }));

router.get('/sheets', async (req, res, next) => {
  try {
    const data = await SheetConnection.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).lean();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/sheets/connect', async (req, res, next) => {
  try {
    const sheetId = req.body.sheetId || req.body.sheetUrl?.split('/d/')[1]?.split('/')[0];
    const connection = await SheetConnection.create({ ...req.body, sheetId, tenantId: req.tenantId });
    res.status(201).json(connection);
  } catch (error) {
    next(error);
  }
});

router.get('/sheets/:id', async (req, res, next) => {
  try {
    const connection = await SheetConnection.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
    if (!connection) return res.status(404).json({ message: 'Sheet connection not found' });
    return res.json(connection);
  } catch (error) {
    return next(error);
  }
});

router.post('/sheets/:id/sync', async (req, res, next) => {
  try {
    const connection = await SheetConnection.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { lastSync: new Date(), status: 'connected' },
      { new: true }
    );
    if (!connection) return res.status(404).json({ message: 'Sheet connection not found' });
    res.json(connection);
  } catch (error) {
    next(error);
  }
});

router.delete('/sheets/:id', async (req, res, next) => {
  try {
    const deleted = await SheetConnection.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!deleted) return res.status(404).json({ message: 'Sheet connection not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/sheets/:id/import', (req, res) => res.json({ imported: 0 }));
router.post('/sheets/:id/export', (req, res) => res.json({ exported: 0 }));

module.exports = router;
