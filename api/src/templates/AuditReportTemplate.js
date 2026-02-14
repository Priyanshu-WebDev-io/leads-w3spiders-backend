const React = require('react');
const { Page, Text, View, Document, StyleSheet, Font, Image, Link } = require('@react-pdf/renderer');

// Helper for React.createElement
const h = React.createElement;

// Register Fonts
Font.register({
    family: 'Helvetica',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/helveticaneue/v1/1PTSg8zYS_SKfqw6dbNsWw.ttf' }, // Regular
        { src: 'https://fonts.gstatic.com/s/helveticaneue/v1/1PTSg8zYS_SKfqw6dbNsWw.ttf', fontWeight: 700 }, // Bold
    ]
});

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 40,
        fontFamily: 'Helvetica'
    },
    // Common
    brand: {
        fontSize: 10,
        color: '#94A3B8',
        position: 'absolute',
        top: 20,
        right: 40
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 40,
        right: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        fontSize: 9,
        color: '#94A3B8',
        borderTopWidth: 1,
        borderTopStyle: 'solid',
        borderTopColor: '#E2E8F0',
        paddingTop: 10
    },
    // Page 1: Cover
    coverContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    coverImage: {
        width: 400,
        height: 220,
        objectFit: 'cover',
        borderRadius: 10,
        marginBottom: 20,
        backgroundColor: '#F1F5F9'
    },
    galleryRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
        height: 80
    },
    galleryImg: {
        width: 100,
        height: 80,
        borderRadius: 6,
        objectFit: 'cover',
        backgroundColor: '#F1F5F9'
    },
    coverTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 5
    },
    coverSubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 20
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#FCD34D'
    },
    starText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#D97706',
        marginRight: 5
    },
    reviewText: {
        fontSize: 12,
        color: '#B45309'
    },
    bizInfoBox: {
        backgroundColor: '#F8FAFC',
        padding: 20,
        borderRadius: 8,
        width: '100%',
        marginBottom: 20
    },
    bizInfoRow: {
        flexDirection: 'row',
        marginBottom: 8
    },
    bizLabel: {
        width: 100,
        fontSize: 10,
        color: '#64748B',
        fontWeight: 'bold'
    },
    bizValue: {
        flex: 1,
        fontSize: 10,
        color: '#334155'
    },
    socialRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 5
    },
    socialLink: {
        fontSize: 9,
        color: '#2563EB',
        textDecoration: 'none',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4
    },
    scoreSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 20
    },
    scoreCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderStyle: 'solid'
    },
    scoreVal: {
        fontSize: 20,
        fontWeight: 'bold'
    },
    scoreLabel: {
        fontSize: 10,
        marginTop: 5,
        color: '#475569',
        textAlign: 'center'
    },

    // Page 2: Deep Dive
    pageTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: '#E2E8F0',
        paddingBottom: 10
    },
    metricSection: {
        marginBottom: 20
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: '#F1F5F9'
    },
    metricName: {
        fontSize: 12,
        color: '#334155'
    },
    metricVal: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0F172A'
    },
    vitalBox: {
        padding: 15,
        backgroundColor: '#F0F9FF',
        borderRadius: 6,
        marginBottom: 10
    },
    vitalTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0369A1',
        marginBottom: 5
    },
    vitalDesc: {
        fontSize: 10,
        color: '#0C4A6E',
        lineHeight: 1.4
    },

    // Page 3: Actions
    opportunityCard: {
        marginBottom: 15,
        padding: 15,
        backgroundColor: '#FFF1F2',
        borderRadius: 6,
        borderLeftWidth: 4,
        borderLeftStyle: 'solid',
        borderLeftColor: '#E11D48'
    },
    oppTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#881337',
        marginBottom: 5
    },
    oppDesc: {
        fontSize: 10,
        color: '#9F1239',
        lineHeight: 1.4,
        marginBottom: 5
    },
    savings: {
        fontSize: 9,
        color: '#BE123C',
        fontStyle: 'italic'
    }
});

