import passport from 'passport';
import { Request } from 'express';
import { Strategy as LocalStrategy } from 'passport-local';
import { ExtractJwt, Strategy as JWTStrategy } from 'passport-jwt';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { UserQueries, Role } from './../config/queries'; 

dotenv.config();

const userQueries = new UserQueries();

passport.use(
  new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback: true,
    },
    async (req: Request, username, password, done) => {
      try {
        const user = await userQueries.getUser(username);
        if (!user) {
          return done(null, false, { message: 'Username does not exist' });
        }

        if (req.path.includes('/admin') && user.role !== Role.ADMIN) {
          return done(null, false, { message: 'Your account does not meet the required permissions' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: 'Incorrect password' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.use(
  new JWTStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.FOO_COOKIE_SECRET as string,
      passReqToCallback: true,
    },
    async (req, jwtPayload, done) => {
      try {
        const user = await userQueries.getUserById(jwtPayload.id);
        if (!user) {
          return done(null, false);
        }
        req.user = user;
        return done(null, user);
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

export default passport;