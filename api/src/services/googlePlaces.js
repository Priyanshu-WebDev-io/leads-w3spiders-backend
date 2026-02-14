const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const Settings = require('../models/Settings');

class GooglePlacesService {
    constructor() {
        this.dataDir = process.env.DATA_DIR || os.tmpdir();
    }

    /**
     * Check if API can run based on daily limit
     * @returns {Promise<{allowed: boolean, reason: string}>}
     */
    async checkLimit() {
        const settings = await Settings.findOne({ key: 'global' });
        if (!settings || !settings.google_places_config || !settings.google_places_config.api_key) {
            return { allowed: false, reason: "No API Key" };
        }
        const gpConfig = settings.google_places_config;

        // Check reset
        const today = new Date();
        const lastReset = new Date(gpConfig.last_reset_date);
        if (today.toDateString() !== lastReset.toDateString()) {
            // Will require update, but for check just return true assuming reset happens on run
            return { allowed: true, reason: "New Day" };
        }

        if (gpConfig.calls_today >= gpConfig.daily_limit) {
            return { allowed: false, reason: "Daily Limit Reached" };
        }

        return { allowed: true, reason: "Within Limit" };
    }

    /**
     * Execute search using Google Places API
     * @param {Array<string>} queries - List of search queries
     * @param {string} jobId - Unique job identifier
     * @param {Object} config - Job configuration
     * @returns {Promise<Object>} - Result with local_path
     */
    async executeScrape(queries, jobId, config = {}) {
        let tempVolumePath = null;

        try {
            logger.info(`Starting Google Places API job ${jobId} with ${queries.length} queries`);

            // 1. Check Restrictions & Get Config
            const settings = await Settings.findOne({ key: 'global' });
            if (!settings || !settings.google_places_config || !settings.google_places_config.api_key) {
                throw new Error('Google Places API not configured or missing API Key');
            }

            const gpConfig = settings.google_places_config;

            // Check Daily Limit
            const today = new Date();
            const lastReset = new Date(gpConfig.last_reset_date);
            const isSameDay = today.toDateString() === lastReset.toDateString();

            if (!isSameDay) {
                gpConfig.calls_today = 0;
                gpConfig.last_reset_date = today;
            }

            if (gpConfig.calls_today >= gpConfig.daily_limit) {
                throw new Error(`Daily limit of ${gpConfig.daily_limit} calls reached.`);
            }

            // 2. Setup Temp Dir
            await fs.mkdir(this.dataDir, { recursive: true });
            tempVolumePath = path.join(this.dataDir, `scraper-${jobId}`);
            await fs.mkdir(tempVolumePath, { recursive: true });

            // 3. fetch places
            const allPlaces = [];
            const apiKey = gpConfig.api_key;
            // Determined by job config > settings (basic, contact, atmosphere)
            const fieldsLevel = config.fields_level || gpConfig.fields_level || 'contact';

            // Calculate remaining allowance
            let remainingCalls = gpConfig.daily_limit - gpConfig.calls_today;

            // Filter queries to what we CAN potentially start. 
            // Note: Pagination means 1 query might consume 2-3 calls.
            // We'll check the limit INSIDE the loop strictly.

            for (const query of queries) {
                // Pre-check before starting a new query string
                if (remainingCalls <= 0) {
                    logger.warn(`Daily API limit reached. Stopping job.`);
                    break;
                }

                if (!query || !query.trim()) continue;

                try {
                    // Pagination Loop
                    let nextPageToken = null;
                    let pageCount = 0;

                    // Priority: Job Config > Global Settings > Default Safety (1 page)
                    const maxPagesPerQuery = config.max_pages || gpConfig.default_max_pages || 1;
                    // Absolute Cap: 3 pages (Google Limit)
                    const effectiveMaxPages = Math.min(maxPagesPerQuery, 3);

                    do {
                        // Strict check before EVERY API Call (Page 1, 2, 3...)
                        if (gpConfig.calls_today >= gpConfig.daily_limit) {
                            logger.warn(`Daily limit reached during pagination (Query: "${query}", Page: ${pageCount + 1}). Stopping.`);
                            remainingCalls = 0;
                            break;
                        }

                        // Execute Request
                        // Pass nextPageToken if it exists (for pg 2, 3)
                        const responseData = await this.searchPlaces(query, apiKey, fieldsLevel, nextPageToken);

                        const places = responseData.places || [];
                        nextPageToken = responseData.nextPageToken; // Update token for next loop

                        // STOP IF NO RESULTS: Don't trust nextPageToken if current page is empty
                        if (places.length === 0) {
                            logger.info(`Query "${query}" Page ${pageCount + 1}: returned 0 results. Stopping pagination.`);
                            break;
                        }

                        allPlaces.push(...places);

                        // Increment Usage
                        gpConfig.calls_today++;
                        remainingCalls--;
                        pageCount++;

                        // Log progress
                        logger.info(`Query "${query}" Page ${pageCount}: Found ${places.length} places. (Total Usage: ${gpConfig.calls_today}/${gpConfig.daily_limit})`);

                    } while (nextPageToken && pageCount < effectiveMaxPages && remainingCalls > 0);

                } catch (err) {
                    logger.error(`Google Places search failed for query "${query}": ${err.message}`);
                }
            }

            // Save updated stats
            await Settings.findOneAndUpdate({ key: 'global' }, {
                $set: {
                    'google_places_config.calls_today': gpConfig.calls_today,
                    'google_places_config.last_reset_date': gpConfig.last_reset_date
                }
            });

            // 4. Transform and Save Output
            const transformedData = allPlaces.map(p => this.transformPlace(p));

            const outputPath = path.join(tempVolumePath, 'output.json');
            await fs.writeFile(outputPath, JSON.stringify(transformedData, null, 2));

            logger.info(`Google Places job ${jobId} completed. Found ${transformedData.length} places. API Calls Used: ${gpConfig.calls_today}`);

            return {
                local_path: outputPath,
                provider: 'google_places',
                cloudinary_url: null, // Not applicable
                cloudinary_public_id: null
            };

        } catch (error) {
            logger.error(`Google Places job ${jobId} failed: ${error.message}`);
            // Cleanup on error
            if (tempVolumePath && process.env.CLEANUP_TEMP === 'true') {
                await fs.rm(tempVolumePath, { recursive: true, force: true }).catch(e => logger.warn(e.message));
            }
            throw error;
        }
    }

