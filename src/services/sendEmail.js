import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

const sendEmail = async ({ to, subject, html }) => {
  // Validate input parameters
  if (!to || typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    logger.error(`Invalid or missing recipient email: ${to}`);
    throw new Error('Invalid or missing recipient email');
  }

  if (!subject || typeof subject !== 'string') {
    logger.error('Invalid or missing email subject');
    throw new Error('Invalid or missing email subject');
  }

  if (!html || typeof html !== 'string') {
    logger.error('Invalid or missing email HTML content');
    throw new Error('Invalid or missing email HTML content');
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'localhost',
    service: 'gmail',
    port: 465,
    secure: true, // Use Gmail service for automatic host/port configuration
      
      auth: {
        user: process.env.EMAIL_USER, // Gmail address
        pass: process.env.EMAIL_PASS, // Gmail App Password
      },
    });

    const mailOptions = {
      from: `" UR-DOC" <${process.env.EMAIL_USER}>`, // Sender name and email
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to: ${to}, Message ID: ${info.messageId}`);
    return { success: true, info };
  } catch (error) {
    logger.error(`Email send error for ${to}: ${error.message}`);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

export default sendEmail;