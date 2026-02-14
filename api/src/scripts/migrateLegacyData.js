const mongoose = require('mongoose');
const Business = require('../models/Business');
const ScraperRaw = require('../models/ScraperRaw');
const logger = require('../utils/logger');

/**
 * Migration Script: Mark legacy business data as scraper source
 * and migrate full raw data to ScraperRaw collection
 */

async function migrateLegacyData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/w3spiders-crm');
        logger.info('Connected to MongoDB');

        // Find all businesses without sources (legacy data)
        const legacyBusinesses = await Business.find({
            $or: [
                { sources: { $exists: false } },
                { sources: { $size: 0 } },
                { sources: null }
            ]
        });

        logger.info(`Found ${legacyBusinesses.length} legacy businesses to migrate`);

        const stats = {
            total: legacyBusinesses.length,
            migrated: 0,
            rawCreated: 0,
            errors: 0
        };

        for (const business of legacyBusinesses) {
            try {
                // Create raw data entry in ScraperRaw
                const rawData = {
                    job_id: 'legacy-migration',
                    place_id: business.place_id,
                    data: {
                        // Map Business fields back to scraper format
                        place_id: business.place_id,
                        title: business.name,
                        category: business.category,
                        categories: business.additional_categories || [],
                        address: business.address,
                        complete_address: {
                            street: business.address,
                            city: business.city,
                            postal_code: business.zip,
                            state: business.state,
                            country: business.country
                        },
                        phone: business.phone,
                        web_site: business.website,
                        latitude: business.latitude,
                        longtitude: business.longitude,
                        rating: business.rating,
                        review_rating: business.rating,
                        review_count: business.review_count,
                        images: business.images || [],
                        emails: business.emails || [],
                        status: business.status || 'new',
                        // Include all other fields
                        ...business.toObject()
                    },
                    source_query: 'legacy-data'
                };

                // Check if raw data already exists
                const existingRaw = await ScraperRaw.findOne({ place_id: business.place_id });

                let rawId;
                if (!existingRaw) {
                    const rawDoc = await ScraperRaw.create(rawData);
                    rawId = rawDoc._id;
                    stats.rawCreated++;
                    logger.info(`Created raw data for: ${business.name}`, { place_id: business.place_id });
                } else {
                    rawId = existingRaw._id;
                    logger.info(`Raw data already exists for: ${business.name}`, { place_id: business.place_id });
                }

                // Update business with scraper source
                if (!business.sources || business.sources.length === 0) {
                    business.sources = [{ type: 'scraper' }];
                }

                // Fix empty status field (validation requirement)
                if (!business.status || business.status === '') {
                    business.status = 'new';
                }

                // Add raw reference if not already present
                const hasRawRef = business.raw_references?.some(
                    ref => ref.raw_id?.toString() === rawId.toString()
                );

                if (!hasRawRef) {
                    if (!business.raw_references) {
                        business.raw_references = [];
                    }
                    business.raw_references.push({
                        source: 'scraper',
                        raw_id: rawId
                    });
                }

                await business.save();
                stats.migrated++;

                logger.info(`Migrated: ${business.name}`, {
                    place_id: business.place_id,
                    sources: business.sources.map(s => s.type)
                });

            } catch (error) {
                logger.error(`Error migrating business ${business.place_id}: ${error.message}`);
                stats.errors++;
            }
        }

        logger.info('Migration complete', stats);

        // Close connection
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');

        return stats;

    } catch (error) {
        logger.error(`Migration failed: ${error.message}`);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    migrateLegacyData()
        .then(stats => {
            console.log('\n=== Migration Results ===');
            console.log(`Total legacy businesses: ${stats.total}`);
            console.log(`Migrated: ${stats.migrated}`);
            console.log(`Raw data created: ${stats.rawCreated}`);
            console.log(`Errors: ${stats.errors}`);
            process.exit(0);
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = migrateLegacyData;
