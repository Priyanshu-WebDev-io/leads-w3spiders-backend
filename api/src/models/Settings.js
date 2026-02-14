const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    key: {
        type: String, // 'global' or specific service
        required: true,
        unique: true
    },
    max_concurrent_jobs: {
        type: Number,
        default: 1
    },
    default_max_results: {
        type: Number,
        default: 70
    },
    scraping_interval_min: { // minimum minutes between queries to avoid bans
        type: Number,
        default: 0
    },
    email_extraction_enabled: {
        type: Boolean,
        default: false
    },
    data_provider: {
        type: String,
        enum: ['scraper', 'google_places'],
        default: 'scraper'
    },
    google_places_config: {
        api_key: String,
        enabled: { type: Boolean, default: false },
        daily_limit: { type: Number, default: 50 }, // Safe for Free Tier (~$200 credit / ~$35 per k = ~5700 calls/mo)
        calls_today: { type: Number, default: 0 },
        last_reset_date: { type: Date, default: Date.now },
        fallback_to_scraper: { type: Boolean, default: false }, // Auto-switch disabled by default
        default_max_pages: { type: Number, default: 1 }, // Default to 1 page (20 results) for safety
        fields_level: {
            type: String,
            enum: ['basic', 'contact', 'atmosphere'], // basic=$17/k, contact(+$35/k), atmosphere(+$)
            default: 'contact'
        }
    },

    // AI Insights Configuration (Groq API)
    ai_insights_config: {
        groq_api_key: String,
        enabled: { type: Boolean, default: false },
        ai_model: {
            type: String,
            enum: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma-7b-it'],
            default: 'llama3-70b-8192'
        },
        generation_mode: {
            type: String,
            enum: ['ai', 'template', 'hybrid'],
            default: 'hybrid' // Try AI first, fallback to template
        }
    },

    // Aggregator Detection
    aggregator_detection_enabled: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
