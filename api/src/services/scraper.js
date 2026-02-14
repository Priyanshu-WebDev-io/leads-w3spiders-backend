const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const { uploadFile, deleteFile } = require('../utils/cloudinary');

class ScraperService {
    constructor() {
        this.scraperImage = process.env.SCRAPER_IMAGE || 'scraper-image:latest';
        // Use configured DATA_DIR or fallback to system temp
        this.dataDir = process.env.DATA_DIR || os.tmpdir();
        this.scraperVolumeName = process.env.SCRAPER_VOLUME_NAME;
    }

    /**
     * Execute scraper as a Docker job
     * @param {Array<string>} queries - List of search queries
     * @param {string} jobId - Unique job identifier
     * @param {Object} config - Job configuration (depth, etc)
     * @returns {Promise<Object>} - Cloudinary upload result with file URL
     */
    async executeScrape(queries, jobId, config = {}) {
        let tempVolumePath = null;

        try {
            // Check provider config (Job Config > Global Settings)
            let useScraper = true;
            const settings = await require('../models/Settings').findOne({ key: 'global' });

            // Determine active provider
            let activeProvider = 'scraper';
            if (config.provider) {
                activeProvider = config.provider;
            } else if (settings && settings.data_provider) {
                activeProvider = settings.data_provider;
            }

            if (activeProvider === 'google_places') {
                const gpService = require('./googlePlaces');
                const limitCheck = await gpService.checkLimit();

                if (limitCheck.allowed) {
                    logger.info(`[Job ${jobId}] Using Google Places API Provider (Explicit Choice)`);
                    return await gpService.executeScrape(queries, jobId, config);
                } else {
                    // STRICT MODE: No auto-fallback. Tell user to switch.
                    logger.warn(`[Job ${jobId}] Google Places API limit reached: ${limitCheck.reason}`);
                    throw new Error(`Google Places API limit reached (${limitCheck.reason}). Please select "Free Scraper" engine.`);
                }
            } else {
                logger.info(`[Job ${jobId}] Using Docker Scraper Provider (Explicit Choice)`);
            }

            // --- Default: Scraper Logic ---

            logger.info(`Starting scrape job ${jobId} with ${queries.length} queries and depth ${config.depth}`);

            // Create temporary directory for this job
            // Ensure dataDir exists
            await fs.mkdir(this.dataDir, { recursive: true });

            tempVolumePath = path.join(this.dataDir, `scraper-${jobId}`);
            await fs.mkdir(tempVolumePath, { recursive: true });

            // Write queries to file
            const queriesPath = path.join(tempVolumePath, 'queries.txt');
            await fs.writeFile(queriesPath, queries.join('\n'));
            logger.info(`Queries written to ${queriesPath}`);

            // Prepare output path
            const outputPath = path.join(tempVolumePath, 'output.json');

            // Build and execute Docker command
            // Use config.max_results if set, else fallback to env or default
            const maxRes = config.max_results || process.env.MAX_RESULTS || 70;
            const dockerCmd = this.buildDockerCommand(tempVolumePath, jobId, { ...config, max_results: maxRes });
            logger.info(`Executing Docker command`);

            // Execute Docker container
            await this.runDockerContainer(dockerCmd);

            // Verify output file exists
            await this.verifyOutput(outputPath);

            // Upload to Cloudinary
            logger.info(`Uploading results to Cloudinary for job ${jobId}`);
            const uploadResult = await uploadFile(
                outputPath,
                'scraper-output',
                `job-${jobId}`
            );

            logger.info(`Scrape job ${jobId} completed successfully`);

            return {
                provider: 'scraper',
                cloudinary_url: uploadResult.secure_url,
                cloudinary_public_id: uploadResult.public_id,
                file_size: uploadResult.bytes,
                local_path: outputPath // Keep for immediate processing
            };

        } catch (error) {
            logger.error(`Scrape job ${jobId} failed: ${error.message}`);
            if (tempVolumePath && process.env.CLEANUP_TEMP === 'true') {
                await this.cleanupTempDir(tempVolumePath);
            }
            throw error;
        }
    }

