# MongoDB Lab Experiment: Database & Collection Management and Record Operations

## AIM
The aim of this experiment is to:
1. **Part (a):** Write MongoDB queries to create and drop databases and collections.
2. **Part (b):** Write MongoDB queries to work with records using `find()`, `limit()`, `sort()`, `createIndex()`, and `aggregate()`.

---

## 1. System Environment
| Component | Version / Configuration | Details |
| :--- | :--- | :--- |
| **MongoDB Community Server (`mongod`)** | `v8.2.1` | Running as Windows Service on port `27017` |
| **MongoDB Shell (`mongosh`)** | `v2.13.0` | CLI shell for query execution |
| **Node.js Runtime** | `v22.16.0` | Backend execution & test automation |
| **Target Database** | `library` | Active experimental namespace |
| **Target Collection** | `books` | Document store for book records |
| **Web Dashboard** | Port `5051` | `http://localhost:5051` |

---

## 2. Problem Statement & Dataset

### Part (a) – Databases and Collections
- Create a database named `library` and a collection called `books`.
- Perform the following operations:
  1. Create database and collection.
  2. Insert sample documents into the collection.
  3. View all collections in the database.
  4. Drop the collection.
  5. Drop the database.

### Part (b) – Records Operations
Using the `books` collection with canonical sample data:
```json
[
  { "title": "1984", "author": "George Orwell", "year": 1949, "genre": "Dystopian", "price": 12.99 },
  { "title": "To Kill a Mockingbird", "author": "Harper Lee", "year": 1960, "genre": "Fiction", "price": 14.99 },
  { "title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "year": 1925, "genre": "Classic", "price": 10.99 },
  { "title": "Moby Dick", "author": "Herman Melville", "year": 1851, "genre": "Adventure", "price": 9.99 },
  { "title": "Brave New World", "author": "Aldous Huxley", "year": 1932, "genre": "Dystopian", "price": 11.99 }
]
```

Perform the following operations:
1. Find all books, sorted by year (ascending: `1`).
2. Find the first 3 books using `limit(3)`.
3. Find books of a specific genre (`Dystopian`).
4. Create an index on the `author` field and inspect all indexes.
5. Use `aggregate()` to:
   - Group books by genre and count them.
   - Find the average price of books in each genre.
   - Combined pipeline: filter books published after 1900, group by genre, calculate count and average price, sort by count descending, and project fields.
6. Additional pipelines:
   - Group books by genre and decade using mathematical operators (`$subtract`, `$mod`).
   - Find with filter, sort descending, and limit.

---

## 3. Step-by-Step Procedure and Command Reference

### Part (a): Databases and Collections

#### Step 1: List all databases
```javascript
show dbs
```
*Output:*
```json
admin      104.00 KiB
config     108.00 KiB
library     60.00 KiB
local       72.00 KiB
```

#### Step 2: Switch to / create database
```javascript
use library
```
*Output:* `switched to db library`  
*(Note: Exists in memory until first document is written).*

#### Step 3: Create collection explicitly
```javascript
db.createCollection("books")
```
*Output:* `{ ok: 1 }`

#### Step 4: Insert sample documents
```javascript
db.books.insertMany([
    { title: "1984", author: "George Orwell", year: 1949, genre: "Dystopian", price: 12.99 },
    { title: "To Kill a Mockingbird", author: "Harper Lee", year: 1960, genre: "Fiction", price: 14.99 },
    { title: "The Great Gatsby", author: "F. Scott Fitzgerald", year: 1925, genre: "Classic", price: 10.99 },
    { title: "Moby Dick", author: "Herman Melville", year: 1851, genre: "Adventure", price: 9.99 },
    { title: "Brave New World", author: "Aldous Huxley", year: 1932, genre: "Dystopian", price: 11.99 }
])
```
*Output:* `{ acknowledged: true, insertedIds: { '0': ObjectId('...'), ... } }`

#### Step 5: List collections
```javascript
show collections
```
*Output:* `[ 'books' ]`

#### Step 6: Drop collection
```javascript
db.books.drop()
```
*Output:* `true`

#### Step 7: Drop database
```javascript
db.dropDatabase()
```
*Output:* `{ ok: 1, dropped: 'library' }`

---

### Part (b): Records Operations & Aggregations

#### Step 1: Re-create database and seed data
```javascript
use library
db.books.insertMany([
    { title: "1984", author: "George Orwell", year: 1949, genre: "Dystopian", price: 12.99 },
    { title: "To Kill a Mockingbird", author: "Harper Lee", year: 1960, genre: "Fiction", price: 14.99 },
    { title: "The Great Gatsby", author: "F. Scott Fitzgerald", year: 1925, genre: "Classic", price: 10.99 },
    { title: "Moby Dick", author: "Herman Melville", year: 1851, genre: "Adventure", price: 9.99 },
    { title: "Brave New World", author: "Aldous Huxley", year: 1932, genre: "Dystopian", price: 11.99 }
])
```

#### Step 2: Find all books sorted by year (ascending)
```javascript
db.books.find().sort({ year: 1 })
```
*Result:* Returns 5 books ordered: Moby Dick (1851) &rarr; The Great Gatsby (1925) &rarr; Brave New World (1932) &rarr; 1984 (1949) &rarr; To Kill a Mockingbird (1960).

