/**
 * Node.js Programmatic Runner for MongoDB Experiment
 * Uses the official MongoDB Node.js driver to execute Part (a) and Part (b)
 */

const { MongoClient } = require('mongodb');

const URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'library';
const COLLECTION_NAME = 'books';

const sampleBooks = [
  { title: "1984", author: "George Orwell", year: 1949, genre: "Dystopian", price: 12.99 },
  { title: "To Kill a Mockingbird", author: "Harper Lee", year: 1960, genre: "Fiction", price: 14.99 },
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald", year: 1925, genre: "Classic", price: 10.99 },
  { title: "Moby Dick", author: "Herman Melville", year: 1851, genre: "Adventure", price: 9.99 },
  { title: "Brave New World", author: "Aldous Huxley", year: 1932, genre: "Dystopian", price: 11.99 }
];

async function runExperiment() {
  const client = new MongoClient(URI);

  try {
    await client.connect();
    console.log(`\x1b[32m✔ Successfully connected to MongoDB at ${URI}\x1b[0m\n`);

    // ==========================================
    // PART (a): DATABASES AND COLLECTIONS
    // ==========================================
    console.log('='.repeat(70));
    console.log('\x1b[36m>>> PART (a): DATABASES AND COLLECTIONS <<<\x1b[0m');
    console.log('='.repeat(70));

    const adminDb = client.db().admin();

    // Step 1: List all databases
    console.log('\n\x1b[33m--- Step 1: List all databases ---\x1b[0m');
    const dbsList = await adminDb.listDatabases();
    console.table(dbsList.databases.map(d => ({ Database: d.name, SizeBytes: d.sizeOnDisk })));

    // Step 2 & 3: Switch to 'library' & create collection 'books'
    console.log('\n\x1b[33m--- Step 2 & 3: Switch to database "library" and create collection "books" ---\x1b[0m');
    const db = client.db(DB_NAME);
    const existingCollections = await db.listCollections().toArray();
    if (existingCollections.some(c => c.name === COLLECTION_NAME)) {
      await db.collection(COLLECTION_NAME).drop();
    }
    await db.createCollection(COLLECTION_NAME);
    console.log(`\x1b[32m✔ Collection "${COLLECTION_NAME}" created in database "${DB_NAME}".\x1b[0m`);

    // Step 4: Insert sample documents
    console.log('\n\x1b[33m--- Step 4: Insert sample documents into collection ---\x1b[0m');
    const insertRes = await db.collection(COLLECTION_NAME).insertMany(sampleBooks);
    console.log(`\x1b[32m✔ Inserted ${insertRes.insertedCount} documents.\x1b[0m`);

    // Step 5: View all collections
    console.log('\n\x1b[33m--- Step 5: View all collections in the database ---\x1b[0m');
    const collections = await db.listCollections().toArray();
    console.table(collections.map(c => ({ CollectionName: c.name, Type: c.type })));

    // Step 6: Drop the collection
    console.log('\n\x1b[33m--- Step 6: Drop the collection "books" ---\x1b[0m');
    const dropCol = await db.collection(COLLECTION_NAME).drop();
    console.log(`\x1b[31m✔ Dropped collection "${COLLECTION_NAME}": ${dropCol}\x1b[0m`);

    // Step 7: Drop the database
    console.log('\n\x1b[33m--- Step 7: Drop the database "library" ---\x1b[0m');
    const dropDb = await db.dropDatabase();
    console.log(`\x1b[31m✔ Dropped database "${DB_NAME}": ${dropDb}\x1b[0m`);

    // ==========================================
    // PART (b): RECORDS OPERATIONS
    // ==========================================
    console.log('\n' + '='.repeat(70));
    console.log('\x1b[36m>>> PART (b): RECORDS OPERATIONS (find, limit, sort, index, aggregate) <<<\x1b[0m');
    console.log('='.repeat(70));

    // Step 1: Re-create and seed data
    console.log('\n\x1b[33m--- Step 1: Re-create collection and seed sample data ---\x1b[0m');
    const booksCol = db.collection(COLLECTION_NAME);
    const seedRes = await booksCol.insertMany(sampleBooks);
    console.log(`\x1b[32m✔ Seeded ${seedRes.insertedCount} book records.\x1b[0m`);

    // Step 2: Find all books sorted by year (ascending)
    console.log('\n\x1b[33m--- Step 2: Find all books sorted by year (ascending: 1) ---\x1b[0m');
    const sortedBooks = await booksCol.find({}).sort({ year: 1 }).toArray();
    console.table(sortedBooks.map(b => ({ Title: b.title, Author: b.author, Year: b.year, Genre: b.genre, Price: `$${b.price}` })));

    // Step 3: Find first 3 books using limit(3)
    console.log('\n\x1b[33m--- Step 3: Find first 3 books using limit(3) ---\x1b[0m');
    const limitedBooks = await booksCol.find({}).limit(3).toArray();
    console.table(limitedBooks.map(b => ({ Title: b.title, Author: b.author, Year: b.year, Genre: b.genre, Price: `$${b.price}` })));

    // Step 4: Find books of a specific genre ("Dystopian")
    console.log('\n\x1b[33m--- Step 4: Find books of specific genre ("Dystopian") ---\x1b[0m');
    const genreBooks = await booksCol.find({ genre: "Dystopian" }).toArray();
    console.table(genreBooks.map(b => ({ Title: b.title, Author: b.author, Year: b.year, Genre: b.genre, Price: `$${b.price}` })));

    // Step 5: Create index on author field and check indexes
    console.log('\n\x1b[33m--- Step 5: Create index on "author" field ---\x1b[0m');
    const indexName = await booksCol.createIndex({ author: 1 });
    console.log(`\x1b[32m✔ Created Index: ${indexName}\x1b[0m`);
    const allIndexes = await booksCol.indexes();
    console.log('\nActive Indexes:');
    console.table(allIndexes.map(idx => ({ IndexName: idx.name, Key: JSON.stringify(idx.key) })));

    // Step 6: Aggregation - Group by genre and count books
    console.log('\n\x1b[33m--- Step 6: Aggregation: Group by genre and count books ---\x1b[0m');
    const countByGenre = await booksCol.aggregate([
      { $group: { _id: "$genre", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    console.table(countByGenre.map(g => ({ Genre: g._id, Count: g.count })));

    // Step 7: Aggregation - Average price of books in each genre
    console.log('\n\x1b[33m--- Step 7: Aggregation: Average price per genre ---\x1b[0m');
    const avgPriceByGenre = await booksCol.aggregate([
      { $group: { _id: "$genre", avgPrice: { $avg: "$price" } } },
      { $sort: { avgPrice: -1 } }
    ]).toArray();
    console.table(avgPriceByGenre.map(g => ({ Genre: g._id, AvgPrice: `$${g.avgPrice.toFixed(2)}` })));

    // Step 8: Combined aggregation - Match, Group, Sort, Project
    console.log('\n\x1b[33m--- Step 8: Combined Aggregation: Match (year > 1900), Group, Sort, Project ---\x1b[0m');
    const combinedAgg = await booksCol.aggregate([
      { $match: { year: { $gt: 1900 } } },
      { $group: { _id: "$genre", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
      { $sort: { count: -1 } },
      { $project: { genre: "$_id", count: 1, avgPrice: 1, _id: 0 } }
    ]).toArray();
    console.table(combinedAgg.map(g => ({ Genre: g.genre, Count: g.count, AvgPrice: `$${g.avgPrice.toFixed(2)}` })));

    // Example 1: Aggregation by Decade
    console.log('\n\x1b[33m--- Example 1: Aggregation by Genre & Decade ---\x1b[0m');
    const decadeAgg = await booksCol.aggregate([
      { $match: { year: { $gte: 1900 } } },
      { $group: { _id: { genre: "$genre", decade: { $subtract: ["$year", { $mod: ["$year", 10] }] } }, total: { $sum: 1 } } },
      { $sort: { "_id.decade": 1 } }
    ]).toArray();
    console.table(decadeAgg.map(d => ({ Genre: d._id.genre, Decade: `${d._id.decade}s`, Total: d.total })));

    // Example 2: Find with Sorting and Limiting
    console.log('\n\x1b[33m--- Example 2: Find with Sort (year desc) and Limit (2) ---\x1b[0m');
    const ex2 = await booksCol.find({ genre: "Dystopian" }).sort({ year: -1 }).limit(2).toArray();
    console.table(ex2.map(b => ({ Title: b.title, Author: b.author, Year: b.year, Genre: b.genre, Price: `$${b.price}` })));

    console.log('\n' + '='.repeat(70));
    console.log('\x1b[32m✔ ALL EXPERIMENT QUERIES COMPLETED SUCCESSFULLY!\x1b[0m');
    console.log('='.repeat(70) + '\n');

  } catch (err) {
    console.error('\x1b[31mError during experiment execution:\x1b[0m', err);
  } finally {
    await client.close();
  }
}

runExperiment();
