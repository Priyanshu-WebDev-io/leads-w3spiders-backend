const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
    // Unique identifier from Google Maps
    place_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Basic requirements
    name: {
        type: String,
        required: true
    },

    // Standardized Fields
    address: String,
    city: String,
    state: String,
    zip: String,
    country: String,

    phone: String,
    international_phone: String,
    website: String,
    domain: String, // extracted from website

    emails: [String],
    social_profiles: {
        facebook: String,
        instagram: String,
        twitter: String,
        linkedin: String,
        youtube: String,
        tiktok: String
    },

    category: String,
    additional_categories: [String],

    rating: Number,
    review_count: Number,

    latitude: Number,
    longitude: Number,

    working_hours: mongoose.Schema.Types.Mixed,
    images: [mongoose.Schema.Types.Mixed],

    // Data Lineage
    sources: [{
        _id: false,
        type: {
            type: String,
            enum: ['google_places', 'scraper']
        }
    }],

    // Audit Report
    audit_report: {
        generated_at: Date,
        insights: Object, // Raw PageSpeed data
        pdf_path: String,
        status: {
            type: String,
            enum: ['not_generated', 'pending', 'completed', 'failed'],
            default: 'not_generated'
        },
        public_url: String
    },

    // References to Raw Data (for debugging/audit)
    raw_references: [{
        source: String, // 'google_places' | 'scraper'
        raw_id: mongoose.Schema.Types.ObjectId // Reference to GooglePlaceRaw or ScraperRaw
    }],

    // CRM Status
    status: {
        type: String,
        enum: ['unfiltered', 'new', 'interested', 'converted', 'closed', 'rejected'],
        default: 'unfiltered',
        index: true
    },

    // User Remarks
    remarks: {
        type: String,
        default: ''
    },

    // Metadata
    first_seen: {
        type: Date,
        default: Date.now
    },
    last_updated: {
        type: Date,
        default: Date.now
    },

    // Ownership
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    }
}, {
    timestamps: true,
    strict: true // Enforce schema to avoid dumping
});

// Index for geospatial queries (if latitude/longitude exist in data)
businessSchema.index({ latitude: 1, longitude: 1 });

// Index for search (if fields exist in data)
businessSchema.index({ name: 'text', category: 'text', address: 'text' });

// Update last_updated on save
businessSchema.pre('save', function (next) {
    this.last_updated = new Date();
    next();
});

module.exports = mongoose.model('Business', businessSchema);
