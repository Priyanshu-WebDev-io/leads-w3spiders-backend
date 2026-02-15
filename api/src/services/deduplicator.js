const Business = require('../models/Business');
const GooglePlaceRaw = require('../models/GooglePlaceRaw');
const ScraperRaw = require('../models/ScraperRaw');
const logger = require('../utils/logger');


class DeduplicatorService {
    /**
     * Process and deduplicate businesses
     * @param {Array} businesses - Array of business objects
     * @param {string} sourceQuery - Original search query
     * @param {string} jobId - Job ID
     * @param {string} sourceType - 'google_places' | 'scraper'
     * @param {string} createdBy - User ID who created the job
     * @returns {Promise<Object>} - Stats about new/updated records
     */
    async processBusinesses(businesses, sourceQuery = '', jobId, sourceType = 'scraper', createdBy = null) {
        const stats = {
            total: businesses.length,
            new: 0,
            updated: 0,
            skipped: 0,
            errors: 0
        };

        logger.info(`Processing ${businesses.length} businesses from ${sourceType} (Job: ${jobId})`);

        // Collect IDs for bulk queuing
        const processedIds = [];

        for (const business of businesses) {
            try {
                // 1. Save Raw Data
                const rawId = await this.saveRawData(business, sourceType, jobId, sourceQuery);

                // 2. Upsert into Unified Model
                const businessId = await this.upsertBusiness(business, sourceQuery, stats, sourceType, rawId, createdBy);

                if (businessId) {
                    processedIds.push({ _id: businessId });
                }
            } catch (error) {
                logger.error(`Error processing business: ${error.message}`, {
                    business: business.title || business.name,
                    place_id: business.place_id
                });
                stats.errors++;
            }
        }



        logger.info('Deduplication/Merge complete', stats);
        return stats;
    }

    /**
     * Save raw data to respective collection
     */
    async saveRawData(data, sourceType, jobId, sourceQuery) {
        try {
            const placeId = data.place_id || data.cid; // Scraper might use cid
            if (!placeId) return null;

            const payload = {
                job_id: jobId,
                place_id: placeId,
                data: data,
                source_query: sourceQuery
            };

            let rawDoc;
            if (sourceType === 'google_places') {
                rawDoc = await GooglePlaceRaw.create(payload);
            } else {
                rawDoc = await ScraperRaw.create(payload);
            }
            return rawDoc._id;
        } catch (error) {
            logger.error(`Failed to save raw data: ${error.message}`);
            return null;
        }
    }

    /**
     * Upsert a single business (Smart Merge)
     */
    async upsertBusiness(business, sourceQuery, stats, sourceType, rawId, createdBy) {
        const placeId = business.place_id || business.cid;

        if (!placeId) {
            stats.skipped++;
            return;
        }

        // Normalize New Data
        const normalized = this.normalizeBusiness(business, sourceType);

        // Validate: Reject businesses without ANY contact information
        const hasPhone = normalized.phone && normalized.phone.trim() !== '';
        const hasWebsite = normalized.website && normalized.website.trim() !== '';
        const hasEmail = normalized.emails && normalized.emails.length > 0;

        if (!hasPhone && !hasWebsite && !hasEmail) {
            logger.info(`Skipping business "${normalized.name}" - No contact information (phone, website, or email)`);
            stats.skipped++;
            return;
        }

        // Find Existing
        let existing = await Business.findOne({ place_id: placeId });

        if (existing) {
            // MERGE: Update missing info or override specific fields
            let updated = false;

            // Update standard fields if missing in DB OR if source provides better data (logic can be refined)
            // For now, simple "Update if missing or empty" + "Concat Arrays" strategy

            // 1. Basic Fields (Strings) - Update if missing
            ['phone', 'website', 'address', 'city', 'state', 'zip', 'country', 'latitude', 'longitude', 'category'].forEach(field => {
                if (!existing[field] && normalized[field]) {
                    existing[field] = normalized[field];
                    updated = true;
                }
            });

            // Fix empty status field (scraper bug)
            if (!existing.status || existing.status === '') {
                existing.status = 'new';
                updated = true;
            }

            // 2. Arrays (Emails, Images) - Union
            if (normalized.emails && normalized.emails.length > 0) {
                const combined = new Set([...(existing.emails || []), ...normalized.emails]);
                if (combined.size > (existing.emails || []).length) {
                    existing.emails = Array.from(combined);
                    updated = true;
                }
            }
            // Images - Union
            if (normalized.images && normalized.images.length > 0) {
                const combined = new Set([...(existing.images || []), ...normalized.images]);
                if (combined.size > (existing.images || []).length) {
                    existing.images = Array.from(combined);
                    updated = true;
                }
            }

            // 3. Lineage - Add Source if new
            const hasSource = existing.sources.some(s => s.type === sourceType);
            if (!hasSource) {
                existing.sources.push({ type: sourceType });
                updated = true;
            }

            // 4. Raw References - Add always for audit
            if (rawId) {
                existing.raw_references.push({ source: sourceType, raw_id: rawId });
                updated = true;
            }

            if (updated) {
                existing.last_updated = new Date();
                await existing.save();
                stats.updated++;
                return existing._id;
            } else {
                stats.skipped++;
                return existing._id; // Still return ID to trigger re-filtration if needed
            }

        } else {
            // INSERT - Set status explicitly to override any empty value from scraper
            if (!normalized.status || normalized.status === '') {
                normalized.status = 'new';
            }
            normalized.sources = [{ type: sourceType }];
            if (rawId) {
                normalized.raw_references = [{ source: sourceType, raw_id: rawId }];
            }
            normalized.first_seen = new Date();

            // Set ownership
            if (createdBy) {
                normalized.createdBy = createdBy;
            }

            const newDoc = await Business.create(normalized);
            stats.new++;
            return newDoc._id;
        }
    }

