const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['one-time'],
        default: 'one-time'
    },
    scheduled_time: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'active', 'cancelled'],
        default: 'pending'
    },
    queries: [{
        type: String,
        required: true
    }],
    metadata: {
        location: String,
        category: String,
        tags: [String]
    },
    is_active: {
        type: Boolean,
        default: true
    },
    config: {
        max_results: Number,
        depth: Number,
        email_extraction: Boolean
    },
    last_run: Date,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Schedule', scheduleSchema);
