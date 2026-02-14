const mongoose = require('mongoose');

const googlePlaceRawSchema = new mongoose.Schema({
    job_id: {
        type: String, // ID of the job that fetched this
        index: true
    },
    place_id: {
        type: String,
        required: true,
        index: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed, // Store the full raw JSON response
        required: true
    },
    source_query: String,
}, {
    timestamps: true
});

module.exports = mongoose.model('GooglePlaceRaw', googlePlaceRawSchema);
