const express = require('express');
const router = express.Router();
const Email = require('../models/email');


router.post('/contact-email',async(req,res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Create a new Email document and save it to the database
        const newEmail = new Email({ email });
        const savedEmail = await newEmail.save();

        res.status(201).json({ message: 'Email saved successfully', email: savedEmail });
    } catch (error) {
        console.error('Error saving email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/contact-email', async (req, res) => {
    try {
        const emails = await Email.find({});
        res.json(emails);
    } catch (error) {
        console.error('Error fetching emails:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

