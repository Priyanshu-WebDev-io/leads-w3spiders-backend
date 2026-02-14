const mongoose = require('mongoose');
const User = require('../src/models/User');
const Role = require('../src/models/Role');
const dotenv = require('dotenv');
const connectDB = require('../src/config/database');

dotenv.config();

const seedUsers = async () => {
    try {
        await connectDB();

        // 1. Delete all existing users and roles
        console.log('Clearing existing users and roles...');
        await User.deleteMany({});
        await Role.deleteMany({});

        // 2. Create Roles
        console.log('Creating Roles...');

        const superAdminRole = await Role.create({
            name: 'Super Admin',
            permissions: [], // Super Admin logic handles this implicitly, or add all
            description: 'Full system access',
            isDefault: true
        });

        const leadsGeneratorRole = await Role.create({
            name: 'Leads Generator',
            permissions: [
                'view_dashboard',
                'view_operations',
                'view_data',
                'view_archives'
            ],
            description: 'Can generate and view leads',
            isDefault: true
        });

        // 3. Create Users
        console.log('Creating Users...');

        await User.create({
            username: 'w3leads@03',
            password: 'w3leads@14_02_2026',
            role: superAdminRole._id
        });

        console.log('-----------------------------------');
        console.log('Detailed Seed Report:');
        console.log(`Role: Super Admin (ID: ${superAdminRole._id})`);
        console.log(`Role: Leads Generator (ID: ${leadsGeneratorRole._id})`);
        console.log('User: w3leads@03 (Super Admin)');
        console.log('-----------------------------------');

        process.exit();
    } catch (error) {
        console.error('Error seeding users:', error);
        process.exit(1);
    }
};

seedUsers();
