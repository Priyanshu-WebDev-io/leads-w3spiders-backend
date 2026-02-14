const mongoose = require('mongoose');
const Business = require('../models/Business');
const logger = require('../utils/logger');

/**
 * Migration Script: Transform legacy Business model structure to modern globalized structure
 * Uses MongoDB $unset operator to properly remove legacy fields from database
 */

async function transformLegacyStructure() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/w3spiders-crm');
        logger.info('Connected to MongoDB');

        // Legacy fields to remove (not in current schema)
        const legacyFields = [
            'cid',
            'title',
            'web_site',
            'longtitude', // typo in scraper
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

        // Step 1: Map legacy fields to modern equivalents
        logger.info('Step 1: Mapping legacy fields to modern equivalents...');

        // title -> name
        const titleResult = await Business.updateMany(
            { name: { $exists: false }, title: { $exists: true } },
            [{ $set: { name: '$title' } }]
        );
        logger.info(`Mapped title to name: ${titleResult.modifiedCount} documents`);

        // web_site -> website
        const websiteResult = await Business.updateMany(
            { website: { $exists: false }, web_site: { $exists: true } },
            [{ $set: { website: '$web_site' } }]
        );
        logger.info(`Mapped web_site to website: ${websiteResult.modifiedCount} documents`);

        // longtitude -> longitude
        const longitudeResult = await Business.updateMany(
            { longitude: { $exists: false }, longtitude: { $exists: true } },
            [{ $set: { longitude: '$longtitude' } }]
        );
        logger.info(`Mapped longtitude to longitude: ${longitudeResult.modifiedCount} documents`);

        // review_rating -> rating
        const ratingResult = await Business.updateMany(
            { rating: { $exists: false }, review_rating: { $exists: true } },
            [{ $set: { rating: '$review_rating' } }]
        );
        logger.info(`Mapped review_rating to rating: ${ratingResult.modifiedCount} documents`);

        // categories -> additional_categories
        const categoriesResult = await Business.updateMany(
            { additional_categories: { $exists: false }, categories: { $exists: true } },
            [{ $set: { additional_categories: '$categories' } }]
        );
        logger.info(`Mapped categories to additional_categories: ${categoriesResult.modifiedCount} documents`);

        // Step 2: Fix empty status and missing sources
        logger.info('Step 2: Fixing empty status and missing sources...');

        const fixStatusResult = await Business.updateMany(
            { $or: [{ status: '' }, { status: { $exists: false } }] },
            { $set: { status: 'new' } }
        );
        logger.info(`Fixed ${fixStatusResult.modifiedCount} status fields`);

        const fixSourcesResult = await Business.updateMany(
            { $or: [{ sources: { $exists: false } }, { sources: { $size: 0 } }] },
            { $set: { sources: [{ type: 'scraper' }] } }
        );
        logger.info(`Fixed ${fixSourcesResult.modifiedCount} sources fields`);

        // Step 3: Remove all legacy fields using $unset
        logger.info('Step 3: Removing legacy fields from database...');

        const unsetFields = {};
        legacyFields.forEach(field => {
            unsetFields[field] = '';
        });

        const removeResult = await Business.updateMany(
            {},
            { $unset: unsetFields }
        );

        logger.info(`Removed legacy fields from ${removeResult.modifiedCount} documents`);

        // Get final stats
        const total = await Business.countDocuments();
        const withSources = await Business.countDocuments({ sources: { $exists: true, $ne: [] } });
        const withValidStatus = await Business.countDocuments({
            status: { $in: ['new', 'interested', 'converted', 'closed'] }
        });

        const stats = {
            total,
            withSources,
            withValidStatus,
            mappings: {
                title: titleResult.modifiedCount,
                web_site: websiteResult.modifiedCount,
                longtitude: longitudeResult.modifiedCount,
                review_rating: ratingResult.modifiedCount,
                categories: categoriesResult.modifiedCount
            },
            statusFixed: fixStatusResult.modifiedCount,
            sourcesFixed: fixSourcesResult.modifiedCount,
            legacyFieldsRemoved: removeResult.modifiedCount
        };

        logger.info('Transformation complete', stats);

        // Close connection
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');

        return stats;

    } catch (error) {
        logger.error(`Transformation failed: ${error.message}`);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    transformLegacyStructure()
        .then(stats => {
            console.log('\n=== Transformation Results ===');
            console.log(`Total businesses: ${stats.total}`);
            console.log(`With sources: ${stats.withSources}`);
            console.log(`With valid status: ${stats.withValidStatus}`);
            console.log('\n=== Field Mappings ===');
            console.log(`title → name: ${stats.mappings.title}`);
            console.log(`web_site → website: ${stats.mappings.web_site}`);
            console.log(`longtitude → longitude: ${stats.mappings.longtitude}`);
            console.log(`review_rating → rating: ${stats.mappings.review_rating}`);
            console.log(`categories → additional_categories: ${stats.mappings.categories}`);
            console.log('\n=== Fixes Applied ===');
            console.log(`Status fields fixed: ${stats.statusFixed}`);
            console.log(`Sources fields fixed: ${stats.sourcesFixed}`);
            console.log(`Documents with legacy fields removed: ${stats.legacyFieldsRemoved}`);
            process.exit(0);
        })
        .catch(error => {
            console.error('Transformation failed:', error);
            process.exit(1);
        });
}

module.exports = transformLegacyStructure;
