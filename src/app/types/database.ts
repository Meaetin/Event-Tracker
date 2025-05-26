export type EventStatus = 'pending' | 'approved' | 'expired';

export interface ScrapedEventListing {
    id: string;  // UUID
    title: string;
    url: string;
    image_url: string | null;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

export interface Category {
    id: number;
    name: string;
    created_at: string;
}

export interface Event {
    id: string;  // UUID
    name: string;
    url: string;
    date: string;  // ISO timestamp
    location: string;
    coordinates: {
        x: number;  // longitude
        y: number;  // latitude
    };
    description: string | null;
    category_id: number | null;
    status: EventStatus;
    images: string[];
    created_at: string;
    updated_at: string;
    listing_id: string | null;
    categories?: Category;  // Optional category relation
}

export interface Profile {
    id: string;
    role: 'admin' | 'user';
    created_at: string;
} 