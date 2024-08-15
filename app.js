const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

dotenv.config();
const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.log(err));

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Set views directory
app.set('views', path.join(__dirname, 'views'));

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// User Model
const User = mongoose.model('User', new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userId: { type: Number, required: true, unique: true }
}));

// Entry Model
const Entry = mongoose.model('Entry', new mongoose.Schema({
    remark: { type: String, required: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['Expense', 'Income'], required: true },
    userId: { type: Number, required: true }
}));

// Counter model
const Counter = mongoose.model('Counter', new mongoose.Schema({
    _id: { type: String, required: true },
    sequence_value: { type: Number, default: 0 }
}));

// Middleware to authenticate JWT token
const authenticateJWT = (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).send('Forbidden');
            }
            req.user = user; // Attach user info to request
            next();
        });
    } else {
        res.status(401).send('Unauthorized');
    }
};

// Register Route
app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find or create the counter document
        let counter = await Counter.findById('userIdCounter');
        if (!counter) {
            counter = new Counter({ _id: 'userIdCounter', sequence_value: 0 });
            await counter.save();
        }

        // Increment the user ID
        const userId = counter.sequence_value + 1;
        counter.sequence_value = userId;
        await counter.save();

        // Hash the password and create a new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword, userId });
        await user.save();

        res.redirect('/login');
    } catch (err) {
        res.status(400).send('Error creating user');
    }
});

// Login Route
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(400).send('Invalid email or password');
        }
        const token = jwt.sign({ id: user._id, userId: user.userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true });
        res.redirect('/dashboard');
    } catch (err) {
        res.status(400).send('Error logging in');
    }
});

// Add Entry Route
app.post('/add-entry', authenticateJWT, async (req, res) => {
    try {
        const { remark, date, amount, type } = req.body;
        const userId = req.user.userId; // Get userId from JWT
        const entry = new Entry({ remark, date, amount, type, userId });
        await entry.save();
        res.redirect('/dashboard'); // Redirect to dashboard or another page after saving
    } catch (err) {
        res.status(400).send('Error saving entry');
    }
});

// Home Page Route
app.get('/', (req, res) => {
    res.render('login', { title: 'Login' });
});

// Register Page Route
app.get('/register', (req, res) => {
    res.render('register', { title: 'Register' });
});

// Dashboard Route
app.get('/dashboard', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.userId; // Get userId from JWT
        const selectedYear = parseInt(req.query.year) || new Date().getFullYear();
        const selectedMonth = parseInt(req.query.month) || new Date().getMonth() + 1;

        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        const years = await Entry.distinct("date", { type: "Expense", userId });

        const entries = await Entry.aggregate([
            {
                $match: {
                    type: "Expense",
                    userId,
                    $expr: {
                        $and: [
                            { $eq: [{ $month: "$date" }, selectedMonth] },
                            { $eq: [{ $year: "$date" }, selectedYear] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: { remark: "$remark" },
                    totalAmount: { $sum: "$amount" }
                }
            },
            {
                $sort: { "_id.remark": 1 }
            }
        ]);

        const totalAmount = entries.reduce((sum, entry) => sum + entry.totalAmount, 0).toFixed(2);
        const monthlySummary = entries.map(entry => ({
            remark: entry._id.remark,
            totalAmount: entry.totalAmount.toFixed(2)
        }));

        res.render('dashboard', { 
            title: 'Dashboard', 
            monthlySummary,
            selectedYear,
            selectedMonth,
            years: [...new Set(years.map(date => new Date(date).getFullYear()))],
            months: monthNames,
            totalAmount
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Analysis Page Route
app.get('/analysis', authenticateJWT, async (req, res) => {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const remarks = [
        'Grocery', 'Food', 'Fuel', 'Personal Shopping', 'Hospital & Pharmacy'
    ];

    const userId = req.user.userId; // Get userId from JWT
    const year = req.query.year || '';
    const monthIndex = req.query.month || '';
    const remark = req.query.remark || '';

    let query = { userId }; // Filter by userId

    if (year) {
        query.date = { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) };
    }
    if (monthIndex) {
        const month = parseInt(monthIndex);
        query.date = { 
            $gte: new Date(`${year}-${month}-01`), 
            $lt: new Date(`${year}-${month + 1}-01`) 
        };
    }
    if (remark) {
        query.remark = remark;
    }

    try {
        const entries = await Entry.find(query).sort({ date: -1 }).exec();
        res.render('analysis', {
            months,
            entries,
            year,
            monthIndex,
            remark,
            remarks
        });
    } catch (err) {
        console.error('Error fetching entries:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Add Entry Page Route
app.get('/add-entry', authenticateJWT, (req, res) => {
    res.render('add-entry', { title: 'Add Entry', type: null });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