// Helper to safely get image URL
const getSafeImageUrl = (img) => {
    let url = null;
    if (typeof img === 'string') url = img;
    else if (typeof img === 'object' && img?.url) url = img.url;

    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        return url;
    }
    return null;
};

// Helper to get color based on score
const getScoreColor = (score) => {
    if (score >= 90) return '#22C55E'; // Green
    if (score >= 50) return '#F59E0B'; // Orange
    return '#EF4444'; // Red
};

const AuditReportTemplate = ({ business, insights }) => {
    // Extract Scores
    const categories = insights?.lighthouseResult?.categories || {};
    const performance = Math.round((categories.performance?.score || 0) * 100);
    const seo = Math.round((categories.seo?.score || 0) * 100);
    const accessibility = Math.round((categories.accessibility?.score || 0) * 100);

    // Extract Vitals
    const audits = insights?.lighthouseResult?.audits || {};
    const lcp = audits['largest-contentful-paint']?.displayValue;
    const cls = audits['cumulative-layout-shift']?.displayValue;
    const tbt = audits['total-blocking-time']?.displayValue;
    const fcp = audits['first-contentful-paint']?.displayValue;
    const si = audits['speed-index']?.displayValue;

    // Opportunities
    const opportunities = Object.values(audits)
        .filter(audit => audit.score !== null && audit.score < 0.9 && audit.details?.type === 'opportunity')
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .slice(0, 8);

    // Images Handling
    const rawImages = Array.isArray(business.images) ? business.images : [];
    const validImages = rawImages.map(getSafeImageUrl).filter(Boolean);

    // Fallback Image
    const fallbackImage = 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image';

    // Select main image and gallery images
    const mainImage = validImages.length > 0 ? validImages[0] : fallbackImage;
    const galleryImages = validImages.length > 1 ? validImages.slice(1, 4) : [];

    // Socials
    const socials = business.social_profiles || {};
    const socialKeys = Object.keys(socials).filter(k => socials[k]);

    const getScoreComp = (score, label) => {
        const color = getScoreColor(score);
        return h(View, { style: { alignItems: 'center' } },
            h(View, { style: [styles.scoreCircle, { borderColor: color }] },
                h(Text, { style: [styles.scoreVal, { color }] }, score)
            ),
            h(Text, { style: styles.scoreLabel }, label)
        );
    };

    return h(Document, null,
        // --- PAGE 1: COVER & SUMMARY ---
        h(Page, { size: 'A4', style: styles.page },
            // Prominent Header
            h(View, { style: { marginBottom: 20, borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: '#2563EB', paddingBottom: 10 } },
                h(Text, { style: { fontSize: 24, fontWeight: 'bold', color: '#2563EB' } }, "W3Spiders Digital Audit"),
                h(Text, { style: { fontSize: 10, color: '#64748B', marginTop: 4 } }, "Comprehensive Website Performance Analysis")
            ),

            h(View, { style: styles.coverContainer },
                // Main Hero Image
                h(Image, { src: mainImage, style: styles.coverImage }),

                // Gallery (if available) - Small row below main image
                galleryImages.length > 0 && h(View, { style: styles.galleryRow },
                    galleryImages.map((img, i) =>
                        h(Image, { key: i, src: img, style: styles.galleryImg })
                    )
                ),

                h(Text, { style: styles.coverTitle }, business.name),
                h(Text, { style: styles.coverSubtitle }, business.website || "No Website Provided"),

                // Rating Badge
                (business.rating > 0) && h(View, { style: styles.ratingRow },
                    h(Text, { style: styles.starText }, `★ ${business.rating}`),
                    h(Text, { style: styles.reviewText }, `(${business.review_count || 0} Reviews)`)
                ),

                h(View, { style: styles.bizInfoBox },
                    h(View, { style: styles.bizInfoRow },
                        h(Text, { style: styles.bizLabel }, "Category:"),
                        h(Text, { style: styles.bizValue },
                            [business.category, ...(business.additional_categories || [])].filter(Boolean).join(', ')
                        )
                    ),
                    h(View, { style: styles.bizInfoRow },
                        h(Text, { style: styles.bizLabel }, "Address:"),
                        h(Text, { style: styles.bizValue }, business.address || `${business.city || ''}, ${business.state || ''}`)
                    ),
                    h(View, { style: styles.bizInfoRow },
                        h(Text, { style: styles.bizLabel }, "Contact:"),
                        h(Text, { style: styles.bizValue },
                            [business.phone, business.emails?.[0]].filter(Boolean).join(' • ')
                        )
                    ),

                    // Social Profiles
                    socialKeys.length > 0 && h(View, { style: styles.bizInfoRow },
                        h(Text, { style: styles.bizLabel }, "Socials:"),
                        h(View, { style: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 } },
                            socialKeys.map(key =>
                                h(Link, { key, src: socials[key], style: styles.socialLink },
                                    key.charAt(0).toUpperCase() + key.slice(1)
                                )
                            )
                        )
                    )
                ),

                h(View, { style: styles.scoreSummary },
                    getScoreComp(performance, "Performance"),
                    getScoreComp(seo, "SEO"),
                    getScoreComp(accessibility, "Accessibility")
                )
            ),

            h(View, { style: styles.footer },
                h(Text, null, "Page 1 of 3: Business Overview"),
                h(Text, null, `Generated by W3Spiders CRM at ${new Date().toLocaleTimeString()}`)
            )
        ),

        // --- PAGE 2: TECHNICAL DEEP DIVE ---
        h(Page, { size: 'A4', style: styles.page },
            // Header
            h(View, { style: { marginBottom: 20, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: '#E2E8F0', paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
                h(Text, { style: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' } }, "W3Spiders Audit"),
                h(Text, { style: { fontSize: 10, color: '#64748B' } }, new Date().toLocaleDateString())
            ),

            h(Text, { style: styles.pageTitle }, "Technical Performance"),

            h(View, { style: styles.metricSection },
                h(View, { style: styles.vitalBox },
                    h(Text, { style: styles.vitalTitle }, "Core Web Vitals"),
                    h(Text, { style: styles.vitalDesc }, "These metrics directly affect Google rankings and user experience.")
                ),

                h(View, { style: styles.metricRow },
                    h(Text, { style: styles.metricName }, "Largest Contentful Paint (LCP)"),
                    h(Text, { style: styles.metricVal }, lcp || "N/A")
                ),
                h(View, { style: styles.metricRow },
                    h(Text, { style: styles.metricName }, "Cumulative Layout Shift (CLS)"),
                    h(Text, { style: styles.metricVal }, cls || "N/A")
                ),
                h(View, { style: styles.metricRow },
                    h(Text, { style: styles.metricName }, "Total Blocking Time (TBT)"),
                    h(Text, { style: styles.metricVal }, tbt || "N/A")
                )
            ),

            h(View, { style: styles.metricSection },
                h(Text, { style: { ...styles.vitalTitle, marginTop: 20 } }, "Lab Data Metrics"),

                h(View, { style: styles.metricRow },
                    h(Text, { style: styles.metricName }, "First Contentful Paint (FCP)"),
                    h(Text, { style: styles.metricVal }, fcp || "N/A")
                ),
                h(View, { style: styles.metricRow },
                    h(Text, { style: styles.metricName }, "Speed Index"),
                    h(Text, { style: styles.metricVal }, si || "N/A")
                )
            ),

            h(View, { style: styles.footer },
                h(Text, null, "Page 2 of 3: Technical Metrics"),
                h(Text, null, "Generated by W3Spiders CRM")
            )
        ),
    );
};

module.exports = AuditReportTemplate;
