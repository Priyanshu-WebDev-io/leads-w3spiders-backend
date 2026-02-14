#!/usr/bin/env node

/**
 * Regenerate AI Insights and Reset Business Status
 * 
 * This script:
 * 1. Deletes all existing AI insights
 * 2. Resets all businesses to "new" status (unfiltered)
 * 3. Regenerates AI insights for all businesses
 * 
 * Usage:
 *   node scripts/regenerateAllInsights.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const Business = require('../models/Business');
const insightGenerator = require('../services/insightGenerator');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/w3spiders-crm';

async function regenerateAllInsights() {
    try {
        // Connect to MongoDB
        logger.info('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        logger.info('Connected to MongoDB');

        // Step 1: Reset all business statuses to "new" (unfiltered)
        logger.info('\n=== STEP 1: Resetting Business Statuses ===');
        const statusResult = await Business.updateMany(
            {},
            { $set: { status: 'new' } }
        );
        logger.info(`Reset ${statusResult.modifiedCount} businesses to "new" status`);

        // Step 2: Delete all existing AI insights
        logger.info('\n=== STEP 2: Deleting Existing AI Insights ===');
        const deleteResult = await Business.updateMany(
            {},
            { $unset: { ai_insights: "" } }
        );
        logger.info(`Deleted insights from ${deleteResult.modifiedCount} businesses`);

        // Step 3: Get all businesses for regeneration
        logger.info('\n=== STEP 3: Regenerating AI Insights ===');
        const businesses = await Business.find({});
        logger.info(`Found ${businesses.length} businesses to process`);

        if (businesses.length === 0) {
            logger.info('No businesses to process. Exiting.');
            process.exit(0);
        }

        let generated = 0;
        let failed = 0;
        const startTime = Date.now();

        // Process each business
        for (let i = 0; i < businesses.length; i++) {
            const business = businesses[i];

            try {
                logger.info(`[${i + 1}/${businesses.length}] Generating insights for: ${business.name}`);

                // Generate insights (will use AI if configured, templates otherwise)
                const insights = await insightGenerator.generate(business);

                // Update business
                business.ai_insights = insights;
                await business.save();

                generated++;

                // Log generation method
                const method = insights.generation_method || 'template';
                logger.info(`  ✓ Generated (${method})`);

            } catch (error) {
                failed++;
                logger.error(`  ✗ Failed: ${error.message}`);
            }

            // Progress update every 10 businesses
            if ((i + 1) % 10 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                const rate = ((i + 1) / elapsed).toFixed(1);
                logger.info(`Progress: ${i + 1}/${businesses.length} (${generated} successful, ${failed} failed, ${rate} per second)`);
            }
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        // Final summary
        logger.info('\n=== SUMMARY ===');
        logger.info(`Total businesses: ${businesses.length}`);
        logger.info(`Successfully generated: ${generated}`);
        logger.info(`Failed: ${failed}`);
        logger.info(`Success rate: ${((generated / businesses.length) * 100).toFixed(2)}%`);
        logger.info(`Total time: ${totalTime} seconds`);
        logger.info(`Average: ${(totalTime / businesses.length).toFixed(2)} seconds per business`);

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
    logger.info('=== Regenerate All AI Insights & Reset Status ===\n');
    regenerateAllInsights();
}

module.exports = regenerateAllInsights;
