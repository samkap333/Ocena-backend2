const express = require('express');
const router = express.Router();   
const User = require('../models/user');

router.post('/contact-info-user', async (req, res) => {
    try {
        let user = new User({
            name: req.body.name,
            phoneNumber: req.body.phoneNumber,
            email: req.body.email,
            subject: req.body.subject,
            message: req.body.message
        });

        const doc = await user.save();
        res.status(201).json(doc);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/contact-info-user', async (req, res) => {
    const doc = await User.find({});
    res.json(doc);
});

module.exports = router;