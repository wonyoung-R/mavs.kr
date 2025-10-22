export interface Post {
  id: string;
  title: string;
  content: string;
  category: ForumCategory;
  author: User;
  authorId: string;
  viewCount: number;
  isPinned: boolean;
  isLocked: boolean;
  comments: Comment[];
  votes: Vote[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  content: string;
  post: Post;
  postId: string;
  author: User;
  authorId: string;
  parentId?: string;
  parent?: Comment;
  replies: Comment[];
  votes: Vote[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Vote {
  id: string;
  type: VoteType;
  user: User;
  userId: string;
  post?: Post;
  postId?: string;
  comment?: Comment;
  commentId?: string;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  image?: string;
  role: Role;
  points: number;
  badges: Badge[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export enum ForumCategory {
  GAME_THREAD = 'GAME_THREAD',
  GENERAL = 'GENERAL',
  TRADE_RUMORS = 'TRADE_RUMORS',
  ANALYSIS = 'ANALYSIS',
}

export enum VoteType {
  UPVOTE = 'UPVOTE',
  DOWNVOTE = 'DOWNVOTE',
}

export enum Role {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}
