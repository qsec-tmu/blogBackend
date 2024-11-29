import { Request, Response, NextFunction } from 'express';
import { PostQueries, UserQueries, User, CommentQueries } from './../config/queries';
import { body, validationResult } from 'express-validator';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
const postQueries = new PostQueries();
const userQueries = new UserQueries();
const commentQueries = new CommentQueries();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, 
  });
  

const post = {
    list: async (req: Request, res: Response) => {
       try {
        const posts = await postQueries.getAllPosts();
        const postsWithAuthors = await Promise.all(posts.map(async (post) => {
        const author = await userQueries.getUserById(Number(post.authorId));
    return {
        ...post,
        authorName: author ? author.firstname + " " + author.lastname : 'Unknown', 
    };
}));
        return res.status(200).json(postsWithAuthors);
       } catch (error) {
          return res.status(500).json({ message: "Internal server error" });
        }
    },

    listSpecific: async (req: Request, res: Response) => {
      try {
        const postId = Number(req.params.postId);
    
        // Fetch the post by its ID
        const post = await postQueries.getPostById(postId);
        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }
    
        // Fetch the post's author details
        const author = await userQueries.getUserById(Number(post.authorId));
        const postWithAuthor = {
          ...post,
          authorName: author ? `${author.firstname} ${author.lastname}` : 'Unknown',
        };
    
        const comments = await commentQueries.getCommentByPostId(postId);
        const commentsWithAuthors = comments
        ? await Promise.all(
          comments.map(async (comment) => {
            const commentAuthor = await userQueries.getUserById(Number(comment.authorId));
            return {
              ...comment,
              authorName: commentAuthor ? `${commentAuthor.firstname} ${commentAuthor.lastname}` : 'Unknown',
            };
          })
        ) : [];
    
        return res.status(200).json({ post: postWithAuthor, comments: commentsWithAuthors });
      } catch (error) {
        console.error("Error fetching post info:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    },

    new: [
        upload.single('image'),
        body('title', 'Title must not be empty.').trim().isLength({ min: 1 }),
        body('content', 'Blog body must be a minimum of 3 characters').trim().isLength({ min: 3 }),
      
        async (req: Request, res: Response) => {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
          }
      
          try {
            const { title, content, image} = req.body;
            const published = Boolean(req.body.published);
            const authorId = (req.user as User).id;
            
            if (!req.file) {
              return res.status(400).json({ errors: [{ msg: 'Please upload a photo.' }] });
            }
      
            const file = req.file;
            const filePath = `posts/${Date.now()}_${file.originalname}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('blog').upload(filePath, file.buffer, {
              contentType: file.mimetype,
            });
      
            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw uploadError;
            }
      
            const { data } = supabase.storage.from('blog').getPublicUrl(filePath);
      
            const publicURL = data.publicUrl;
      
            const success = await postQueries.addPost(authorId, title, content, published, publicURL);
            if (success) {
              return res.status(201).json({
                message: 'Post created successfully',
              });
            } else {
                return res.status(500).json({
                  errors: [{ msg: 'Failed to create the post in the database.' }],
                });
              }
          } catch (error) {
            console.error('Error during creating post:', error);
            return res.status(500).json({
              errors: [{ msg: 'An error occurred during creating post. Please try again.' }],
            });
          }
        },
      ],
    update: [
        body('title', 'Title must not be empty.').trim().isLength({ min: 1 }),

        body('content', 'Blog body must be a minimum of 3 characters')
        .trim()
        .isLength({ min: 3 }),

        async (req: Request, res: Response) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
              return res.status(400).json( {errors: errors.array()})
            }
            
            try {
            const { title, content } = req.body;
            const postId = Number(req.params.postId);
            const authorId = (req.user as User).id;
            const success = await postQueries.updatePost( postId, authorId, title, content);
                if(success) {
                        return res.status(201).json({
                        mesaage: 'Post updated sucessfully'
                    });
                }
                } catch (error) {
                console.error('Error during updating post:', error);
                return res.status(500).json({
                    errors: [{ msg: 'An error occurred during updating post. Please try again.' }],});
                }
            }
    ],
    changeStatus: async (req: Request, res: Response) => {
        try {
            const postId = Number(req.params.postId);
            const success = await postQueries.changeStatus( postId );
                if(success) {
                        return res.status(201).json({
                        mesaage: 'Change status sucessfully'
                    });
                }else{
                    throw new Error("Cannot find post")
                }
                } catch (error) {
                console.error('Error during changing status:', error);
                return res.status(500).json({
                    errors: [{ msg: 'An error occurred during changing status. Please try again.' }],});
        }
    },
    delete: async (req: Request, res: Response) => {
        try {
            const postId = Number(req.params.postId);
            const success = await postQueries.deletePost( postId );
                if(success) {
                        return res.status(201).json({
                        mesaage: 'Post delete sucessfully'
                    });
                }
                } catch (error) {
                console.error('Error during deleting post:', error);
                return res.status(500).json({
                    errors: [{ msg: 'An error occurred during deleting post. Please try again.' }],});
        }
    },
}

const comment = {
    create: [
        body('content', 'Blog body must be a minimum of 3 characters')
        .trim()
        .isLength({ min: 3 }),

        async (req: Request, res: Response) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
              return res.status(400).json( {errors: errors.array()})
            }
            
            try {
            const { content } = req.body;
            const authorId = (req.user as User).id;
            const postId = Number(req.params.postId);
            const success = await commentQueries.addComment( authorId, postId, content);
                if(success) {
                        return res.status(201).json({
                        mesaage: 'Comment created sucessfully'
                    });
                }
                } catch (error) {
                console.error('Error during creating comment:', error);
                return res.status(500).json({
                    errors: [{ msg: 'An error occurred during creating comment. Please try again.' }],});
                }
            }
    ],
    delete: async (req: Request, res: Response) => {
      try {
          const commentId = Number(req.params.commentId);
          const success = await commentQueries.deleteComment( commentId );
              if(success) {
                      return res.status(201).json({
                      mesaage: 'Comment delete sucessfully'
                  });
              }
              } catch (error) {
              console.error('Error during deleting comment:', error);
              return res.status(500).json({
                  errors: [{ msg: 'An error occurred during deleting comment. Please try again.' }],});
      }
  },
}


export { post, comment }