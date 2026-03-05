const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI;

mongoose.connect(uri)
    .then(() => {
        console.log("Successfully connected to MongoDB Atlas!");
        process.exit(0);
    })
    .catch((err) => {
        console.error("Failed to connect to MongoDB Atlas:");
        console.error(err);
        process.exit(1);
    });
