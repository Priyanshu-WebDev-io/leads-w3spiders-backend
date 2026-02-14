const PERMISSIONS = [
    { id: 'view_dashboard', label: 'View Dashboard', description: 'Access to the main dashboard' },
    { id: 'view_operations', label: 'View Operations', description: 'Access to operations center (jobs, history)' },
    { id: 'view_data', label: 'View Business Data', description: 'Access to scraped data and leads' },
    { id: 'view_logs', label: 'View System Logs', description: 'Access to system logs' },
    { id: 'manage_users', label: 'Manage Users', description: 'Create, update, and delete users' },
    { id: 'manage_roles', label: 'Manage Roles', description: 'Create and update roles' },
    { id: 'run_scraper', label: 'Run Scraper', description: 'Trigger new scraping jobs' },
    { id: 'manage_schedules', label: 'Manage Schedules', description: 'Create and modify schedules' },
    { id: 'export_data', label: 'Export Data', description: 'Export data to CSV/Excel' },
    { id: 'manage_settings', label: 'Manage Settings', description: 'Modify system configuration' }
];

module.exports = PERMISSIONS;
