const mongoose = require('mongoose');
const Business = require('../models/Business');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env.development') });

async function testDbSave() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const testPlaceId = 'TEST_PLACE_' + Date.now();
        const testData = {
            place_id: testPlaceId,
            name: 'Test Business with Owner Object',
            // This object caused the crash before
            owner: {
                id: '123456789',
                name: 'Test Owner',
                link: 'https://example.com/owner'
            },
            menu: {
                link: '',
                source: ''
            }
        };

        console.log('Attempting to save business with owner object...');
        const business = new Business(testData);
        await business.save();

        console.log('Successfully saved business:', business.place_id);
        console.log('Deleting test record...');
        await Business.deleteOne({ place_id: testPlaceId });
        console.log('Cleaned up.');

    } catch (error) {
        console.error('DB Save Test Failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testDbSave();
