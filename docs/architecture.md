# QuickNotes Architecture

## 1. Requirements

### Functional
- Users can sign up and log in.
- Users can create, view, update and delete their own notes.
- Users can add tags to notes and filter their notes by tag.
- Notes are available on every device the user logs in from.

### Non-functional
- **Scale:** support 1 million users.
- **Availability:** 99.9% uptime, with no single point of failure.
- **Performance:** 95% of requests answered in under 300 ms.
- **Durability:** a saved note is never lost (backups and replication).
- **Security:** HTTPS everywhere, hashed passwords, and users can only access their own notes.
- **Consistency:** after saving a note, the user sees it immediately.

## 2. Load estimate (1 million users)

**Assumptions:**
- 20% of users are active each day, so 200,000 daily active users.
- Each active user makes 20 reads per day (listing and opening notes) and 5 writes per day (3 new notes, 2 edits or deletes).
- An average note, with its metadata, is about 1 KB.
- There are 86,400 seconds in a day, and peak traffic is 5× the average.

| Measure | Calculation | Result |
|---|---|---|
| Reads per second (average) | 200,000 × 20 ÷ 86,400 | ≈ 46 per second |
| Reads per second (peak) | 46 × 5 | ≈ 230 per second |
| Writes per second (average) | 200,000 × 5 ÷ 86,400 | ≈ 12 per second |
| Writes per second (peak) | 12 × 5 | ≈ 58 per second |
| New notes per year | 200,000 × 3 × 365 | ≈ 219 million notes |
| Storage per year | 219 million × 1 KB | ≈ 219 GB (about 330 GB with indexes) |

The system is **read-heavy** (about 4 reads for every write), and the load is small enough for a few app servers and one primary database.

## 3. Architecture diagram

```
+---------+          +---------------------------+
|   DNS   |<-lookup--|   Client (web / mobile)   |
+---------+          +-------------+-------------+
                                   |
                                   v  HTTPS request
                     +---------------------------+
                     |            CDN            |
                     +---------------------------+
                                   |
                                   v  cache misses and API calls
                     +---------------------------+
                     |       Load balancer       |
                     +-------------+-------------+
                                   |
                      +------------+------------+
                      v                         v
              +-----------------+       +-----------------+
              | App server 1    |       | App server 2    |
              +-----------------+       +-----------------+
                      |                         |
            +---------+------------+------------+---------+
            v                      v                       v
     +-------------+        +-------------+        +-------------+
     |    Cache    |        |   Primary   |        |    Queue    |
     |   (Redis)   |        |  database   |        |   (jobs)    |
     +-------------+        +------+------+        +------+------+
                                   |                      |
                                   v  replication         v
                            +-------------+        +-------------+
                            |    Read     |        |   Worker    |
                            |   replica   |        |   (async)   |
                            +-------------+        +-------------+
```

Reads (`GET`) go to the cache first and then the read replica. Writes (`POST`, `PUT`, `DELETE`) always go to the primary database, which copies changes to the replica. The worker takes jobs from the queue and writes its results to the primary database.

## 4. What each component does

- **Client:** The web or mobile app that users interact with, and which sends requests to the API.
- **DNS:** Turns the readable name `api.quicknotes.example` into the address of our servers, so users never need an IP address.
- **CDN:** Serves the app's static files (HTML, CSS, JavaScript) from servers close to the user, so pages load fast and our servers carry less traffic.
- **Load balancer:** Spreads requests across the app servers and stops sending traffic to a server that has failed.
- **App servers (two or more):** Run the API logic (login checks, validation, reading and writing notes), and because they store nothing locally, we can add more as traffic grows.
- **Cache:** Keeps recently read notes and lists in memory, so repeated reads are fast and the database is not queried every time.
- **Primary database:** Stores users, notes and tags permanently and handles all writes, so data is consistent and durable.
- **Read replica:** Keeps a live copy of the primary database and answers read queries, so heavy reading does not slow down writes and it can take over if the primary fails.
- **Queue:** Holds background jobs (such as updating the search index or sending emails) so the API can reply to the user immediately instead of waiting.
- **Worker:** Takes jobs from the queue and does the slow work in the background, so slow tasks never delay a user's request.

## 5. Request flows

### GET /notes
1. The client looks up the API address through **DNS**.
2. The request goes through the **CDN** (API responses are private, so it passes straight through) to the **load balancer**.
3. The load balancer picks a healthy **app server**.
4. The app server checks the access token. If it is missing or expired, it returns `401`.
5. It looks for the user's notes in the **cache**.
6. If found (a cache hit), it returns them immediately.
7. If not found (a cache miss), it queries the **read replica**.
8. It saves the result in the cache for a short time (for example 60 seconds).
9. It returns `200 OK` with the JSON list of notes.

### POST /notes
1. The client sends the request with the token and the JSON body (title, body, tags) through DNS, the CDN and the load balancer to an **app server**.
2. The app server checks the token (`401`) and validates the input: the title must be present and at most 100 characters (`400`).
3. It saves the note and its tags in the **primary database** in one transaction.
4. It clears the user's cached note lists, so the next `GET /notes` shows the new note.
5. It puts a job such as "index this note for search" on the **queue**.
6. It returns `201 Created` with the new note, without waiting for the job.
7. A **worker** takes the job from the queue and finishes it in the background. The database copies the new note to the **read replica**.

## 6. Trade-offs

- **Caching (speed vs. freshness).** The cache makes reads fast and protects the database, but data may be briefly out of date, and we must clear the right cache entries on every write. We accept a short delay for other users' views but clear the owner's cache on every write, so people always see their own changes.
- **Read replica (read capacity vs. consistency).** The replica copies data with a small delay, so a read right after a write could miss the new note. We reduce this by reading from the primary database for a few seconds after a user writes.
- **Queue and worker (response time vs. complexity).** Background jobs keep requests fast and handle spikes, but results appear a moment later, and we now have to run, monitor and retry a queue and workers.
- **SQL database (consistency vs. write scaling).** A single primary database keeps data consistent and simple, but all writes go to one machine. At our load (about 58 writes per second at peak) that is fine, and if it grows we can split users across several databases.

## 7. Avoiding single points of failure

- **DNS:** use a provider with many servers across the world (or two providers), so one outage does not take the API offline.
- **CDN:** a CDN is run on many servers in many locations by design.
- **Load balancer:** run it as a redundant pair (or a managed, multi-zone load balancer) so another takes over if one fails.
- **App servers:** run at least two in different data centres (zones); the load balancer skips any that fail its health checks.
- **Cache:** run a cluster with replicas. If the cache is lost, the system still works because requests fall back to the database, just more slowly.
- **Database:** the read replica can be promoted to primary automatically if the primary fails, and regular backups are stored in a separate location.
- **Queue and workers:** use a replicated queue and several workers, and keep failed jobs for retry so none are lost.