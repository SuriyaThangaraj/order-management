const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Menu = require('../server/models/Menu');
const User = require('../server/models/User');

dotenv.config({ path: 'server/.env' });

const debugMenu = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        const menus = await Menu.find({});
        console.log(`Found ${menus.length} menu items.`);
        menus.forEach(m => {
            console.log(`- Item: ${m.name}, TenantID: ${m.tenantId}, AdminID: ${m.adminId}`);
        });

        const users = await User.find({});
        console.log(`Found ${users.length} users.`);
        users.forEach(u => {
            console.log(`- User: ${u.username}, Role: ${u.role}, ID: ${u._id}, TenantID: ${u.tenantId}, AdminID: ${u.adminId}`);
        });

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

debugMenu();
