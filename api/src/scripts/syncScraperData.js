const mongoose = require('mongoose');
const ScraperRaw = require('../models/ScraperRaw');
const deduplicator = require('../services/deduplicator');
const logger = require('../utils/logger');

/**
 * Sync Script: Process existing ScraperRaw data into Business model
 * This script re-processes all raw scraper data that failed to sync
 */

async function syncScraperData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/w3spiders-crm');
        logger.info('Connected to MongoDB');

        // Find all ScraperRaw documents
        const rawDocs = await ScraperRaw.find({}).lean();
        logger.info(`Found ${rawDocs.length} raw scraper documents to process`);

        const stats = {
            total: rawDocs.length,
            new: 0,
            updated: 0,
            skipped: 0,
            errors: 0
        };

        // Process each document
        for (const rawDoc of rawDocs) {
            try {
                // Extract the business data
                const businessData = rawDoc.data;

                // Process through deduplicator
                await deduplicator.upsertBusiness(
                    businessData,
                    rawDoc.source_query,
                    stats,
                    'scraper',
                    rawDoc._id
                );

                logger.info(`Processed: ${businessData.title || businessData.name}`, {
                    place_id: rawDoc.place_id
                });

            } catch (error) {
                logger.error(`Error processing raw document ${rawDoc._id}: ${error.message}`);
                stats.errors++;
            }
        }

        logger.info('Sync complete', stats);

        // Close connection
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');

        return stats;

    } catch (error) {
        logger.error(`Sync failed: ${error.message}`);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    syncScraperData()
        .then(stats => {
            console.log('\n=== Sync Results ===');
            console.log(`Total: ${stats.total}`);
            console.log(`New: ${stats.new}`);
            console.log(`Updated: ${stats.updated}`);
            console.log(`Skipped: ${stats.skipped}`);
            console.log(`Errors: ${stats.errors}`);
            process.exit(0);
        })
        .catch(error => {
            console.error('Sync failed:', error);
            process.exit(1);
        });
}

module.exports = syncScraperData;
