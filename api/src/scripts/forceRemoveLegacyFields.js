const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Migration Script: Force remove legacy fields using native MongoDB driver
 * This bypasses Mongoose to ensure fields are actually removed from the database
 */

async function forceRemoveLegacyFields() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/w3spiders-crm');
        logger.info('Connected to MongoDB');

        // Get native MongoDB collection
        const db = mongoose.connection.db;
        const collection = db.collection('businesses');

        // Legacy fields to remove
        const legacyFields = [
            'cid',
            'title',
            'web_site',
            'longtitude',
            'complete_address',
            'data_id',
            'input_id',
            'link',
            'menu',
            'owner',
            'plus_code',
            'popular_times',
            'price_range',
            'reservations',
            'review_rating',
            'reviews_link',
            'reviews_per_rating',
            'source_query',
            'thumbnail',
            'timezone',
            'user_reviews',
            'user_reviews_extended',
            'open_hours',
            'order_online',
            'about',
            'description',
            'categories'
        ];

        logger.info(`Removing ${legacyFields.length} legacy fields from all documents...`);

        // Build $unset object
        const unsetFields = {};
        legacyFields.forEach(field => {
            unsetFields[field] = 1;
        });

        // Use native MongoDB updateMany
        const result = await collection.updateMany(
            {},
            { $unset: unsetFields }
        );

        logger.info(`Update operation completed`, {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount
        });

        // Verify removal
        logger.info('Verifying field removal...');
        const verificationResults = {};

        for (const field of legacyFields.slice(0, 5)) { // Check first 5 fields
            const count = await collection.countDocuments({ [field]: { $exists: true } });
            verificationResults[field] = count;
        }

        logger.info('Verification results (sample):', verificationResults);

        const allRemoved = Object.values(verificationResults).every(count => count === 0);

        if (allRemoved) {
            logger.info('✅ All legacy fields successfully removed!');
        } else {
            logger.warn('⚠️  Some legacy fields still present');
        }

        // Close connection
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');

        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            verification: verificationResults,
            success: allRemoved
        };

    } catch (error) {
        logger.error(`Force removal failed: ${error.message}`);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    forceRemoveLegacyFields()
        .then(stats => {
            console.log('\n=== Force Removal Results ===');
            console.log(`Documents matched: ${stats.matchedCount}`);
            console.log(`Documents modified: ${stats.modifiedCount}`);
            console.log('\n=== Verification (Sample) ===');
            Object.entries(stats.verification).forEach(([field, count]) => {
                console.log(`${field}: ${count} ${count === 0 ? '✅' : '❌'}`);
            });
            console.log(`\nOverall: ${stats.success ? '✅ SUCCESS' : '❌ FAILED'}`);
            process.exit(stats.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Force removal failed:', error);
            process.exit(1);
        });
}

module.exports = forceRemoveLegacyFields;
