const { uploadFile } = require('../utils/cloudinary');
const path = require('path');
const fs = require('fs').promises;

// Load env vars
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env.development') });

async function testRealUpload() {
    // Path from the failed job logs
    const realFile = '/app/scraper_data/scraper-3b6e89ae-e769-478e-b4b6-ebe50e6d364c/output.json';

    try {
        console.log(`Checking if file exists at ${realFile}...`);
        await fs.access(realFile);
        console.log('File exists.');

        console.log('Attempting upload of REAL file...');
        const result = await uploadFile(realFile, 'debug-tests', 'debug-real-file-upload');
        console.log('Upload success:', result);

    } catch (error) {
        console.error('Real file upload failed details:', error);
        // Clean log of the error object
        console.error('Error JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
}

testRealUpload();
