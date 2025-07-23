import nodemailer from 'nodemailer';
import { config } from '../config/config';
import logger from '../utils/logger';
import { prisma } from '../config/database';
import { readFileSync } from 'fs';
import { join } from 'path';
import Handlebars from 'handlebars';

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailVerificationData {
  userId: string;
  email: string;
  token: string;
  expiresAt: Date;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  newMessages: boolean;
  conversationAssigned: boolean;
  agentStatusChanges: boolean;
  systemUpdates: boolean;
  weeklyReports: boolean;
}

class EmailService {
  private static instance: EmailService;
  private transporter!: nodemailer.Transporter;
  private templates: Map<string, Handlebars.TemplateDelegate> = new Map();
  private templatesPath = join(__dirname, '../templates/email');

  private constructor() {
    this.initializeTransporter();
    this.loadTemplates();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Initialize SMTP transporter
   */
  private initializeTransporter(): void {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      logger.info('SMTP transporter initialized successfully', {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
      });
    } catch (error) {
      logger.error('Failed to initialize SMTP transporter', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Load email templates
   */
  private loadTemplates(): void {
    try {
      const templateFiles = [
        'welcome',
        'email-verification',
        'password-reset',
        'conversation-assigned',
        'new-message',
        'agent-status-change',
        'weekly-report',
        'system-notification',
      ];

      templateFiles.forEach(templateName => {
        try {
          const templatePath = join(this.templatesPath, `${templateName}.hbs`);
          const templateContent = readFileSync(templatePath, 'utf-8');
          const compiledTemplate = Handlebars.compile(templateContent);
          this.templates.set(templateName, compiledTemplate);
          
          logger.debug(`Email template loaded: ${templateName}`);
        } catch (error) {
          logger.warn(`Failed to load email template: ${templateName}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      logger.info(`Loaded ${this.templates.size} email templates`);
    } catch (error) {
      logger.error('Failed to load email templates', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send email with enhanced error handling
   */
  public async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      let { html, text, subject } = options;

      // Use template if specified
      if (options.template && this.templates.has(options.template)) {
        const template = this.templates.get(options.template)!;
        html = template(options.templateData || {});
        
        // Extract subject from template data if not provided
        if (!subject && options.templateData?.subject) {
          subject = options.templateData.subject;
        }
      }

      const mailOptions = {
        from: config.smtp.from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject,
        html,
        text,
        attachments: options.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        to: options.to,
        subject,
        messageId: result.messageId,
      });

      // Log email activity
      await this.logEmailActivity({
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: subject || 'No Subject',
        template: options.template,
        status: 'sent',
        messageId: result.messageId,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email', {
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Log failed email activity
      await this.logEmailActivity({
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject || 'No Subject',
        template: options.template,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return false;
    }
  }

  /**
   * Send welcome email
   */
  public async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      template: 'welcome',
      templateData: {
        subject: 'Welcome to AIgentable!',
        userName,
        loginUrl: `${config.frontendUrl}/login`,
        supportEmail: config.smtp.from,
      },
    });
  }

  /**
   * Send email verification
   */
  public async sendEmailVerification(email: string, token: string, userName: string): Promise<boolean> {
    const verificationUrl = `${config.frontendUrl}/verify-email?token=${token}`;
    
    return this.sendEmail({
      to: email,
      template: 'email-verification',
      templateData: {
        subject: 'Verify Your Email Address',
        userName,
        verificationUrl,
        expiresIn: '24 hours',
      },
    });
  }

  /**
   * Send password reset email
   */
  public async sendPasswordResetEmail(email: string, token: string, userName: string): Promise<boolean> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
    
    return this.sendEmail({
      to: email,
      template: 'password-reset',
      templateData: {
        subject: 'Reset Your Password',
        userName,
        resetUrl,
        expiresIn: '1 hour',
      },
    });
  }

  /**
   * Send conversation assigned notification
   */
  public async sendConversationAssignedEmail(
    agentEmail: string,
    agentName: string,
    conversationId: string,
    customerName: string
  ): Promise<boolean> {
    const conversationUrl = `${config.frontendUrl}/conversations/${conversationId}`;
    
    return this.sendEmail({
      to: agentEmail,
      template: 'conversation-assigned',
      templateData: {
        subject: 'New Conversation Assigned',
        agentName,
        customerName,
        conversationUrl,
        conversationId,
      },
    });
  }

  /**
   * Send new message notification
   */
  public async sendNewMessageNotification(
    agentEmail: string,
    agentName: string,
    conversationId: string,
    customerName: string,
    messagePreview: string
  ): Promise<boolean> {
    const conversationUrl = `${config.frontendUrl}/conversations/${conversationId}`;
    
    return this.sendEmail({
      to: agentEmail,
      template: 'new-message',
      templateData: {
        subject: `New message from ${customerName}`,
        agentName,
        customerName,
        messagePreview: messagePreview.substring(0, 100) + (messagePreview.length > 100 ? '...' : ''),
        conversationUrl,
        conversationId,
      },
    });
  }

  /**
   * Send weekly report email
   */
  public async sendWeeklyReport(
    userEmail: string,
    userName: string,
    reportData: any
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      template: 'weekly-report',
      templateData: {
        subject: 'Your Weekly AIgentable Report',
        userName,
        ...reportData,
        dashboardUrl: `${config.frontendUrl}/dashboard`,
      },
    });
  }

  /**
   * Generate and store email verification token
   */
  public async generateEmailVerificationToken(userId: string, email: string): Promise<string> {
    try {
      const token = this.generateSecureToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await prisma.emailVerification.create({
        data: {
          userId,
          email,
          token,
          expiresAt,
        },
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate email verification token', {
        userId,
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Verify email token
   */
  public async verifyEmailToken(token: string): Promise<EmailVerificationData | null> {
    try {
      const verification = await prisma.emailVerification.findFirst({
        where: {
          token,
          expiresAt: {
            gt: new Date(),
          },
          verified: false,
        },
      });

      if (!verification) {
        return null;
      }

      // Mark as verified
      await prisma.emailVerification.update({
        where: { id: verification.id },
        data: { verified: true },
      });

      return {
        userId: verification.userId,
        email: verification.email,
        token: verification.token,
        expiresAt: verification.expiresAt,
      };
    } catch (error) {
      logger.error('Failed to verify email token', {
        token,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get user notification preferences
   */
  public async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const preferences = await prisma.userPreferences.findUnique({
        where: { userId },
        select: {
          emailNotifications: true,
          newMessages: true,
          conversationAssigned: true,
          agentStatusChanges: true,
          systemUpdates: true,
          weeklyReports: true,
        },
      });

      return preferences || {
        emailNotifications: true,
        newMessages: true,
        conversationAssigned: true,
        agentStatusChanges: false,
        systemUpdates: true,
        weeklyReports: true,
      };
    } catch (error) {
      logger.error('Failed to get notification preferences', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Return default preferences on error
      return {
        emailNotifications: true,
        newMessages: true,
        conversationAssigned: true,
        agentStatusChanges: false,
        systemUpdates: true,
        weeklyReports: true,
      };
    }
  }

  /**
   * Update notification preferences
   */
  public async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    try {
      await prisma.userPreferences.upsert({
        where: { userId },
        update: preferences,
        create: {
          userId,
          ...preferences,
        },
      });

      logger.info('Notification preferences updated', {
        userId,
        preferences,
      });
    } catch (error) {
      logger.error('Failed to update notification preferences', {
        userId,
        preferences,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Test SMTP connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection test successful');
      return true;
    } catch (error) {
      logger.error('SMTP connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Generate secure token
   */
  private generateSecureToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Log email activity
   */
  private async logEmailActivity(activity: {
    to: string[];
    subject: string;
    template?: string;
    status: 'sent' | 'failed';
    messageId?: string;
    error?: string;
  }): Promise<void> {
    try {
      await prisma.emailLog.create({
        data: {
          recipients: activity.to,
          subject: activity.subject,
          template: activity.template,
          status: activity.status,
          messageId: activity.messageId,
          error: activity.error,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to log email activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const emailService = EmailService.getInstance();
export default emailService;