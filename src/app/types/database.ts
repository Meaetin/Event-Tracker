export type EventStatus = 'pending' | 'approved' | 'expired';

export interface ScrapedEventListing {
    id: string;  // UUID
    title: string;
    url: string;
    image_url: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'processed' | 'error';
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
    start_date: string | null;  // ISO timestamp
    end_date: string | null;  // ISO timestamp
    time: string | null;  // Time range as string (e.g., "9:00 am - 9:00 pm")
    location: string;
    coordinates: string | null;  // PostgreSQL point format: "(longitude,latitude)"
    description: string | null;
    category_id: number | null;  // Legacy single category support
    category_ids?: number[];  // Multiple categories support
    store_type: 'event' | 'permanent_store';  // NEW: Classification field
    status: EventStatus;
    images: string[];
    created_at: string;
    updated_at: string;
    categories?: Category | Category[];  // Optional category relation - can be single or multiple
}

// Map-specific types
export interface Coordinates {
    latitude: number;
    longitude: number;
}

export interface MapEvent extends Omit<Event, 'coordinates'> {
    coordinates: Coordinates | null;  // Parsed coordinates for map display
}

export interface EventsApiResponse {
    success: boolean;
    events: MapEvent[];
    total: number;
}

export interface CategoriesApiResponse {
    success: boolean;
    categories: Category[];
}

export interface Profile {
    id: string;
    role: 'admin' | 'user';
    created_at: string;
} 