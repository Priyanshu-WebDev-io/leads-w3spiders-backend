const Settings = require('../models/Settings');
const logger = require('../utils/logger');

// @desc    Get global settings
// @route   GET /api/settings
// @access  Private/Admin
const getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne({ key: 'global' });
        if (!settings) {
            // Return defaults if not found
            settings = new Settings({ key: 'global' });
        }

        // Convert to object to modify avoiding DB save
        const settingsObj = settings.toObject();

        // Mask API Key if it exists
        if (settingsObj.google_places_config && settingsObj.google_places_config.api_key) {
            const key = settingsObj.google_places_config.api_key;
            // Send metadata instead of the key
            settingsObj.google_places_config.api_key_alias = `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
            settingsObj.google_places_config.api_key_length = key.length;
            settingsObj.google_places_config.is_set = true;
            delete settingsObj.google_places_config.api_key;
        }

        res.json({ success: true, settings: settingsObj });
    } catch (error) {
        logger.error(`Failed to fetch settings: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Update global settings
// @route   PUT /api/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
    try {
        const update = req.body;

        let settings = await Settings.findOne({ key: 'global' });

        if (!settings) {
            settings = new Settings({ key: 'global', ...update });
        } else {
            // Handle API Key preservation (One-Way Traffic)
            const newKey = update.google_places_config && update.google_places_config.api_key;

            // Clean up metadata fields from payload if present
            if (update.google_places_config) {
                delete update.google_places_config.api_key_alias;
                delete update.google_places_config.api_key_length;
                delete update.google_places_config.is_set;

                if (!newKey) {
                    // No new key provided (or empty string/undefined), preserve existing key
                    // If existing config exists, use its key
                    if (settings.google_places_config && settings.google_places_config.api_key) {
                        update.google_places_config.api_key = settings.google_places_config.api_key;
                    }
                }
            }

            settings.set(update);
        }

        await settings.save();

        // Mask for response
        const settingsObj = settings.toObject();
        if (settingsObj.google_places_config && settingsObj.google_places_config.api_key) {
            const key = settingsObj.google_places_config.api_key;
            settingsObj.google_places_config.api_key_alias = `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
            settingsObj.google_places_config.api_key_length = key.length;
            settingsObj.google_places_config.is_set = true;
            delete settingsObj.google_places_config.api_key;
        }

        res.json({ success: true, settings: settingsObj });
    } catch (error) {
        logger.error(`Failed to update settings: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
