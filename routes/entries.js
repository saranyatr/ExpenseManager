const express = require('express');
const router = express.Router();
const Entry = require('../models/Entry');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Middleware to check authentication
const authenticate = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/login');
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.redirect('/login');
        }
        req.user = user;
        next();
    });
};

// Add Entry Route
router.post('/add-entry', authenticate, async (req, res) => {
    try {
        const { remark, date, amount, type } = req.body;
        const entry = new Entry({
            user_id: mongoose.Types.ObjectId(req.user.id),
            remark,
            date,
            amount,
            type
        });
        await entry.save();
        res.redirect('/dashboard');
    } catch (err) {
        res.status(400).send('Error adding entry');
    }
});

// Analysis Route
router.get('/analysis', authenticate, async (req, res) => {
    try {
        const entries = await Entry.aggregate([
            { $match: { user_id: mongoose.Types.ObjectId(req.user.id) } },
            { $group: { _id: "$remark", totalAmount: { $sum: "$amount" } } }
        ]);
        res.render('analysis', { entries });
    } catch (err) {
        res.status(400).send('Error fetching analysis');
    }
});

module.exports = router;
