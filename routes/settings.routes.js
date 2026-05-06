const express = require('express');
const bcrypt = require('bcrypt');
const { User } = require('../models/crm');

const router = express.Router();

router.get('/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    const { password, refreshToken, ...profile } = user || {};
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.patch('/profile', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true, runValidators: true }).lean();
    const { password, refreshToken, ...profile } = user || {};
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.patch('/password', async (req, res, next) => {
  try {
    const password = await bcrypt.hash(req.body.newPassword, 12);
    await User.findByIdAndUpdate(req.user.id, { password });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/preferences', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('preferences').lean();
    res.json(user?.preferences || {});
  } catch (error) {
    next(error);
  }
});

router.patch('/preferences', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { preferences: req.body }, { new: true }).lean();
    res.json(user.preferences || {});
  } catch (error) {
    next(error);
  }
});

module.exports = router;
