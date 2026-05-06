const express = require('express');
const { Notification } = require('../models/crm');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const data = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    return res.json(notification);
  } catch (error) {
    next(error);
  }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user.id }, { read: true });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/preferences', (req, res) => res.json({}));
router.patch('/preferences', (req, res) => res.json(req.body));

module.exports = router;
