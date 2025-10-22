export interface InstagramPost {
  id: string;
  imageUrl: string;
  postUrl: string;
  timestamp: number;
}

export interface InstagramResponse {
  posts: InstagramPost[];
  success: boolean;
  error?: string;
}
