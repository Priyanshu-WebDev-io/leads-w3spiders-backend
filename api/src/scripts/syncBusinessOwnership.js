const mongoose = require('mongoose');
const Business = require('../models/Business');
const Job = require('../models/Job');
const ScraperRaw = require('../models/ScraperRaw');
const GooglePlaceRaw = require('../models/GooglePlaceRaw');
const logger = require('../utils/logger');

/**
 * Migration Script: Sync all legacy and new data with createdBy field
 * 
 * This script:
 * 1. Finds all businesses without createdBy
 * 2. Attempts to match them with Jobs via raw_references
 * 3. Sets createdBy based on job ownership
 * 4. Reports statistics
 */

async function syncLegacyData() {
    try {
        console.log('🔄 Starting legacy data sync...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/w3spiders-crm');
        console.log('✅ Connected to MongoDB\n');

        // Stats
        const stats = {
            total: 0,
            withCreatedBy: 0,
            withoutCreatedBy: 0,
            synced: 0,
            noMatch: 0,
            errors: 0
        };

        // 1. Count all businesses
        stats.total = await Business.countDocuments();
        stats.withCreatedBy = await Business.countDocuments({ createdBy: { $exists: true, $ne: null } });
        stats.withoutCreatedBy = stats.total - stats.withCreatedBy;

        console.log('📊 Current State:');
        console.log(`   Total Businesses: ${stats.total}`);
        console.log(`   With createdBy: ${stats.withCreatedBy}`);
        console.log(`   Without createdBy: ${stats.withoutCreatedBy}\n`);

        if (stats.withoutCreatedBy === 0) {
            console.log('✅ All businesses already have createdBy field. Nothing to sync.');
            await mongoose.disconnect();
            return;
        }

        // 2. Find businesses without createdBy
        console.log('🔍 Finding businesses without createdBy...');
        const businessesWithoutOwner = await Business.find({
            $or: [
                { createdBy: { $exists: false } },
                { createdBy: null }
            ]
        }).select('_id place_id name raw_references').lean();

        console.log(`   Found ${businessesWithoutOwner.length} businesses to process\n`);

        // 3. Process each business
        console.log('🔄 Syncing businesses with jobs...\n');

        for (const business of businessesWithoutOwner) {
            try {
                let jobId = null;
                let createdBy = null;

                // Strategy 1: Check raw_references for job_id
                if (business.raw_references && business.raw_references.length > 0) {
                    // Get the first raw reference
                    const rawRef = business.raw_references[0];

                    // Find the raw document to get job_id
                    let rawDoc = null;
                    if (rawRef.source === 'scraper') {
                        rawDoc = await ScraperRaw.findById(rawRef.raw_id).select('job_id').lean();
                    } else if (rawRef.source === 'google_places') {
                        rawDoc = await GooglePlaceRaw.findById(rawRef.raw_id).select('job_id').lean();
                    }

                    if (rawDoc && rawDoc.job_id) {
                        jobId = rawDoc.job_id;
                    }
                }

                // Strategy 2: If no raw_references, try to find by place_id in raw collections
                if (!jobId) {
                    const scraperRaw = await ScraperRaw.findOne({ place_id: business.place_id })
                        .select('job_id')
                        .sort({ createdAt: -1 })
                        .lean();

                    if (scraperRaw) {
                        jobId = scraperRaw.job_id;
                    } else {
                        const googleRaw = await GooglePlaceRaw.findOne({ place_id: business.place_id })
                            .select('job_id')
                            .sort({ createdAt: -1 })
                            .lean();

                        if (googleRaw) {
                            jobId = googleRaw.job_id;
                        }
                    }
                }

                // If we found a job_id, get the createdBy from the Job
                if (jobId) {
                    const job = await Job.findOne({ job_id: jobId }).select('createdBy').lean();
                    if (job && job.createdBy) {
                        createdBy = job.createdBy;
                    }
                }

                // Update the business if we found a createdBy
                if (createdBy) {
                    await Business.updateOne(
                        { _id: business._id },
                        { $set: { createdBy: createdBy } }
                    );
                    stats.synced++;

                    if (stats.synced % 100 === 0) {
                        console.log(`   ✅ Synced ${stats.synced} businesses...`);
                    }
                } else {
                    stats.noMatch++;
                }

            } catch (error) {
                logger.error(`Error processing business ${business._id}: ${error.message}`);
                stats.errors++;
            }
        }

        console.log('\n📊 Sync Complete:');
        console.log(`   Total Processed: ${businessesWithoutOwner.length}`);
        console.log(`   Successfully Synced: ${stats.synced}`);
        console.log(`   No Match Found: ${stats.noMatch}`);
        console.log(`   Errors: ${stats.errors}\n`);

        // 4. Final count
        const finalWithCreatedBy = await Business.countDocuments({ createdBy: { $exists: true, $ne: null } });
        const finalWithoutCreatedBy = stats.total - finalWithCreatedBy;

        console.log('📊 Final State:');
        console.log(`   Total Businesses: ${stats.total}`);
        console.log(`   With createdBy: ${finalWithCreatedBy}`);
        console.log(`   Without createdBy: ${finalWithoutCreatedBy}\n`);

        if (finalWithoutCreatedBy > 0) {
            console.log('⚠️  Note: Some businesses could not be matched to a job.');
            console.log('   These are likely from legacy imports or manual additions.');
            console.log('   You may want to assign them to a default user manually.\n');
        }

        await mongoose.disconnect();
        console.log('✅ Migration complete!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the migration
syncLegacyData();
