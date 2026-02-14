const Job = require('../models/Job');
const Schedule = require('../models/Schedule');

/**
 * Checks for duplicate queries against job history.
 * @param {string[]} queries - List of raw query strings
 * @param {string} provider - 'google_places' | 'scraper'
 * @returns {Promise<{uniqueQueries: string[], skippedCount: number}>}
 */
exports.checkDuplicates = async (queries, provider) => {
    // Normalize
    const normalizedQueries = queries.map(q => q.trim().toLowerCase());
    const uniqueInput = [...new Set(normalizedQueries)]; // Remove duplicates within the input itself

    // Find existing jobs with these queries
    const existingJobs = await Job.find({
        queries: { $in: uniqueInput },
        'config.provider': provider,
        status: { $in: ['completed', 'running'] } // Only check completed/running jobs
    }).select('queries');

    // Extract all queries from existing jobs
    const existingSet = new Set();
    existingJobs.forEach(job => {
        job.queries.forEach(q => existingSet.add(q.toLowerCase()));
    });

    // Filter
    const uniqueQueries = uniqueInput.filter(q => !existingSet.has(q));
    const skippedCount = queries.length - uniqueQueries.length;

    return { uniqueQueries, skippedCount };
};

/**
 * No longer needed - Jobs are the source of truth
 * Keeping empty function for backward compatibility
 */
exports.logQueries = async (queries, provider, referenceId) => {
    // Jobs are automatically logged when created
    return;
};

/**
 * Checks for conflicts with currently RUNNING jobs or ACTIVE schedules.
 * @param {string[]} queries - List of raw query strings
 * @returns {Promise<{uniqueQueries: string[], conflictCount: number, conflicts: string[]}>}
 */
exports.checkActiveConflicts = async (queries) => {
    // Normalize input
    const normalizedInput = queries.map(q => q.trim().toLowerCase());
    const uniqueInput = [...new Set(normalizedInput)];

    // 1. Get queries from Running/Queued Jobs
    const activeJobs = await Job.find({
        status: { $in: ['pending', 'running', 'processing'] }
    }).select('queries');

    // 2. Get queries from Active Schedules (pending/active)
    const activeSchedules = await Schedule.find({
        is_active: true,
        status: { $in: ['active', 'pending'] }
    }).select('queries');

    // Collect all active queries
    const activeQuerySet = new Set();

    activeJobs.forEach(job => {
        if (job.queries) job.queries.forEach(q => activeQuerySet.add(q.trim().toLowerCase()));
    });

    activeSchedules.forEach(sched => {
        if (sched.queries) sched.queries.forEach(q => activeQuerySet.add(q.trim().toLowerCase()));
    });

    // Filter input against active set
    const uniqueQueries = uniqueInput.filter(q => !activeQuerySet.has(q));
    const conflicts = uniqueInput.filter(q => activeQuerySet.has(q));

    return {
        uniqueQueries,
        conflictCount: conflicts.length,
        conflicts
    };
};
