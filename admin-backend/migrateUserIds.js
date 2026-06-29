import mongoose from "mongoose";
import dotenv from "dotenv";

// Adjust path if running from a different directory
dotenv.config();

import User from "./models/User.js";

import Counter from "./models/Counter.js";

const migrateUserIds = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI not found in environment variables");
      process.exit(1);
    }

    console.log(`Connecting to MongoDB at: ${process.env.MONGO_URI}`);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully.");

    // Find all users (dealers), sorted by createdAt ascending (oldest first)
    const dealers = await User.find({}).sort({ createdAt: 1 });
    console.log(`Found ${dealers.length} dealer(s) to process.`);

    let counter = 1;

    for (const dealer of dealers) {
      const newUserId = `SurjitFin#${counter}`;
      
      // Update specifically the UserId without triggering save hooks
      await User.updateOne(
        { _id: dealer._id },
        { $set: { UserId: newUserId } }
      );

      console.log(`Updated dealer ${dealer.email || dealer._id} -> ${newUserId}`);
      counter++;
    }

    // Initialize/sync Counter sequence 
    if (counter > 1) {
      await Counter.findByIdAndUpdate(
        { _id: 'userId' },
        { $set: { seq: counter - 1 } },
        { upsert: true }
      );
      console.log(`Counter initialized to sequence number ${counter - 1}`);
    }

    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    if (error.code === 11000) {
      console.error("Duplicate Key Error during migration (E11000):", error.message);
    } else {
      console.error("Error during migration:", error);
    }
    process.exit(1);
  }
};

migrateUserIds();
