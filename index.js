const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/animeDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define a schema and model for storing endpoint data
const endpointSchema = new mongoose.Schema({
  url: { type: String, unique: true },
  title: String,
  // You can add additional fields as needed
});
const Endpoint = mongoose.model('Endpoint', endpointSchema);

// Set to keep track of visited URLs and a queue for URLs to visit
const visited = new Set();
const queue = [];

// Starting URL (homepage or sitemap)
const START_URL = 'https://hianime.to';

async function crawl(url) {
  // Check if the URL has already been visited
  if (visited.has(url)) return;
  visited.add(url);

  console.log('Crawling:', url);

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Optionally, extract a title or other metadata from the page
    const title = $('title').text().trim();

    // Save the endpoint data to MongoDB
    const endpointData = new Endpoint({ url, title });
    try {
      await endpointData.save();
      console.log(`Saved: ${url}`);
    } catch (dbError) {
      // Duplicate key errors (or other errors) may occur if URL exists
      console.error(`Database error for ${url}:`, dbError.message);
    }

    // Find all links on the page
    $('a[href]').each((index, element) => {
      let link = $(element).attr('href');

      // Normalize the link (handling relative URLs)
      if (link && !link.startsWith('http')) {
        // Resolve relative URLs to absolute using the current URL as the base
        link = new URL(link, url).href;
      }

      // Check if the link belongs to the same domain (hianime.to)
      if (link && link.includes('hianime.to') && !visited.has(link)) {
        // Add the link to the queue
        queue.push(link);
      }
    });
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
  }
}

// Function to start the crawling process
async function startCrawling() {
  queue.push(START_URL);

  while (queue.length > 0) {
    const nextUrl = queue.shift();
    await crawl(nextUrl);

    // Optionally, add a delay between requests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('Crawling complete.');
  mongoose.connection.close();
}

startCrawling();
      