    /**
     * Search using New Google Places API (Text Search)
     */
    async searchPlaces(textQuery, apiKey, level = 'contact', pageToken = null) {
        const url = 'https://places.googleapis.com/v1/places:searchText';

        // Define Field Buckets
        const basicFields = [
            'places.id',
            'places.displayName',
            'places.formattedAddress',
            'places.location',
            'places.photos',
            'places.types',
            'places.primaryTypeDisplayName'
        ];

        const contactFields = [
            'places.nationalPhoneNumber',
            'places.internationalPhoneNumber',
            'places.websiteUri',
            'places.priceLevel',
            'places.businessStatus'
        ];

        const atmosphereFields = [
            'places.rating',
            'places.userRatingCount',
            'places.regularOpeningHours'
        ];

        let selectedFields = [...basicFields];

        if (level === 'contact' || level === 'atmosphere') {
            selectedFields = [...selectedFields, ...contactFields];
        }

        if (level === 'atmosphere') {
            selectedFields = [...selectedFields, ...atmosphereFields];
        }

        // Add nextPageToken to field mask to ensure we get it back?
        // Actually, nextPageToken is a top-level field in the response, NOT inside 'places'.
        // The X-Goog-FieldMask applies to *response fields*.
        // If we want nextPageToken, we must add 'nextPageToken' to the mask.
        selectedFields.push('nextPageToken');

        const fieldMask = selectedFields.join(',');

        const body = {
            textQuery: textQuery,
            maxResultCount: 20 // Default reasonable batch
        };

        // Add pageToken if checking subsequent pages
        if (pageToken) {
            body.pageToken = pageToken;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': fieldMask
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error ${response.status}: ${errText}`);
            }

            const data = await response.json();
            // Return whole data object to access nextPageToken
            return data;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Transform Google Place object to internal Business format
     */
    transformPlace(place) {
        // Extract category (primary type or first type)
        let category = 'Unknown';
        if (place.primaryTypeDisplayName?.text) {
            category = place.primaryTypeDisplayName.text;
        } else if (place.types && place.types.length > 0) {
            // Format "restaurant_restaurant" -> "Restaurant"
            category = place.types[0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }

        // Extract photo reference if available (first photo)
        const photoRef = place.photos && place.photos.length > 0 ? place.photos[0].name : null;

        return {
            // Identifiers
            place_id: place.id,
            input_id: place.id, // Scraper often has this

            // Basic Info
            name: place.displayName?.text || '',
            title: place.displayName?.text, // Alias for scraper compatibility

            // Contact
            address: place.formattedAddress,
            phone: place.nationalPhoneNumber,
            phone_international: place.internationalPhoneNumber,
            website: place.websiteUri,

            // Location
            latitude: place.location?.latitude,
            longitude: place.location?.longitude,

            // Details
            category: category,
            types: place.types,
            rating: place.rating,
            reviews: place.userRatingCount, // Scraper might use 'reviews' for count
            reviews_count: place.userRatingCount,
            price_level: place.priceLevel,
            business_status: place.businessStatus,

            // Hours
            opening_hours: place.regularOpeningHours,
            open_state: place.regularOpeningHours?.openNow ? 'Open' : 'Closed',

            // Images
            main_photo_ref: photoRef,

            // Metadata
            source: 'google_places_api',
            fetched_at: new Date().toISOString()
        };
    }
}

module.exports = new GooglePlacesService();
