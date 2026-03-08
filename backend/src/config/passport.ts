import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from './index';
import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';

passport.use(
  new GoogleStrategy(
    {
      clientID: config.google.clientId,
      clientSecret: config.google.clientSecret,
      callbackURL: config.google.callbackUrl,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName || profile.name?.givenName || 'User';
        const googleId = profile.id;
        const avatar = profile.photos?.[0]?.value;

        if (!email) return done(new Error('No email from Google'), undefined);

        let user = await prisma.user.findFirst({
          where: { OR: [{ googleId }, { email }] },
        });

        if (user) {
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId, avatar, emailVerified: true },
            });
          }
          return done(null, { id: user.id, email: user.email, name: user.name, role: user.role });
        }

        user = await prisma.user.create({
          data: {
            email,
            name,
            googleId,
            avatar,
            role: Role.BUYER,
            emailVerified: true,
          },
        });
        await prisma.buyer.create({ data: { userId: user.id } });
        return done(null, { id: user.id, email: user.email, name: user.name, role: user.role });
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);
