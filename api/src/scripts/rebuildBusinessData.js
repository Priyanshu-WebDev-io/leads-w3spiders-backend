const mongoose = require('mongoose');
const Business = require('../models/Business');
const ScraperRaw = require('../models/ScraperRaw');
const GooglePlaceRaw = require('../models/GooglePlaceRaw');
const Job = require('../models/Job');
const deduplicator = require('../services/deduplicator');
const logger = require('../utils/logger');

/**
 * Rebuild Business Collection from Raw Data
 * 
 * This script:
 * 1. Clears the Business collection
 * 2. Processes all ScraperRaw data
 * 3. Processes all GooglePlaceRaw data
 * 4. Applies contact validation (skip businesses without contact info)
 * 5. Reports statistics
 */

async function rebuildBusinessData() {
    try {
        console.log('🔄 Starting Business data rebuild...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/w3spiders-crm');
        console.log('✅ Connected to MongoDB\n');

        // Stats
        const stats = {
            businessesDeleted: 0,
            scraperRawCount: 0,
            googleRawCount: 0,
            totalProcessed: 0,
            newBusinesses: 0,
            skipped: 0,
            errors: 0
        };

        // 1. Clear Business collection
        console.log('🗑️  Clearing Business collection...');
        const deleteResult = await Business.deleteMany({});
        stats.businessesDeleted = deleteResult.deletedCount;
        console.log(`   Deleted ${stats.businessesDeleted} businesses\n`);

        // 2. Process ScraperRaw data
        console.log('📊 Processing ScraperRaw data...');
        const scraperRawDocs = await ScraperRaw.find({}).lean();
        stats.scraperRawCount = scraperRawDocs.length;
        console.log(`   Found ${stats.scraperRawCount} scraper raw records\n`);

        // Group by job_id to get createdBy
        const jobMap = new Map();

        for (const rawDoc of scraperRawDocs) {
            try {
                // Get job info for createdBy
                if (!jobMap.has(rawDoc.job_id)) {
                    const job = await Job.findOne({ job_id: rawDoc.job_id }).select('createdBy').lean();
                    jobMap.set(rawDoc.job_id, job?.createdBy || null);
                }

                const createdBy = jobMap.get(rawDoc.job_id);

                // Process through deduplicator
                const result = await deduplicator.processBusinesses(
                    [rawDoc.data],
                    rawDoc.source_query || '',
                    rawDoc.job_id,
                    'scraper',
                    createdBy
                );

                stats.totalProcessed++;
                stats.newBusinesses += result.new;
                stats.skipped += result.skipped;
                stats.errors += result.errors;

                if (stats.totalProcessed % 100 === 0) {
                    console.log(`   Processed ${stats.totalProcessed}/${stats.scraperRawCount} scraper records...`);
                }

            } catch (error) {
                logger.error(`Error processing scraper raw ${rawDoc._id}: ${error.message}`);
                stats.errors++;
            }
        }

        console.log(`   ✅ Completed scraper raw processing\n`);

        // 3. Process GooglePlaceRaw data
        console.log('📊 Processing GooglePlaceRaw data...');
        const googleRawDocs = await GooglePlaceRaw.find({}).lean();
        stats.googleRawCount = googleRawDocs.length;
        console.log(`   Found ${stats.googleRawCount} Google Places raw records\n`);

        let googleProcessed = 0;
        for (const rawDoc of googleRawDocs) {
            try {
                // Get job info for createdBy
                if (!jobMap.has(rawDoc.job_id)) {
                    const job = await Job.findOne({ job_id: rawDoc.job_id }).select('createdBy').lean();
                    jobMap.set(rawDoc.job_id, job?.createdBy || null);
                }

                const createdBy = jobMap.get(rawDoc.job_id);

                // Process through deduplicator
                const result = await deduplicator.processBusinesses(
                    [rawDoc.data],
                    rawDoc.source_query || '',
                    rawDoc.job_id,
                    'google_places',
                    createdBy
                );

                googleProcessed++;
                stats.totalProcessed++;
                stats.newBusinesses += result.new;
                stats.skipped += result.skipped;
                stats.errors += result.errors;

                if (googleProcessed % 100 === 0) {
                    console.log(`   Processed ${googleProcessed}/${stats.googleRawCount} Google Places records...`);
                }

            } catch (error) {
                logger.error(`Error processing Google raw ${rawDoc._id}: ${error.message}`);
                stats.errors++;
            }
        }

        console.log(`   ✅ Completed Google Places raw processing\n`);

        // 4. Final statistics
        const finalBusinessCount = await Business.countDocuments();

        console.log('📊 Rebuild Complete:\n');
        console.log(`   Businesses Deleted: ${stats.businessesDeleted}`);
        console.log(`   Scraper Raw Records: ${stats.scraperRawCount}`);
        console.log(`   Google Places Raw Records: ${stats.googleRawCount}`);
        console.log(`   Total Raw Records Processed: ${stats.totalProcessed}`);
        console.log(`   New Businesses Created: ${stats.newBusinesses}`);
        console.log(`   Skipped (no contact info): ${stats.skipped}`);
        console.log(`   Errors: ${stats.errors}`);
        console.log(`   Final Business Count: ${finalBusinessCount}\n`);

        const reductionPercent = stats.businessesDeleted > 0
            ? (((stats.businessesDeleted - finalBusinessCount) / stats.businessesDeleted) * 100).toFixed(2)
            : 0;

        console.log(`   📉 Data Reduction: ${reductionPercent}% (removed ${stats.businessesDeleted - finalBusinessCount} businesses without contact info)\n`);

        await mongoose.disconnect();
        console.log('✅ Rebuild complete!');

    } catch (error) {
        console.error('❌ Rebuild failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the rebuild
rebuildBusinessData();
