import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

export async function sendVerificationEmail(email: string, token: string, name: string) {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Auction Marketplace <noreply@auction.com>',
    to: email,
    subject: 'Verify your email - Auction Marketplace',
    html: `
      <h2>Hello ${name},</h2>
      <p>Please verify your email by clicking the link below:</p>
      <p><a href="${url}">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string, name: string) {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Auction Marketplace <noreply@auction.com>',
    to: email,
    subject: 'Reset your password - Auction Marketplace',
    html: `
      <h2>Hello ${name},</h2>
      <p>Click the link below to reset your password:</p>
      <p><a href="${url}">Reset Password</a></p>
      <p>This link expires in 1 hour.</p>
    `,
  });
}

export async function sendOutbidNotification(email: string, productTitle: string, newBid: number) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Auction Marketplace <noreply@auction.com>',
    to: email,
    subject: `You've been outbid on ${productTitle}`,
    html: `
      <h2>You've been outbid!</h2>
      <p>The current bid on "${productTitle}" is now ${newBid} BDT.</p>
      <p><a href="${process.env.FRONTEND_URL}/auctions">Place a new bid</a></p>
    `,
  });
}

export async function sendAuctionWonEmail(email: string, productTitle: string, amount: number) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Auction Marketplace <noreply@auction.com>',
    to: email,
    subject: `You won the auction: ${productTitle}`,
    html: `
      <h2>Congratulations!</h2>
      <p>You won the auction for "${productTitle}" at ${amount} BDT.</p>
      <p>Please complete payment in your dashboard.</p>
      <p><a href="${process.env.FRONTEND_URL}/dashboard/orders">View Order</a></p>
    `,
  });
}

export async function sendItemShippedEmail(email: string, productTitle: string, orderId: string) {
  const url = `${process.env.FRONTEND_URL}/dashboard/orders`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Auction Marketplace <noreply@auction.com>',
    to: email,
    subject: `Your item has shipped: ${productTitle}`,
    html: `
      <h2>Item shipped</h2>
      <p>Your winning item "${productTitle}" has been shipped.</p>
      <p><a href="${url}">Track your order</a></p>
    `,
  });
}

export async function sendItemDeliveredEmail(email: string, productTitle: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Auction Marketplace <noreply@auction.com>',
    to: email,
    subject: `Delivery confirmed: ${productTitle}`,
    html: `
      <h2>Delivery confirmed</h2>
      <p>You confirmed delivery for "${productTitle}". Thank you for using our marketplace!</p>
    `,
  });
}
