const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5051;
const LOCAL_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'library';
const COLLECTION_NAME = 'books';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let client;
let db;
let booksCollection;

const sampleBooks = [
  { title: "1984", author: "George Orwell", year: 1949, genre: "Dystopian", price: 12.99 },
  { title: "To Kill a Mockingbird", author: "Harper Lee", year: 1960, genre: "Fiction", price: 14.99 },
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald", year: 1925, genre: "Classic", price: 10.99 },
  { title: "Moby Dick", author: "Herman Melville", year: 1851, genre: "Adventure", price: 9.99 },
  { title: "Brave New World", author: "Aldous Huxley", year: 1932, genre: "Dystopian", price: 11.99 }
];

async function initMongoDB() {
  try {
    client = new MongoClient(LOCAL_URI);
    await client.connect();
    db = client.db(DB_NAME);
    booksCollection = db.collection(COLLECTION_NAME);
    console.log(`Connected successfully to MongoDB at ${LOCAL_URI}`);
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
  }
}

// Helper to ensure connection
function checkDbConnection(req, res, next) {
  if (!client || !db) {
    return res.status(503).json({ error: 'Database not connected. Ensure MongoDB is running.' });
  }
  next();
}

// ----------------------------------------------------
// SYSTEM & STATUS APIS
// ----------------------------------------------------
app.get('/api/status', checkDbConnection, async (req, res) => {
  try {
    const adminDb = client.db().admin();
    const buildInfo = await adminDb.buildInfo();
    const dbsList = await adminDb.listDatabases();
    const collections = await db.listCollections().toArray();
    const colExists = collections.some(c => c.name === COLLECTION_NAME);
    
    let docCount = 0;
    let indexes = [];
    if (colExists) {
      docCount = await booksCollection.countDocuments();
      indexes = await booksCollection.indexes();
    }

    res.json({
      connected: true,
      serverVersion: buildInfo.version,
      database: DB_NAME,
      collection: COLLECTION_NAME,
      collections: collections.map(c => c.name),
      allDatabases: dbsList.databases.map(d => ({ name: d.name, sizeOnDisk: d.sizeOnDisk })),
      documentCount: docCount,
      indexes: indexes,
      localUri: LOCAL_URI
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset database and seed books
app.post('/api/reset', checkDbConnection, async (req, res) => {
  try {
    const existingCollections = await db.listCollections().toArray();
    if (existingCollections.some(c => c.name === COLLECTION_NAME)) {
      await booksCollection.drop();
    }
    const insertRes = await booksCollection.insertMany(sampleBooks.map(b => ({ ...b })));
    const allBooks = await booksCollection.find({}).toArray();
    const indexes = await booksCollection.indexes();

    res.json({
      success: true,
      message: 'Database reset & seeded with 5 canonical sample documents.',
      insertedCount: insertRes.insertedCount,
      books: allBooks,
      indexes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current books
app.get('/api/books', checkDbConnection, async (req, res) => {
  try {
    const collections = await db.listCollections().toArray();
    if (!collections.some(c => c.name === COLLECTION_NAME)) {
      return res.json({ success: true, count: 0, data: [] });
    }
    const books = await booksCollection.find({}).toArray();
    res.json({ success: true, count: books.length, data: books });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Insert single book
app.post('/api/books', checkDbConnection, async (req, res) => {
  try {
    const { title, author, year, genre, price } = req.body;
    if (!title || !author) {
      return res.status(400).json({ error: 'Title and author are required' });
    }
    const newBook = {
      title,
      author,
      year: parseInt(year) || 2000,
      genre: genre || 'Fiction',
      price: parseFloat(price) || 9.99
    };
    const result = await booksCollection.insertOne(newBook);
    res.json({ success: true, insertedId: result.insertedId, document: newBook });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete book
app.delete('/api/books/:id', checkDbConnection, async (req, res) => {
  try {
    const { id } = req.params;
    let filter;
    if (ObjectId.isValid(id)) {
      filter = { _id: new ObjectId(id) };
    } else {
      filter = { title: id };
    }
    const result = await booksCollection.deleteOne(filter);
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// PART (a): DATABASES & COLLECTIONS STEP APIS
// ----------------------------------------------------
app.post('/api/part-a/step/:stepId', checkDbConnection, async (req, res) => {
  const { stepId } = req.params;
  try {
    const adminDb = client.db().admin();

    switch (stepId) {
      case 'step1': { // List all databases
        const dbs = await adminDb.listDatabases();
        return res.json({
          step: 1,
          name: 'List all databases',
          command: 'show dbs',
          result: dbs.databases.map(d => ({ name: d.name, sizeOnDisk: d.sizeOnDisk }))
        });
      }
      case 'step2': { // Create/switch to database
        return res.json({
          step: 2,
          name: 'Create / switch to database "library"',
          command: 'use library',
          result: { switchedTo: DB_NAME, status: 'In memory until documents created' }
        });
      }
      case 'step3': { // Create collection explicitly
        const cols = await db.listCollections().toArray();
        if (cols.some(c => c.name === COLLECTION_NAME)) {
          await booksCollection.drop();
        }
        await db.createCollection(COLLECTION_NAME);
        return res.json({
          step: 3,
          name: 'Create collection "books" explicitly',
          command: `db.createCollection("${COLLECTION_NAME}")`,
          result: { ok: 1, collection: COLLECTION_NAME }
        });
      }
      case 'step4': { // Insert documents
        const insertRes = await booksCollection.insertMany(sampleBooks.map(b => ({ ...b })));
        return res.json({
          step: 4,
          name: 'Insert sample documents into collection',
          command: 'db.books.insertMany([...])',
          result: {
            acknowledged: insertRes.acknowledged,
            insertedCount: insertRes.insertedCount,
            insertedIds: insertRes.insertedIds
          }
        });
      }
      case 'step5': { // List collections
        const cols = await db.listCollections().toArray();
        return res.json({
          step: 5,
          name: 'List collections in database',
          command: 'show collections',
          result: cols.map(c => c.name)
        });
      }
      case 'step6': { // Drop collection
        const dropRes = await booksCollection.drop().catch(() => false);
        const cols = await db.listCollections().toArray();
        return res.json({
          step: 6,
          name: 'Drop collection "books"',
          command: 'db.books.drop()',
          result: { acknowledged: dropRes, remainingCollections: cols.map(c => c.name) }
        });
      }
      case 'step7': { // Drop database
        const dropRes = await db.dropDatabase();
        return res.json({
          step: 7,
          name: 'Drop database "library"',
          command: 'db.dropDatabase()',
          result: dropRes
        });
      }
      default:
        return res.status(400).json({ error: 'Unknown stepId' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run all Part A steps sequentially
app.post('/api/part-a/run-all', checkDbConnection, async (req, res) => {
  try {
    const adminDb = client.db().admin();
    const logs = [];

    // Step 1
    const dbs = await adminDb.listDatabases();
    logs.push({ step: 1, title: 'List all databases', command: 'show dbs', output: dbs.databases.map(d => d.name) });

    // Step 2
    logs.push({ step: 2, title: 'Switch to database "library"', command: 'use library', output: 'switched to db library' });

    // Step 3
    const cols = await db.listCollections().toArray();
    if (cols.some(c => c.name === COLLECTION_NAME)) {
      await booksCollection.drop();
    }
    await db.createCollection(COLLECTION_NAME);
    logs.push({ step: 3, title: 'Create collection "books"', command: 'db.createCollection("books")', output: { ok: 1 } });

    // Step 4
    const insertRes = await booksCollection.insertMany(sampleBooks.map(b => ({ ...b })));
    logs.push({ step: 4, title: 'Insert 5 sample documents', command: 'db.books.insertMany([...])', output: { insertedCount: insertRes.insertedCount } });

    // Step 5
    const activeCols = await db.listCollections().toArray();
    logs.push({ step: 5, title: 'List collections', command: 'show collections', output: activeCols.map(c => c.name) });

    // Step 6
    const dropColRes = await booksCollection.drop();
    logs.push({ step: 6, title: 'Drop collection "books"', command: 'db.books.drop()', output: dropColRes });

    // Step 7
    const dropDbRes = await db.dropDatabase();
    logs.push({ step: 7, title: 'Drop database "library"', command: 'db.dropDatabase()', output: dropDbRes });

    res.json({ success: true, steps: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// PART (b): RECORD OPERATIONS, INDEXES & AGGREGATION
// ----------------------------------------------------
app.post('/api/part-b/query/:queryId', checkDbConnection, async (req, res) => {
  const { queryId } = req.params;
  const { genre = 'Dystopian', yearFilter = 1900 } = req.body || {};

  try {
    switch (queryId) {
      case 'seed': {
        const existing = await db.listCollections().toArray();
        if (existing.some(c => c.name === COLLECTION_NAME)) {
          await booksCollection.drop();
        }
        const insertRes = await booksCollection.insertMany(sampleBooks.map(b => ({ ...b })));
        return res.json({
          query: 'Seed sample data',
          command: 'db.books.insertMany([...])',
          result: { insertedCount: insertRes.insertedCount }
        });
      }
      case 'sort-year': {
        const books = await booksCollection.find({}).sort({ year: 1 }).toArray();
        return res.json({
          query: 'Find all books, sorted by year (ascending)',
          command: 'db.books.find().sort({ year: 1 })',
          result: books
        });
      }
      case 'limit-3': {
        const books = await booksCollection.find({}).limit(3).toArray();
        return res.json({
          query: 'Find first 3 books using limit()',
          command: 'db.books.find().limit(3)',
          result: books
        });
      }
      case 'genre-filter': {
        const books = await booksCollection.find({ genre }).toArray();
        return res.json({
          query: `Find books of genre "${genre}"`,
          command: `db.books.find({ genre: "${genre}" })`,
          result: books
        });
      }
      case 'create-index': {
        const idxName = await booksCollection.createIndex({ author: 1 });
        const allIdx = await booksCollection.indexes();
        return res.json({
          query: 'Create index on author field',
          command: 'db.books.createIndex({ author: 1 })',
          result: { createdIndex: idxName, allIndexes: allIdx }
        });
      }
      case 'get-indexes': {
        const allIdx = await booksCollection.indexes();
        return res.json({
          query: 'Get all indexes on books collection',
          command: 'db.books.getIndexes()',
          result: allIdx
        });
      }
      case 'agg-count-genre': {
        const aggResult = await booksCollection.aggregate([
          { $group: { _id: "$genre", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]).toArray();
        return res.json({
          query: 'Group books by genre and count them',
          command: 'db.books.aggregate([ { $group: { _id: "$genre", count: { $sum: 1 } } }, { $sort: { count: -1 } } ])',
          result: aggResult
        });
      }
      case 'agg-avg-price': {
        const aggResult = await booksCollection.aggregate([
          { $group: { _id: "$genre", avgPrice: { $avg: "$price" } } },
          { $sort: { avgPrice: -1 } }
        ]).toArray();
        return res.json({
          query: 'Average price of books in each genre',
          command: 'db.books.aggregate([ { $group: { _id: "$genre", avgPrice: { $avg: "$price" } } }, { $sort: { avgPrice: -1 } } ])',
          result: aggResult
        });
      }
      case 'agg-combined': {
        const aggResult = await booksCollection.aggregate([
          { $match: { year: { $gt: parseInt(yearFilter) || 1900 } } },
          { $group: { _id: "$genre", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
          { $sort: { count: -1 } },
          { $project: { genre: "$_id", count: 1, avgPrice: 1, _id: 0 } }
        ]).toArray();
        return res.json({
          query: 'Combined Aggregation (Match, Group, Sort, Project)',
          command: `db.books.aggregate([ { $match: { year: { $gt: ${yearFilter} } } }, { $group: { _id: "$genre", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } }, { $sort: { count: -1 } }, { $project: { genre: "$_id", count: 1, avgPrice: 1, _id: 0 } } ])`,
          result: aggResult
        });
      }
      case 'ex1-decade': {
        const aggResult = await booksCollection.aggregate([
          { $match: { year: { $gte: 1900 } } },
          { $group: { _id: { genre: "$genre", decade: { $subtract: ["$year", { $mod: ["$year", 10] }] } }, total: { $sum: 1 } } },
          { $sort: { "_id.decade": 1 } }
        ]).toArray();
        return res.json({
          query: 'Example 1: Aggregation by Genre and Decade',
          command: 'db.books.aggregate([ { $match: { year: { $gte: 1900 } } }, { $group: { _id: { genre: "$genre", decade: { $subtract: [ "$year", { $mod: [ "$year", 10 ] } ] } }, total: { $sum: 1 } } }, { $sort: { "_id.decade": 1 } } ])',
          result: aggResult
        });
      }
      case 'ex2-sort-limit': {
        const books = await booksCollection.find({ genre: "Dystopian" }).sort({ year: -1 }).limit(2).toArray();
        return res.json({
          query: 'Example 2: Find Dystopian sorted by year (desc) with limit(2)',
          command: 'db.books.find({ genre: "Dystopian" }).sort({ year: -1 }).limit(2)',
          result: books
        });
      }
      default:
        return res.status(400).json({ error: 'Unknown queryId' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run all Part B queries and return comprehensive bundle
app.post('/api/part-b/run-all', checkDbConnection, async (req, res) => {
  try {
    // 1. Ensure data seeded
    const cols = await db.listCollections().toArray();
    if (!cols.some(c => c.name === COLLECTION_NAME) || (await booksCollection.countDocuments()) === 0) {
      await booksCollection.insertMany(sampleBooks.map(b => ({ ...b })));
    }

    // Step 2
    const sorted = await booksCollection.find({}).sort({ year: 1 }).toArray();

    // Step 3
    const limited = await booksCollection.find({}).limit(3).toArray();

    // Step 4
    const dystopian = await booksCollection.find({ genre: "Dystopian" }).toArray();

    // Step 5
    await booksCollection.createIndex({ author: 1 });
    const indexes = await booksCollection.indexes();

    // Step 6
    const countGenre = await booksCollection.aggregate([
      { $group: { _id: "$genre", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    // Step 7
    const avgPrice = await booksCollection.aggregate([
      { $group: { _id: "$genre", avgPrice: { $avg: "$price" } } },
      { $sort: { avgPrice: -1 } }
    ]).toArray();

    // Step 8
    const combined = await booksCollection.aggregate([
      { $match: { year: { $gt: 1900 } } },
      { $group: { _id: "$genre", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
      { $sort: { count: -1 } },
      { $project: { genre: "$_id", count: 1, avgPrice: 1, _id: 0 } }
    ]).toArray();

    // Example 1
    const decade = await booksCollection.aggregate([
      { $match: { year: { $gte: 1900 } } },
      { $group: { _id: { genre: "$genre", decade: { $subtract: ["$year", { $mod: ["$year", 10] }] } }, total: { $sum: 1 } } },
      { $sort: { "_id.decade": 1 } }
    ]).toArray();

    // Example 2
    const ex2 = await booksCollection.find({ genre: "Dystopian" }).sort({ year: -1 }).limit(2).toArray();

    res.json({
      success: true,
      data: {
        step2_sorted: sorted,
        step3_limited: limited,
        step4_dystopian: dystopian,
        step5_indexes: indexes,
        step6_countGenre: countGenre,
        step7_avgPrice: avgPrice,
        step8_combined: combined,
        ex1_decade: decade,
        ex2_sortLimit: ex2
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Execute raw mongosh code
app.post('/api/run-mongosh', (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Command code is required' });
  }

  // Escape double quotes for shell execution
  const cleanCode = code.replace(/"/g, '\\"');
  const command = `mongosh "${LOCAL_URI}/library" --eval "${cleanCode}"`;

  exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
    res.json({
      success: !error,
      stdout: stdout ? stdout.trim() : '',
      stderr: stderr ? stderr.trim() : '',
      error: error ? error.message : null
    });
  });
});

// Run custom aggregation pipeline
app.post('/api/aggregate-custom', checkDbConnection, async (req, res) => {
  try {
    const { pipeline } = req.body;
    if (!Array.isArray(pipeline)) {
      return res.status(400).json({ error: 'Pipeline must be an array of stages' });
    }
    const result = await booksCollection.aggregate(pipeline).toArray();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`MongoDB Lab Experiment Server running on http://localhost:${PORT}`);
  });
});
