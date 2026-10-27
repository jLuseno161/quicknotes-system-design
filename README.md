# QuickNotes System Design

QuickNotes is moving from a browser-only app to an online service for 1 million users. This repository has two parts: a small API client that proves the front end can talk to a REST API (using the free JSONPlaceholder practice API), and the design documents the backend team will build from.

## Features

- Load notes from an API with a GET request (10 notes)
- Create notes with a POST request, with validation (a title is required, maximum 100 characters)
- Delete notes with a DELETE request
- Loading, success, error and empty states shown on the page
- Buttons disabled while a request is running
- All user text inserted with `textContent` for safety

## How to run the API client

1. Clone the repository: `git clone https://github.com/your-username/quicknotes-system-design.git`
2. Open the folder in VS Code.
3. Right-click `index.html` and choose "Open with Live Server" (or open `index.html` in your browser).
4. An internet connection is needed because the client calls `https://jsonplaceholder.typicode.com/posts`.

Note: JSONPlaceholder accepts writes but does not save them, so created and deleted notes only change on the page. Click "Load notes" to reset.

## Design documents

- [API design](docs/api-design.md): REST endpoints, JSON examples and error codes
- [Data model](docs/data-model.md): tables, relationships, SQL, queries and indexes
- [Architecture](docs/architecture.md): requirements, load estimate, diagram, request flows and trade-offs

## What I learned

- (Write this in your own words. Example: how a reusable `request()` function that checks `response.ok` keeps GET, POST and DELETE consistent.)
- (Example: why a many-to-many relationship such as notes and tags needs a join table.)
- (Example: how caching, read replicas and queues each solve a different scaling problem.)