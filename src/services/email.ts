import sgMail from '../config/email';
import { ApiError } from '../middleware/error';

// Email template types
type EmailTemplate = 
  | 'visa-expiry-notification'
  | 'document-expiry-notification'
  | 'welcome-employee'
  | 'password-reset';

// Email service
export const EmailService = {
  // Send email
  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html: string
  ): Promise<boolean> {
    try {
      const msg = {
        to,
        from: process.env.NOTIFICATION_FROM_EMAIL || 'notifications@example.com',
        subject,
        text,
        html,
      };
      
      await sgMail.send(msg);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error instanceof ApiError 
        ? error 
        : new ApiError('Failed to send email', 500);
    }
  },

  // Send visa expiry notification
  async sendVisaExpiryNotification(
    to: string,
    employeeName: string,
    expiryDate: Date,
    daysRemaining: number
  ): Promise<boolean> {
    const subject = `Visa Expiry Notification: ${employeeName}'s visa expires in ${daysRemaining} days`;
    
    const text = `
      Dear Admin,
      
      This is a notification that ${employeeName}'s visa will expire on ${expiryDate.toDateString()}, which is ${daysRemaining} days from now.
      
      Please take appropriate action to ensure visa compliance.
      
      Regards,
      Employee Management System
    `;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Visa Expiry Notification</h2>
        <p>Dear Admin,</p>
        <p>This is a notification that <strong>${employeeName}'s</strong> visa will expire on <strong>${expiryDate.toDateString()}</strong>, which is <strong>${daysRemaining} days</strong> from now.</p>
        <p>Please take appropriate action to ensure visa compliance.</p>
        <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
          <h3 style="margin-top: 0;">Visa Details:</h3>
          <p><strong>Employee:</strong> ${employeeName}</p>
          <p><strong>Expiry Date:</strong> ${expiryDate.toDateString()}</p>
          <p><strong>Days Remaining:</strong> ${daysRemaining}</p>
        </div>
        <p style="margin-top: 30px;">Regards,<br>Employee Management System</p>
      </div>
    `;
    
    return this.sendEmail(to, subject, text, html);
  },

  // Send document expiry notification
  async sendDocumentExpiryNotification(
    to: string,
    employeeName: string,
    documentType: string,
    documentName: string,
    expiryDate: Date,
    daysRemaining: number
  ): Promise<boolean> {
    const subject = `Document Expiry Notification: ${employeeName}'s ${documentType} expires in ${daysRemaining} days`;
    
    const text = `
      Dear Admin,
      
      This is a notification that ${employeeName}'s ${documentType} (${documentName}) will expire on ${expiryDate.toDateString()}, which is ${daysRemaining} days from now.
      
      Please take appropriate action to ensure document compliance.
      
      Regards,
      Employee Management System
    `;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Document Expiry Notification</h2>
        <p>Dear Admin,</p>
        <p>This is a notification that <strong>${employeeName}'s ${documentType}</strong> (${documentName}) will expire on <strong>${expiryDate.toDateString()}</strong>, which is <strong>${daysRemaining} days</strong> from now.</p>
        <p>Please take appropriate action to ensure document compliance.</p>
        <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
          <h3 style="margin-top: 0;">Document Details:</h3>
          <p><strong>Employee:</strong> ${employeeName}</p>
          <p><strong>Document Type:</strong> ${documentType}</p>
          <p><strong>Document Name:</strong> ${documentName}</p>
          <p><strong>Expiry Date:</strong> ${expiryDate.toDateString()}</p>
          <p><strong>Days Remaining:</strong> ${daysRemaining}</p>
        </div>
        <p style="margin-top: 30px;">Regards,<br>Employee Management System</p>
      </div>
    `;
    
    return this.sendEmail(to, subject, text, html);
  },

  // Send welcome email to new employee
  async sendWelcomeEmail(
    to: string,
    employeeName: string,
    companyName: string,
    loginUrl: string
  ): Promise<boolean> {
    const subject = `Welcome to ${companyName}, ${employeeName}!`;
    
    const text = `
      Dear ${employeeName},
      
      Welcome to ${companyName}! We're excited to have you on board.
      
      You can access your employee portal at: ${loginUrl}
      
      Your login credentials have been sent in a separate email.
      
      Regards,
      HR Team
    `;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2e7d32;">Welcome to ${companyName}!</h2>
        <p>Dear ${employeeName},</p>
        <p>Welcome to ${companyName}! We're excited to have you on board.</p>
        <p>You can access your employee portal at: <a href="${loginUrl}">${loginUrl}</a></p>
        <p>Your login credentials have been sent in a separate email.</p>
        <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
          <h3 style="margin-top: 0;">Next Steps:</h3>
          <ol>
            <li>Log in to the employee portal</li>
            <li>Complete your profile</li>
            <li>Upload required documents</li>
            <li>Review company policies</li>
          </ol>
        </div>
        <p style="margin-top: 30px;">Regards,<br>HR Team</p>
      </div>
    `;
    
    return this.sendEmail(to, subject, text, html);
  }
};
