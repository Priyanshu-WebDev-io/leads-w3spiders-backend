const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    // Job identification
    job_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Job status
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending',
        index: true
    },

    // Input data
    queries: [{
        type: String,
        required: true
    }],

    // Results
    results_count: {
        type: Number,
        default: 0
    },
    new_businesses: {
        type: Number,
        default: 0
    },
    updated_businesses: {
        type: Number,
        default: 0
    },

    // Filtration Analytics
    filtration_stats: {
        processed: { type: Number, default: 0 },
        passed: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        reasons: { type: Map, of: Number, default: {} }
    },

    // Timing
    started_at: Date,
    completed_at: Date,
    duration_seconds: Number,

    // Error handling
    error_message: String,

    // Cloudinary storage
    cloudinary_url: String,
    cloudinary_public_id: String,

    // Trigger information
    triggered_by: {
        type: String,
        enum: ['admin', 'scheduler'],
        required: true
    },

    // Configuration used (flexible to support various scraper configs)
    config: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Metadata for filtering
    metadata: {
        location: String,
        category: String,
        tags: [String]
    },

    // Ownership
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    }
}, {
    timestamps: true
});

// Index for querying recent jobs
jobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);
