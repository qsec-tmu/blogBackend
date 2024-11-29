import express, { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import expressSession from 'express-session';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import  { PrismaClient } from '@prisma/client';
import cors from 'cors';

import './config/passport'
import indexRouter from './routes/index';

const app = express();

app.use(cors());
const allowCrossDomain = (req: Request,res: Response,next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();  
}
app.use(allowCrossDomain);
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  expressSession({
    cookie: {
     maxAge: 7 * 24 * 60 * 60 * 1000 // ms
    },
    secret: 'a santa at nasa',
    resave: true,
    saveUninitialized: true,
    store: new PrismaSessionStore(
      new PrismaClient(),
      {
        checkPeriod: 2 * 60 * 1000,  //ms
        dbRecordIdIsSessionId: true,
        dbRecordIdFunction: undefined,
      }
    )
  })
);

app.use('/api', indexRouter);

app.use(function(req, res, next) {
  next(createError(404));
});


// error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const statusCode = (err.status && typeof err.status === 'number') ? err.status : 500;
  
  // Log the error (optional, for debugging purposes)
  console.error(err);

  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
      details: req.app.get('env') === 'development' ? err : {}
    }
  });
});
export default app;
