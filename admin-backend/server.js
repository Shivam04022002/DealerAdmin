// server.js
import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import cors from 'cors';
import adminRoutes from './routes/adminRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import authRoutes from "./routes/authRoutes.js";
import superadminRoutes from "./routes/superadminRoutes.js";
// import mergeRoutes from './routes/mergeRoutes.js';


dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/superadmin", superadminRoutes);
// app.use('/api/merge', mergeRoutes);
    
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// DEBUG: print DB URI / env used by server
console.log("DEBUG: process.env.MONGO_URI:", process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI);
console.log("DEBUG: Node env:", process.env.NODE_ENV);
