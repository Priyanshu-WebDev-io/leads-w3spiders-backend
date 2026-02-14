#!/usr/bin/env node

/**
 * Re-analyze Businesses with Aggregator URLs
 * 
 * This script re-analyzes businesses that have websites to detect aggregators.
 * Useful for updating existing data after aggregator detection is implemented.
 * 
 * Usage:
 *   node scripts/reanalyzeAggregators.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const Business = require('../models/Business');
const websiteAnalyzer = require('../services/websiteAnalyzer');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/w3spiders-crm';

async function reanalyzeAggregators() {
    try {
        // Connect to MongoDB
        logger.info('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        logger.info('Connected to MongoDB');

        // Find all businesses with websites
        const businesses = await Business.find({
            website: { $exists: true, $ne: '' }
        });

        logger.info(`Found ${businesses.length} businesses with websites`);

        if (businesses.length === 0) {
            logger.info('No businesses to analyze. Exiting.');
            process.exit(0);
        }

        let analyzed = 0;
        let aggregatorsFound = 0;
        let failed = 0;

        // Process each business
        for (let i = 0; i < businesses.length; i++) {
            const business = businesses[i];

            try {
                logger.info(`[${i + 1}/${businesses.length}] Analyzing: ${business.name} (${business.website})`);

                // Re-analyze website
                const analysis = await websiteAnalyzer.analyzeWebsite(business.website);

                // Update business
                business.website_analysis = analysis;
                await business.save();

                analyzed++;

                if (analysis.is_aggregator) {
                    aggregatorsFound++;
                    logger.info(`  ✓ Aggregator detected: ${analysis.aggregator_info.name}`);
                } else {
                    logger.info(`  ✓ Analyzed: ${analysis.platform}`);
                }

            } catch (error) {
                failed++;
                logger.error(`  ✗ Failed to analyze ${business.name}: ${error.message}`);
            }

            // Progress update every 10 businesses
            if ((i + 1) % 10 === 0) {
                logger.info(`Progress: ${i + 1}/${businesses.length} (${aggregatorsFound} aggregators found)`);
            }
        }

        // Final summary
        logger.info('\n=== SUMMARY ===');
        logger.info(`Total businesses: ${businesses.length}`);
        logger.info(`Successfully analyzed: ${analyzed}`);
        logger.info(`Aggregators found: ${aggregatorsFound}`);
        logger.info(`Failed: ${failed}`);
        logger.info(`Success rate: ${((analyzed / businesses.length) * 100).toFixed(2)}%`);

        // Close connection
        await mongoose.connection.close();
        logger.info('\nMongoDB connection closed');

        process.exit(0);

    } catch (error) {
        logger.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    logger.info('=== Re-analyze Businesses for Aggregator Detection ===\n');
    reanalyzeAggregators();
}

module.exports = reanalyzeAggregators;
