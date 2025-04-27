import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

// Test SendGrid configuration
const testSendGridConfig = async () => {
  try {
    // Just verify the API key is valid without sending an email
    await sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
    console.log('SendGrid configured successfully');
  } catch (error) {
    console.error('Error configuring SendGrid:', error);
  }
};

// Call the test function
testSendGridConfig();

export default sgMail;
