const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register Route
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = new User({ email, password });
        await user.save();
        res.redirect('/login');
    } catch (err) {
        res.status(400).send('Error creating user');
    }
});

// Login GET Route (to render the login page)
router.get('/login', (req, res) => {
    res.render('login'); 
});
// Login GET Route (to render the login page)
router.get('/register', (req, res) => {
    res.render('register'); 
});

// Login POST Route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(400).send('Invalid email or password');
        }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true });
        res.redirect('/dashboard');
    } catch (err) {
        res.status(400).send('Error logging in');
    }
});

module.exports = router;
