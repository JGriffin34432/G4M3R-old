const mongoose = require("mongoose");

// User data (past names, profile fields, etc...)
module.exports = new mongoose.Schema({
    _id: String,
    past_names: [String],
    afk_message: String,
    server_nicks: [new mongoose.Schema({
        _id: { type: String, required: true, lowercase: true },
        server_id: { type: String, required: true }
    })],
    reminders: [new mongoose.Schema({
        name: { type: String, required: true },
        expiry_timestamp: { type: Date, required: true }
    })],
    last_seen: Date,
    profile_fields: mongoose.Schema.Types.Mixed,
    profile_background_image: { type: String, default: "http://i.imgur.com/8UIlbtg.jpg" },
    isProfilePublic: { type: Boolean, default: true },
    upvoted_gallery_extensions: [String],

    event_notifications: { type: Number, default: 1 }, // 0 - none; 1 - DM; 2 - mentions; 3 - both
    location: String,
    timezone: String,
    weatherunit: String
});