import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AegisStore } from '../services/store';
import { AppConfig } from '../config';

export function configureGoogleStrategy(store: AegisStore, config: AppConfig): void {
  const clientID = config.googleClientId;
  const clientSecret = config.googleClientSecret;
  if (!clientID || !clientSecret) return;

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: `${config.baseUrl.replace(/\/$/, '')}/auth/google/callback`,
        scope: ['profile', 'email'],
      },
      (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email || !email.includes('@')) {
            return done(new Error('No valid email from Google'), undefined);
          }
          let user = store.getEndUserByEmail(email);
          if (!user) {
            const displayName = profile.displayName ?? profile.name?.givenName ?? email.split('@')[0];
            user = store.createEndUser(email, displayName);
          }
          return done(null, { userId: user.id });
        } catch (err) {
          return done(err, undefined);
        }
      }
    )
  );
}
