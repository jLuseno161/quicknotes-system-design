# QuickNotes Data Model

## Entities

### users
| Column | Type | Key / constraints |
|---|---|---|
| `user_id` | INTEGER | Primary key |
| `name` | TEXT | NOT NULL |
| `email` | TEXT | NOT NULL, UNIQUE |
| `password_hash` | TEXT | NOT NULL |
| `created_at` | DATETIME | NOT NULL, defaults to now |

### notes
| Column | Type | Key / constraints |
|---|---|---|
| `note_id` | INTEGER | Primary key |
| `user_id` | INTEGER | Foreign key to `users.user_id`, NOT NULL |
| `title` | VARCHAR(100) | NOT NULL |
| `body` | TEXT | Optional |
| `created_at` | DATETIME | NOT NULL, defaults to now |
| `updated_at` | DATETIME | NOT NULL, defaults to now |

### tags
| Column | Type | Key / constraints |
|---|---|---|
| `tag_id` | INTEGER | Primary key |
| `user_id` | INTEGER | Foreign key to `users.user_id`, NOT NULL |
| `name` | VARCHAR(30) | NOT NULL; unique per user |

### note_tags
| Column | Type | Key / constraints |
|---|---|---|
| `note_id` | INTEGER | Foreign key to `notes.note_id`; part of the primary key |
| `tag_id` | INTEGER | Foreign key to `tags.tag_id`; part of the primary key |

## Relationships

- **users to notes is one-to-many.** One user owns many notes, but each note belongs to one user (`notes.user_id`).
- **users to tags is one-to-many.** Each user has their own set of tags, and each tag belongs to one user (`tags.user_id`).
- **notes to tags is many-to-many.** A note can have several tags (such as "work" and "urgent"), and a tag can be on many notes. A column can only hold one value, so the relationship is stored in the join table `note_tags`, which has one row per note-and-tag pair. Its composite primary key `(note_id, tag_id)` also stops the same tag being attached to a note twice.

## CREATE TABLE statements

The SQL below is written so it also runs in an SQLite playground. In PostgreSQL or MySQL, use an auto-increment id type and `TIMESTAMP` instead.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  user_id       INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  note_id    INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  title      VARCHAR(100) NOT NULL,
  body       TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE tags (
  tag_id  INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name    VARCHAR(30) NOT NULL,
  UNIQUE (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes (note_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags (tag_id)  ON DELETE CASCADE
);
```

## Sample data (to try the queries)

```sql
INSERT INTO users (user_id, name, email, password_hash) VALUES
  (1, 'Amina Wanjiru', 'amina@example.com', 'hash1');

INSERT INTO notes (note_id, user_id, title, body) VALUES
  (1, 1, 'Buy milk', 'Two litres and bread'),
  (2, 1, 'Email the report', 'Send to Grace'),
  (3, 1, 'Revise SQL joins', NULL);

INSERT INTO tags (tag_id, user_id, name) VALUES
  (1, 1, 'personal'),
  (2, 1, 'work'),
  (3, 1, 'study');

INSERT INTO note_tags (note_id, tag_id) VALUES
  (1, 1),
  (2, 2),
  (3, 3),
  (3, 2);
```

## Example queries

**1. The 10 newest notes for one user**

```sql
SELECT note_id, title, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 10;
```

**2. All notes with the tag "work" for one user (uses JOINs)**

```sql
SELECT notes.note_id, notes.title, tags.name AS tag
FROM notes
JOIN note_tags ON note_tags.note_id = notes.note_id
JOIN tags      ON tags.tag_id = note_tags.tag_id
WHERE notes.user_id = 1 AND tags.name = 'work';
```

**3. How many notes each tag has (LEFT JOIN keeps tags with no notes)**

```sql
SELECT tags.name, COUNT(note_tags.note_id) AS note_count
FROM tags
LEFT JOIN note_tags ON note_tags.tag_id = tags.tag_id
WHERE tags.user_id = 1
GROUP BY tags.tag_id, tags.name
ORDER BY note_count DESC;
```

## Indexes

`CREATE INDEX idx_notes_user_created ON notes (user_id, created_at);`

**Reason:** the most common request is "show me my newest notes" (`GET /notes`). Without an index the database would scan every note of every user. With this index it jumps straight to one user's notes already ordered by date, which matters when the table holds hundreds of millions of rows.

`CREATE INDEX idx_note_tags_tag_id ON note_tags (tag_id);`

**Reason:** the primary key `(note_id, tag_id)` already makes "tags for a note" fast, but "notes for a tag" (`GET /notes?tag=work`) searches by `tag_id` first, so it needs its own index.

## SQL or NoSQL?

I would choose **SQL** (a relational database such as PostgreSQL) for QuickNotes. The data is structured and connected: users own notes and tags, and notes and tags form a many-to-many relationship that joins handle naturally. Foreign keys, `UNIQUE` and `NOT NULL` rules protect data quality, and transactions make sure that creating a note and attaching its tags either fully succeed or fully fail. The expected size (about 220 GB of notes a year for 1 million users) fits comfortably on a SQL database with a read replica, and it can be split by user later if needed. A NoSQL document store would suit data with a changing shape or extreme write volumes, but QuickNotes has neither, and it would make queries such as "notes with a given tag" and "notes per tag" harder.