    normalizeBusiness(data, sourceType) {
        // Unwrap scraper data if nested
        const rawData = sourceType === 'scraper' && data.data ? data.data : data;

        // Map common fields based on known structure of Google API vs Scraper
        // Scraper: title, phone, website, etc.
        // Google API: name, formatted_phone_number, website, etc.

        const mapped = {
            place_id: rawData.place_id || rawData.cid,
            name: rawData.name || rawData.title,
            address: rawData.formatted_address || rawData.address || rawData.complete_address?.street,
            city: rawData.complete_address?.city,
            state: rawData.complete_address?.state,
            zip: rawData.complete_address?.postal_code,
            country: rawData.complete_address?.country,
            phone: rawData.formatted_phone_number || rawData.phone || rawData.phone_number,
            website: rawData.website || rawData.web_site || rawData.url,

            emails: rawData.emails || [],

            latitude: rawData.geometry?.location?.lat || rawData.latitude,
            longitude: rawData.geometry?.location?.lng || rawData.longtitude || rawData.longitude,

            rating: rawData.rating || rawData.review_rating,
            review_count: rawData.user_ratings_total || rawData.reviews || rawData.review_count,

            // New Fields for Advanced Filters
            price_level: rawData.price_level, // Google: 0-4
            business_status: rawData.business_status, // Google: 'OPERATIONAL'
            open_state: rawData.current_opening_hours?.open_now ? 'Open' : (rawData.open_state || ''),
            working_hours: rawData.opening_hours || rawData.working_hours,

            category: (rawData.types && rawData.types[0]) || rawData.category,
            additional_categories: rawData.categories || rawData.types,

            // Handle images - scraper uses objects with title/image, Google uses photo references
            images: rawData.photos
                ? rawData.photos.map(p => p.photo_reference) // Store reference for Google
                : (rawData.images || [])
        };

        // Clean undefined, null, and empty strings to prevent validation errors
        Object.keys(mapped).forEach(key => {
            if (mapped[key] === undefined || mapped[key] === null || mapped[key] === '') {
                delete mapped[key];
            }
        });

        return mapped;
    }

    /**
     * Get duplicate statistics
     */
    async getDuplicateStats() {
        // ... (keep existing implementation)
        const total = await Business.countDocuments();
        const withEmails = await Business.countDocuments({ emails: { $exists: true, $ne: [] } });
        const withWebsite = await Business.countDocuments({ website: { $exists: true, $ne: null } });

        return {
            total_businesses: total,
            with_emails: withEmails,
            with_website: withWebsite,
            email_percentage: total > 0 ? ((withEmails / total) * 100).toFixed(2) : 0,
            website_percentage: total > 0 ? ((withWebsite / total) * 100).toFixed(2) : 0
        };
    }
}

module.exports = new DeduplicatorService();
