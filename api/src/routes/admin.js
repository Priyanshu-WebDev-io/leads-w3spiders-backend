const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { startScrape, getJobs, getJobById } = require('../controllers/jobController');
const { getDashboardStats, getBusinesses, updateBusiness } = require('../controllers/businessController');
const { getStats } = require('../controllers/statController');
const { getGoogleRaw, getScraperRaw } = require('../controllers/rawController');
const { protect, checkPermission } = require('../middleware/authMiddleware');

// Apply protection to all admin routes
router.use(protect);

// Job Routes
router.post('/scrape/start', checkPermission('run_scraper'), startScrape);
router.get('/jobs', checkPermission('view_operations'), getJobs);
router.get('/jobs/:id', checkPermission('view_operations'), getJobById);

// Business Routes
router.get('/businesses/stats', checkPermission('view_dashboard'), getDashboardStats);
router.get('/businesses', checkPermission('view_data'), getBusinesses);
router.put('/businesses/:id', checkPermission('view_data'), updateBusiness); // Maybe manage_data? Frontend says 'view_data' covers access? "Access to leads data".

// Stats
router.get('/stats', checkPermission('view_dashboard'), getStats);

// Raw Data
router.get('/raw/google', checkPermission('export_data'), getGoogleRaw);
router.get('/raw/scraper', checkPermission('export_data'), getScraperRaw);

// Audit Report Routes (Existing)
router.post('/audit/:id', auditController.generateReport);
router.get('/audit/:id/pdf', auditController.serveReport);

module.exports = router;
