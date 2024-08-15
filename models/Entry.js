const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
    remark: { type: String, required: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['Expense', 'Income'], required: true }
});

const Entry = mongoose.model('Entry', entrySchema);
module.exports = Entry;
