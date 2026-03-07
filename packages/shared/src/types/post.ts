export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type PostTemplate = 'announcement' | 'flash_sale' | 'seasonal' | 'social_proof' | 'restock';
export type PostType = 'feed' | 'carousel' | 'reel' | 'story';

export interface Post {
  id: string;
  seller_id: string;
  template: PostTemplate;
  post_type: PostType;
  caption: string;
  image_urls: string[];
  enhanced_image_urls: string[];
  rendered_image_url: string | null;
  instagram_post_id: string | null;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  ai_generated_caption: boolean;
  ai_suggested: boolean;
  created_at: string;
}
