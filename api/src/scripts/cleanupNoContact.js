require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business');
const ScraperRaw = require('../models/ScraperRaw');
const GooglePlaceRaw = require('../models/GooglePlaceRaw');

async function cleanupNoContact() {
    try {
        console.log('🔌 Connecting to MongoDB...');

        // Connect to local MongoDB
        await mongoose.connect('mongodb://localhost:27017/w3spiders-crm');
        console.log('✅ Connected to MongoDB\n');

        // Find businesses without ANY contact information
        const noContactBusinesses = await Business.find({
            $and: [
                {
                    $or: [
                        { phone: { $exists: false } },
                        { phone: null },
                        { phone: '' }
                    ]
                },
                {
                    $or: [
                        { website: { $exists: false } },
                        { website: null },
                        { website: '' }
                    ]
                },
                {
                    $or: [
                        { emails: { $exists: false } },
                        { emails: null },
                        { emails: { $size: 0 } }
                    ]
                }
            ]
        });

        console.log(`📊 Found ${noContactBusinesses.length} businesses without contact information\n`);

        if (noContactBusinesses.length === 0) {
            console.log('✅ No businesses to clean up!');
            await mongoose.connection.close();
            return;
        }

        // Display sample of businesses to be removed
        console.log('📋 Sample of businesses to be removed:');
        noContactBusinesses.slice(0, 10).forEach((biz, idx) => {
            console.log(`${idx + 1}. ${biz.name} (${biz.place_id})`);
            console.log(`   Address: ${biz.address || 'N/A'}`);
            console.log(`   Category: ${biz.category || 'N/A'}`);
            console.log(`   Sources: ${biz.sources?.map(s => s.type).join(', ') || 'N/A'}\n`);
        });

        // Collect place_ids and raw_references for deletion
        const placeIds = noContactBusinesses.map(biz => biz.place_id).filter(Boolean);
        const rawReferences = noContactBusinesses
            .flatMap(biz => biz.raw_references || [])
            .filter(Boolean);

        console.log(`\n⚠️  About to delete:`);
        console.log(`   - ${noContactBusinesses.length} businesses from Business collection`);
        console.log(`   - Related raw data from ScraperRaw collection`);
        console.log(`   - Related raw data from GooglePlaceRaw collection\n`);

        // Delete from Business collection
        const businessResult = await Business.deleteMany({
            $and: [
                {
                    $or: [
                        { phone: { $exists: false } },
                        { phone: null },
                        { phone: '' }
                    ]
                },
                {
                    $or: [
                        { website: { $exists: false } },
                        { website: null },
                        { website: '' }
                    ]
                },
                {
                    $or: [
                        { emails: { $exists: false } },
                        { emails: null },
                        { emails: { $size: 0 } }
                    ]
                }
            ]
        });

        // Delete from ScraperRaw by place_id
        const scraperRawResult = await ScraperRaw.deleteMany({
            place_id: { $in: placeIds }
        });

        // Delete from GooglePlaceRaw by place_id
        const googleRawResult = await GooglePlaceRaw.deleteMany({
            place_id: { $in: placeIds }
        });

        // Also delete by raw_references if they exist
        let scraperRefResult = { deletedCount: 0 };
        let googleRefResult = { deletedCount: 0 };

        if (rawReferences.length > 0) {
            scraperRefResult = await ScraperRaw.deleteMany({
                _id: { $in: rawReferences }
            });
            googleRefResult = await GooglePlaceRaw.deleteMany({
                _id: { $in: rawReferences }
            });
        }

        console.log(`\n✅ Deletion Summary:`);
        console.log(`   Business: ${businessResult.deletedCount} deleted`);
        console.log(`   ScraperRaw (by place_id): ${scraperRawResult.deletedCount} deleted`);
        console.log(`   ScraperRaw (by reference): ${scraperRefResult.deletedCount} deleted`);
        console.log(`   GooglePlaceRaw (by place_id): ${googleRawResult.deletedCount} deleted`);
        console.log(`   GooglePlaceRaw (by reference): ${googleRefResult.deletedCount} deleted`);

        // Show updated stats
        const totalRemaining = await Business.countDocuments();
        const withPhone = await Business.countDocuments({ phone: { $exists: true, $ne: '', $ne: null } });
        const withWebsite = await Business.countDocuments({ website: { $exists: true, $ne: '', $ne: null } });
        const withEmail = await Business.countDocuments({ emails: { $exists: true, $ne: [], $ne: null } });

        const scraperRawCount = await ScraperRaw.countDocuments();
        const googleRawCount = await GooglePlaceRaw.countDocuments();

        console.log('\n📊 Updated Database Stats:');
        console.log('   Business Collection:');
        console.log(`     Total: ${totalRemaining}`);
        console.log(`     With Phone: ${withPhone}`);
        console.log(`     With Website: ${withWebsite}`);
        console.log(`     With Email: ${withEmail}`);
        console.log('   Raw Data Collections:');
        console.log(`     ScraperRaw: ${scraperRawCount}`);
        console.log(`     GooglePlaceRaw: ${googleRawCount}`);

        await mongoose.connection.close();
        console.log('\n✅ Cleanup complete!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

// Run the cleanup
cleanupNoContact();
