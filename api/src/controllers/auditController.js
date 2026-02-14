const Business = require('../models/Business');
const auditService = require('../services/auditService');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

exports.generateReport = async (req, res) => {
    try {
        const { id } = req.params;
        const business = await Business.findById(id);

        if (!business) {
            return res.status(404).json({ success: false, message: 'Business not found' });
        }

        if (!business.website) {
            return res.status(400).json({ success: false, message: 'Business has no website' });
        }

        // 1. Update status to pending
        business.audit_report = {
            ...business.audit_report,
            status: 'pending',
            generated_at: new Date()
        };
        await business.save();

        // 2. Fetch Insights
        logger.info(`Fetching PageSpeed insights for ${business.website}...`);
        const insights = await auditService.fetchPageSpeedInsights(business.website);

        logger.info(`Insights fetched for ${business.name}: ${JSON.stringify(insights)}`);

        // 3. Generate PDF (Uploads to Cloudinary)
        logger.info(`Generating PDF for ${business.name}...`);
        const { publicUrl, publicId } = await auditService.generateAuditPDF(business, insights);

        // 4. Update Business Record
        business.audit_report = {
            generated_at: new Date(),
            insights: insights, // Store raw data (maybe prune huge JSON later of needed)
            pdf_path: publicId, // Storing Cloudinary Public ID here
            status: 'completed',
            public_url: publicUrl
        };
        await business.save();

        logger.info(`Audit report generated: ${publicUrl}`);

        res.json({
            success: true,
            message: 'Audit report generated successfully',
            report: business.audit_report
        });

    } catch (error) {
        logger.error(`Audit generation failed: ${error.message}`);

        // Try to update status to failed
        try {
            await Business.updateOne(
                { _id: req.params.id },
                {
                    $set: {
                        'audit_report.status': 'failed',
                        'audit_report.generated_at': new Date()
                    }
                }
            );
        } catch (e) { }

        res.status(500).json({ success: false, message: error.message });
    }
};

exports.serveReport = async (req, res) => {
    try {
        const { id } = req.params;
        const business = await Business.findById(id);

        if (!business || !business.audit_report || !business.audit_report.public_url) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        // Redirect to Cloudinary URL
        res.redirect(business.audit_report.public_url);

    } catch (error) {
        logger.error(`Failed to serve PDF: ${error.message}`);
        res.status(500).json({ success: false, message: 'Failed to download report' });
    }
};
