
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const API_URL = `http://localhost:${process.env.PORT || 5000}`;

const checkHealth = async () => {
    try {
        console.log(`Checking ${API_URL}...`);
        const res = await axios.get(API_URL);
        console.log('Root Endpoint:', res.data);

        console.log('Checking DB (via direct connection)...');
        const mongoose = require('mongoose');
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('DB Connection: SUCCESS');
        console.log('Checking Users...');
        const User = require('./models/User');
        const count = await User.countDocuments();
        console.log(`Users count: ${count}`);

        process.exit(0);

    } catch (error) {
        console.error('Health Check Failed:', error.message);
        if (error.response) console.error('Response:', error.response.status);
        process.exit(1);
    }
};

checkHealth();
