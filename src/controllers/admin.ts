import e, { Request, Response, NextFunction } from 'express';
import { UserQueries, Role, User } from './../config/queries';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import passport from 'passport'

interface AuthenticatedRequest extends Request {
  token?: string;
}

const userQueries = new UserQueries();

const admin = {
    create: [
        body('firstname')
        .trim()
        .notEmpty()
        .withMessage('First name is required')
        .escape(),
      body('lastname')
        .trim()
        .notEmpty()
        .withMessage('Last name is required')
        .escape(),
      body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required')
        .isLength({ min: 3, max: 20 })
        .withMessage('Username must be between 3 and 20 characters long')
        .matches(/^[a-zA-Z0-9_.]+$/)
        .withMessage('Username must contain only letters, numbers, underscores, or periods')
        .escape()
        .custom( async (username) => {
            const user = await userQueries.getUser(username);
            if (user) {
              throw new Error('Username already exists');
            }
            return true;
          }),
      body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 8, max: 64 })
        .withMessage('Password must be between 8 and 64 characters long')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number'),
      body('confirmpassword')
        .custom((value, { req }) => value === req.body.password)
        .withMessage('Passwords do not match'),
    
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json( {errors: errors.array()})
        }
        
        try {
          const { firstname, lastname, username, password } = req.body;
           const hashedPassword = await bcrypt.hash(password, 10);
           await userQueries.addUser(firstname, lastname, username, hashedPassword, Role.ADMIN);
           return res.status(201).json({
            mesaage: 'Admin created sucessfully'
           });
            } catch (error) {
              console.error('Error during user sign-up:', error);
              return res.status(500).json({
                errors: [{ msg: 'An error occurred during sign-up. Please try again.' }],});
            }
          }
    ],

    login: [
      body('username', 'Username does not exist')
        .trim()
        .escape()
        .custom(async (username) => {
          const user = await userQueries.getUser(username);
          if (!user) {
            throw new Error('Username does not exist');
          } else if (user.role !== Role.ADMIN) {
            throw new Error('Your account does not meet the required permissions');
          }
          return true;
        }),
      body('password', 'Incorrect password')
        .trim()
        .escape()
        .custom(async (password, { req }) => {
          const user = await userQueries.getUser(req.body.username);
          if (!user) {
            return false;
          }
          const match = await bcrypt.compare(password, user.password);
          if (!match) {
            throw new Error('Incorrect password');
          }
          return true;
        }),
      async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
  
        passport.authenticate('local', { session: false }, (err: Error, user: User) => {
          if (err || !user) {
            return res.status(400).json({
              message: 'Something is not right',
              user: user,
            });
          }
  
          req.login(user, { session: false }, (err) => {
            if (err) {
              return res.status(500).json({ message: 'Error logging in', error: err });
            }
  
            const secret = process.env.FOO_COOKIE_SECRET;
            if (!secret) {
              return res.status(500).json({ message: 'Internal Server Error: Missing secret key' });
            }
  
            const token = jwt.sign({ id: user.id }, secret, { expiresIn: '1h' });
            return res.json({ user, token });
          });
        })(req, res, next); 
      },
    ],
}



const  verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const bearerHeader = req.headers.authorization;
  const secret = process.env.FOO_COOKIE_SECRET;

  if (!secret) {
    return res.status(500).json({ message: 'Internal Server Error: Missing secret key' });
  }

  if (typeof bearerHeader !== 'undefined') {
    const bearerToken = bearerHeader.split(' ')[1];
    jwt.verify(bearerToken, secret, (err, decoded) => {
      if (err) {
        return res.sendStatus(403);
      } else {
        req.user = decoded;
        next();
      }
    });
  } else {
    res.sendStatus(403);
  }
};

const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = await userQueries.getUserById((req.user as User).id);
  if (!user || user.role !== Role.ADMIN){
    res.status(401).json("No permission for this route");
  } else{
    next();
  }
    
}

export { admin, verifyToken, isAdmin }