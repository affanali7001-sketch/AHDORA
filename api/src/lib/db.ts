import mongoose from 'mongoose';
import { config } from '../config.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  const connection = mongoose.connection;

  connection.on('connected', () => {
    console.info('MongoDB connection established');
  });
  connection.on('reconnected', () => {
    console.info('MongoDB connection restored');
  });
  connection.on('disconnected', () => {
    console.warn('MongoDB connection lost; the driver will retry automatically');
  });
  connection.on('error', (error) => {
    console.error(
      'MongoDB connection error:',
      error instanceof Error ? error.message : 'Unknown connection error',
    );
  });

  await mongoose.connect(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: config.NODE_ENV !== 'production',
  });
}
