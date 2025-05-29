# Event Map Application Workflow

## System Overview
A web application that scrapes event information, processes it through AI, and displays events on an interactive map with filtering capabilities.

## Workflow Steps
1. **Admin Event Approval**
   - Admin submits event URL or manual entry
   - Event enters pending status
   - Admin can preview scraped content before approval

2. **Event Scraping**
   - URL gets processed by Puppeteer AI Scraper
   - Events get listed down to be either approved or deleted by admin
   - Approved events get processed by Jina AI Scraper
   - Converts webpage to markdown format
   - Stores images and content

3. **AI Processing (OpenAI)**
   - Processes markdown content
   - Extracts:
     - Event name
     - Date
     - Location
     - Description
   - Classifies event into predefined categories
   - Converts location to coordinates

4. **Map Display**
   - Plots event on map
   - Shows simplified marker with:
     - Name
     - Date
     - Location
     - Images
     - URL to event page
     - Description

5. **Event Sidebar**
   - Lists all active events
   - Full event details
   - Filtering capabilities
   - Interactive with map

## Database Structure
### Events Table
- ID
- Name
- URL (original event URL)
- Date
- Location (address string)
- Coordinates (latitude, longitude)
- Description
- Category
- Status (pending, approved, active, expired)
- Images
- Created At
- Updated At

## API Endpoints
### Public Endpoints
- GET /api/events (with filter params)
- GET /api/events/categories

### Admin Endpoints (Protected)
- POST /api/admin/events
- PUT /api/admin/events/:id
- DELETE /api/admin/events/:id
- POST /api/admin/events/scrape
- PUT /api/admin/events/:id/status

## Access Control
- Public: View events and map
- Admin: CRUD operations, scraping, and event management

## Event Management
- Automatic status updates based on date
- Expired events removed from public view
- All events retained in database
- Filtering by category, date, and location