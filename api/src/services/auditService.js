const axios = require('axios');
const React = require('react');
const ReactPDF = require('@react-pdf/renderer');
const fs = require('fs');
const path = require('path');
const AuditReportTemplate = require('../templates/AuditReportTemplate');
const { uploadFile } = require('../utils/cloudinary');

const REPORTS_DIR = path.join(__dirname, '../../public/reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

class AuditService {
    /**
     * Fetch insights from Google PageSpeed API
     */
    async fetchPageSpeedInsights(url) {
        const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
        if (!apiKey) {
            throw new Error('Google PageSpeed API Key is missing');
        }

        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES&strategy=mobile`;

        try {
            const response = await axios.get(apiUrl);
            return response.data;
        } catch (error) {
            console.error('PageSpeed API Error:', error.response?.data?.error?.message || error.message);
            throw new Error(`Failed to fetch PageSpeed insights: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Generate PDF from insights using React-PDF
     */
    async generateAuditPDF(business, insights) {
        const fileName = `audit_${business._id}_${Date.now()}.pdf`;
        const filePath = path.join(REPORTS_DIR, fileName);
        const publicId = `audit_reports/${business._id}`; // Deterministic ID for overwrite

        try {
            // Render to local temp file
            await ReactPDF.renderToFile(
                React.createElement(AuditReportTemplate, { business, insights }),
                filePath
            );

            // Upload to Cloudinary
            const result = await uploadFile(filePath, 'audit-reports', publicId);

            // Delete local temp file
            fs.unlinkSync(filePath);

            return {
                publicUrl: result.secure_url,
                publicId: result.public_id
            };
        } catch (error) {
            console.error('PDF Generation/Upload Error:', error);
            // Attempt to clean up local file if it exists
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            throw new Error(`Failed to generate PDF: ${error.message}`);
        }
    }
}

module.exports = new AuditService();
