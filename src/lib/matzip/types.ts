export interface Region {
  id: string;
  name: string;
  parent_id: string | null;
  level: number;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  region_id: string | null;
  menu: string;
  recommendation: string;
  blog_url: string | null;
  blog_title: string | null;
  kakao_place_id: string;
}

export interface Submission extends Omit<Place, 'blog_url' | 'blog_title'> {
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: string;
  review_note: string | null;
  created_at: string;
}

export interface KakaoSearchPlace {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  x: string;
  y: string;
}
