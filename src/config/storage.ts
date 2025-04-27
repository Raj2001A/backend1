// eslint-disable-next-line @typescript-eslint/no-var-requires
const B2 = require('backblaze-b2');
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Backblaze B2 client
const b2 = new B2({
  applicationKeyId: process.env.B2_APP_KEY_ID || '',
  applicationKey: process.env.B2_APP_KEY || '',
});

// Function to authorize B2 client
const authorizeB2 = async () => {
  try {
    await b2.authorize();
    console.log('Backblaze B2 authorized successfully');
    return b2;
  } catch (error) {
    console.error('Error authorizing Backblaze B2:', error);
    throw error;
  }
};

export { b2, authorizeB2 };
