## Name (TBD)

Don't know where to go this weekend?
Too lazy to find what events are happening?
Well worry no more for this website will be your solution!

This websites gathers events all over Singapore and plot them on a map for you to find out whats happening in the area.

## Features
- Map view of events happening all around Singapore (viewable in list form)
- Search for events from various categories/locations/dates
- Plan an itenerary easily with the features provided
- Have AI plan out an itinerary from your preferences (future plan)
 
## Tech Stack
  - Next.js with TypeScript
  - Supabase (Database & Auth)
  - Jina AI (Web scraping)
  - OpenAI (Event processing)
  - Puppeteer (Initial scraping)
  - Leaflet (Map display)


## Admin Workflow

1. **Initial Scraping**: Admin enters a website URL to scrape event listings
2. **Review & Approve**: Admin reviews scraped listings and approves relevant ones
3. **AI Processing**: Approved listings are processed with Jina AI (converts to markdown) and OpenAI (extracts event details)
4. **Event Creation**: Successfully processed listings become events in the database
5. **Event Management**: Admin can review, approve, or delete events before they appear on the public map
