#!/usr/bin/env node

/**
 * Generate AI Insights for Legacy Business Data
 * 
 * This script generates comprehensive AI insights for all existing businesses
 * that don't have insights yet. Useful for backfilling legacy data.
 * 
 * Usage:
 *   node scripts/generateLegacyInsights.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const Business = require('../models/Business');
const insightGenerator = require('../services/insightGenerator');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/w3spiders-crm';

async function generateLegacyInsights() {
    try {
        // Connect to MongoDB
        logger.info('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        logger.info('Connected to MongoDB');

        // Find all businesses without insights
        const businesses = await Business.find({
            'ai_insights.generated_at': { $exists: false }
        });

        logger.info(`Found ${businesses.length} businesses without AI insights`);

        if (businesses.length === 0) {
            logger.info('No businesses need insights generation. Exiting.');
            process.exit(0);
        }

        let generated = 0;
        let failed = 0;

        // Process each business
        for (let i = 0; i < businesses.length; i++) {
            const business = businesses[i];

            try {
                logger.info(`[${i + 1}/${businesses.length}] Generating insights for: ${business.name}`);

                // Generate insights
                const insights = await insightGenerator.generate(business);

                // Update business
                business.ai_insights = insights;
                await business.save();

                generated++;
                logger.info(`✓ Generated insights for: ${business.name}`);

            } catch (error) {
                failed++;
                logger.error(`✗ Failed to generate insights for ${business.name}: ${error.message}`);
            }

            // Progress update every 10 businesses
            if ((i + 1) % 10 === 0) {
                logger.info(`Progress: ${i + 1}/${businesses.length} (${generated} successful, ${failed} failed)`);
            }
        }

        // Final summary
        logger.info('\n=== SUMMARY ===');
        logger.info(`Total businesses: ${businesses.length}`);
        logger.info(`Successfully generated: ${generated}`);
        logger.info(`Failed: ${failed}`);
        logger.info(`Success rate: ${((generated / businesses.length) * 100).toFixed(2)}%`);

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
    logger.info('=== Generate AI Insights for Legacy Data ===\n');
    generateLegacyInsights();
}

module.exports = generateLegacyInsights;
