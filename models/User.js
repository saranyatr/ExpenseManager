const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    sequence: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', CounterSchema);

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userId: { type: Number, required: true, unique: true }
});

// Pre-save hook for generating a unique userId
UserSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    if (this.isNew) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: 'userId' },
            { $inc: { sequence: 1 } },
            { new: true, upsert: true }
        );
        this.userId = counter.sequence;
    }
    next();
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