    /**
     * Build Docker run command
     */
    buildDockerCommand(volumePath, jobId, config = {}) {
        let volumeMount;
        let containerQueriesPath;
        let containerOutputPath;

        if (this.scraperVolumeName) {
            // DooD Strategy: Use shared named volume
            // Backend path: /app/scraper_data/scraper-123
            // Scraper mount: -v scraper_data:/data
            // Scraper path: /data/scraper-123

            const relativePath = path.relative(this.dataDir, volumePath); // e.g., "scraper-123"
            volumeMount = `${this.scraperVolumeName}:/data`;
            containerQueriesPath = `/data/${relativePath}/queries.txt`;
            containerOutputPath = `/data/${relativePath}/output.json`;

            logger.info(`Using shared volume strategy. Mount: ${volumeMount}, Path: ${containerQueriesPath}`);
        } else {
            // Host Path Strategy (Local Dev / No DooD)
            // Assumes volumePath is accessible to Docker host
            volumeMount = `${volumePath}:/data`;
            containerQueriesPath = `/data/queries.txt`;
            containerOutputPath = `/data/output.json`;
        }

        const depth = config.depth || 1;
        const concurrency = config.concurrency || 2; // Default 2
        const proxies = Array.isArray(config.proxies) ? config.proxies.join(',') : (config.proxies || '');
        const lang = config.lang || 'en';
        const zoom = config.zoom || 15;
        const debugMode = config.debug ? 'true' : 'false';
        const geo = config.geo || '';

        // Safely quoting Env vars is handled by docker run arrays usually, but here we build string.
        // We rely on standard safe chars. Proxies usually contain special chars so be careful?
        // Since we pass -e VAR=val, we should wrap val in quotes if it has spaces? 
        // Best approach is assuming user input is reasonable or using array format for exec (but executeScrape uses string).
        // For simple string construction:

        return `docker run --rm \
      --memory=1024m \
      --cpus=1.0 \
      --shm-size=1g \
      -v ${volumeMount} \
      -e QUERIES_FILE=${containerQueriesPath} \
      -e OUTPUT_FILE=${containerOutputPath} \
      -e DEPTH=${depth} \
      -e MAX_RESULTS=${config.max_results || 70} \
      -e CONCURRENCY=${concurrency} \
      -e LANG_CODE=${lang} \
      -e ZOOM=${zoom} \
      -e PROXIES='${proxies}' \
      -e DEBUG_MODE=${debugMode} \
      -e GEO='${geo}' \
      ${this.scraperImage}`;
    }

    /**
     * Run Docker container and wait for completion
     */
    runDockerContainer(command) {
        return new Promise((resolve, reject) => {
            exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`Docker execution error: ${error.message}`);
                    logger.error(`stderr: ${stderr}`);
                    reject(error);
                    return;
                }

                logger.info(`Docker stdout: ${stdout}`);
                if (stderr) {
                    logger.warn(`Docker stderr: ${stderr}`);
                }

                resolve(stdout);
            });
        });
    }

    /**
     * Verify output file exists and is valid
     */
    async verifyOutput(outputPath) {
        try {
            const stats = await fs.stat(outputPath);
            if (stats.size === 0) {
                throw new Error('Output file is empty');
            }
            logger.info(`Output file verified: ${outputPath} (${stats.size} bytes)`);
        } catch (error) {
            throw new Error(`Output verification failed: ${error.message}`);
        }
    }

    /**
     * Clean up temporary directory
     */
    async cleanupTempDir(dirPath) {
        try {
            await fs.rm(dirPath, { recursive: true, force: true });
            logger.info(`Cleaned up temp directory: ${dirPath}`);
        } catch (error) {
            logger.warn(`Temp cleanup failed: ${error.message}`);
        }
    }

    /**
     * Clean up Cloudinary file
     */
    async cleanupCloudinary(publicId) {
        try {
            await deleteFile(publicId);
            logger.info(`Cleaned up Cloudinary file: ${publicId}`);
        } catch (error) {
            logger.warn(`Cloudinary cleanup failed for ${publicId}: ${error.message}`);
        }
    }
}

module.exports = new ScraperService();
