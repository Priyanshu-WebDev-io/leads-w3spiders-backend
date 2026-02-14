const { uploadFile } = require('../utils/cloudinary');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

// Load env vars if running standalone
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env.development') });

async function testUpload() {
    const testFile = 'test-upload.txt';
    try {
        console.log('Creating test file...');
        await fs.writeFile(testFile, 'This is a test file for Cloudinary upload debugging.');

        console.log('Checking env vars...');
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            throw new Error('CLOUDINARY_CLOUD_NAME is missing');
        }

        console.log('Attempting upload with public_id...');
        const result = await uploadFile(testFile, 'debug-tests', 'test-job-12345');
        console.log('Upload success:', result);

    } catch (error) {
        console.error('Upload test failed details:', error);
    } finally {
        try {
            await fs.unlink(testFile);
        } catch (e) { }
    }
}

testUpload();
