const fs = require('fs').promises;
const logger = require('../utils/logger');
const deduplicator = require('./deduplicator');

class ProcessorService {
    /**
     * Process scraper output file
     * @param {string} outputPath - Path to JSON output file
     * @param {string} sourceQuery - Original search query
     * @param {string} jobId - Job ID
     * @param {string} sourceType - 'scraper' | 'google_places'
     * @param {string} createdBy - User ID who created the job
     * @returns {Promise<Object>} - Processing results
     */
    async processOutput(outputPath, sourceQuery = '', jobId, sourceType = 'scraper', createdBy = null) {
        try {
            logger.info(`Processing output file: ${outputPath} (Source: ${sourceType}, Job: ${jobId})`);

            // Read and parse JSON file
            const businesses = await this.readOutputFile(outputPath);

            if (!businesses || businesses.length === 0) {
                logger.warn('No businesses found in output file');
                return {
                    total: 0,
                    new: 0,
                    updated: 0,
                    skipped: 0,
                    errors: 0
                };
            }

            logger.info(`Found ${businesses.length} businesses in output`);

            // Process through deduplicator
            const stats = await deduplicator.processBusinesses(businesses, sourceQuery, jobId, sourceType, createdBy);

            return stats;

        } catch (error) {
            logger.error(`Failed to process output: ${error.message}`);
            throw error;
        }
    }

    /**
     * Read and parse JSON output file
     */
    async readOutputFile(outputPath) {
        try {
            const content = await fs.readFile(outputPath, 'utf8');

            // Handle empty file
            if (!content || content.trim() === '') {
                return [];
            }

            try {
                // Try standard JSON parse first
                const data = JSON.parse(content);
                return Array.isArray(data) ? data : [data];
            } catch (parseError) {
                // Fallback: Try NDJSON (Newline Delimited JSON)
                logger.info('Standard JSON parse failed, trying NDJSON...');

                const lines = content.trim().split('\n');
                const data = lines
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .map(line => JSON.parse(line)); // Parse each line

                logger.info(`Successfully parsed ${data.length} records from NDJSON`);
                return data;
            }

        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Output file not found: ${outputPath}`);
            }
            if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON in output file: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Validate business data structure
     */
    validateBusiness(business) {
        const required = ['place_id', 'name'];
        const missing = required.filter(field => !business[field]);

        if (missing.length > 0) {
            logger.warn(`Business missing required fields: ${missing.join(', ')}`, {
                business: business.name || business.title
            });
            return false;
        }

        return true;
    }
}

module.exports = new ProcessorService();
