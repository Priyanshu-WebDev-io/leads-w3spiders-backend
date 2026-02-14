const cloudinary = require('cloudinary').v2;
require('dotenv').config();
const logger = require('../utils/logger');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Local file path
 * @param {string} folder - Cloudinary folder name
 * @param {string} publicId - Custom public ID (optional)
 * @returns {Promise<Object>} - Upload result
 */
async function uploadFile(filePath, folder = 'scraper-output', publicId = null) {
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            attempt++;
            const options = {
                folder: folder,
                resource_type: 'raw', // For JSON/CSV files
                use_filename: true,
                unique_filename: true,
                timeout: 120000 // 120 seconds timeout
            };

            if (publicId) {
                options.public_id = publicId;
            }

            logger.info(`Uploading file to Cloudinary (Attempt ${attempt}/${MAX_RETRIES})...`);
            const result = await cloudinary.uploader.upload(filePath, options);

            logger.info('File uploaded to Cloudinary', {
                public_id: result.public_id,
                url: result.secure_url,
                size: result.bytes
            });

            return result;
        } catch (error) {
            logger.warn(`Cloudinary upload attempt ${attempt} failed:`, error);

            if (attempt === MAX_RETRIES) {
                logger.error('All Cloudinary upload retries failed.');
                throw error;
            }

            // Wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

/**
 * Download file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<string>} - File URL
 */
async function getFileUrl(publicId) {
    try {
        const url = cloudinary.url(publicId, {
            resource_type: 'raw',
            secure: true
        });

        return url;
    } catch (error) {
        logger.error('Failed to get Cloudinary URL:', error);
        throw error;
    }
}

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 */
async function deleteFile(publicId) {
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: 'raw'
        });

        logger.info('File deleted from Cloudinary', { public_id: publicId });
        return result;
    } catch (error) {
        logger.error('Cloudinary delete failed:', error);
        throw error;
    }
}

module.exports = {
    uploadFile,
    getFileUrl,
    deleteFile,
    cloudinary
};
