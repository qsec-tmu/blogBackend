import express from 'express';
import cors from 'cors';
import {  admin, verifyToken, isAdmin } from './../controllers/admin';
import { post, comment } from './../controllers/post';
const router = express.Router();

router.post('/admin/login', cors(), admin.login);

router.post('/admin/signup', cors(), admin.create);

router.get('/posts', cors(),  post.list);

router.get('/posts/:postId', cors(),  post.listSpecific);

router.post('/posts', cors(), verifyToken, isAdmin, post.new);

 router.put('/posts/:postId', cors(), verifyToken, isAdmin, post.update);

router.patch('/posts/:postId', cors(), verifyToken, isAdmin, post.changeStatus);

router.delete('/posts/:postId', cors(), verifyToken, isAdmin, post.delete); 

router.post('/posts/:postId/comments', cors(), verifyToken, comment.create);

router.delete('/comments/:commentId', cors(), verifyToken, isAdmin, comment.delete); 



export default router