#### Step 3: Find first 3 books using limit(3)
```javascript
db.books.find().limit(3)
```
*Result:* Restricts cursor response to the first 3 records.

#### Step 4: Find books of a specific genre
```javascript
db.books.find({ genre: "Dystopian" })
```
*Result:* Returns "1984" and "Brave New World".

#### Step 5: Create index on author field & verify
```javascript
db.books.createIndex({ author: 1 })
db.books.getIndexes()
```
*Result:* Index `author_1` created alongside default `_id_` index.

#### Step 6: Aggregation – Group by genre and count books
```javascript
db.books.aggregate([
    { $group: { _id: "$genre", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
])
```
*Result:*
```json
[
  { "_id": "Dystopian", "count": 2 },
  { "_id": "Fiction", "count": 1 },
  { "_id": "Classic", "count": 1 },
  { "_id": "Adventure", "count": 1 }
]
```

#### Step 7: Aggregation – Average price per genre
```javascript
db.books.aggregate([
    { $group: { _id: "$genre", avgPrice: { $avg: "$price" } } },
    { $sort: { avgPrice: -1 } }
])
```
*Result:*
```json
[
  { "_id": "Fiction", "avgPrice": 14.99 },
  { "_id": "Dystopian", "avgPrice": 12.49 },
  { "_id": "Classic", "avgPrice": 10.99 },
  { "_id": "Adventure", "avgPrice": 9.99 }
]
```

#### Step 8: Combined aggregation – Filter, Group, Sort, Project
```javascript
db.books.aggregate([
    { $match: { year: { $gt: 1900 } } },
    { $group: { _id: "$genre", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
    { $sort: { count: -1 } },
    { $project: { genre: "$_id", count: 1, avgPrice: 1, _id: 0 } }
])
```
*Result:*
```json
[
  { "count": 2, "avgPrice": 12.49, "genre": "Dystopian" },
  { "count": 1, "avgPrice": 14.99, "genre": "Fiction" },
  { "count": 1, "avgPrice": 10.99, "genre": "Classic" }
]
```

#### Example 1: Group by Genre and Decade
```javascript
db.books.aggregate([
    { $match: { year: { $gte: 1900 } } },
    { $group: { _id: { genre: "$genre", decade: { $subtract: [ "$year", { $mod: [ "$year", 10 ] } ] } }, total: { $sum: 1 } } },
    { $sort: { "_id.decade": 1 } }
])
```

#### Example 2: Find with Sort (descending) and Limit
```javascript
db.books.find({ genre: "Dystopian" }).sort({ year: -1 }).limit(2)
```

---

## 4. Execution Instructions

### A. Run via mongosh
To execute the automated mongosh script directly:
```bash
npm run lab
# Or directly:
mongosh "mongodb://127.0.0.1:27017" commands.mongosh
```

### B. Run Programmatic Node.js Runner
To execute using the official MongoDB Node.js driver with console tables:
```bash
npm run node-lab
# Or directly:
node record_operations.js
```

### C. Launch Interactive Web Dashboard
```bash
npm start
# Access at: http://localhost:5051
```
The web dashboard provides:
1. **Guided Lab Workflow**: Interactive step cards for Part A and Part B with table and JSON viewers.
2. **Aggregation Pipeline Studio**: Visual stage flow (`$match` &rarr; `$group` &rarr; `$sort` &rarr; `$project`) with dynamic bar charts.
3. **Database Explorer**: Visual document cards with delete and insert modals + active index inspector.
4. **Interactive mongosh Console**: Terminal emulator running queries live on the local MongoDB instance.
5. **Lab Report**: Academic record and viva voce study reference.

---

## 5. Viva Voce Questions & Answers

### Q1: What is the difference between a capped collection and a regular collection?
**Answer:** Regular collections grow dynamically as documents are inserted. Capped collections are fixed-size circular collections that maintain insertion order; once the allocated size is reached, MongoDB automatically overwrites the oldest documents.

### Q2: What is the function of the `_id` field in MongoDB?
**Answer:** The `_id` field serves as the unique primary key for every document. If not specified during insertion, MongoDB automatically assigns an `ObjectId`, a 12-byte BSON type comprising a 4-byte timestamp, 5-byte random value, and 3-byte incrementing counter. MongoDB automatically enforces a unique index on `_id`.

### Q3: How do indexes improve query performance in MongoDB?
**Answer:** Without an index, MongoDB performs a full collection scan (`COLLSCAN`), checking every document in the collection. An index creates an ordered B-Tree data structure on the indexed fields, allowing MongoDB to perform an index scan (`IXSCAN`), reducing lookup time complexity from $O(N)$ to $O(\log N)$.

### Q4: Explain the role of `$match` and `$project` in an aggregation pipeline.
**Answer:** 
- `$match` filters incoming documents like a SQL `WHERE` clause. Placing `$match` as early as possible filters unnecessary documents and leverages indexes.
- `$project` reshapes documents like a SQL `SELECT` clause, allowing field inclusion (`1`), suppression (`0`), renaming, and computed expressions.

### Q5: What is the default sort order when calling `.sort({ field: 1 })` versus `.sort({ field: -1 })`?
**Answer:**
- `1` sorts in ascending order (smallest to largest, A to Z, oldest to newest).
- `-1` sorts in descending order (largest to smallest, Z to A, newest to oldest).
#   p r o 1 1  
 