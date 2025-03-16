const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');

// MongoDB Connection
mongoose.connect('mongodb+srv://eren:Narutoop9@cluster0.yuxdo.mongodb.net/RyuuApp?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB Error:', err));

// Anime Schema
const animeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true, unique: true },
  image: { type: String },
  description: { type: String },
  episodes: { type: Number }
});

const Anime = mongoose.model('Anime', animeSchema);

// Base URLs for scraping
const BASE_URL = 'https://hianime.to';
const CATEGORIES = ['/home', '/tv', '/movie'];

// Function to scrape a page
async function scrapePage(category, page) {
  const url = `${BASE_URL}${category}?page=${page}`;
  console.log(`🔍 Scraping: ${url}`);

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Check if the page is valid
    if ($('.anime-list .item').length === 0) {
      console.log(`⚠️ No anime found on page ${page}. Skipping...`);
      return false;
    }

    // Extract anime details
    $('.anime-list .item').each(async (_, element) => {
      const title = $(element).find('.name a').text().trim();
      const animeUrl = BASE_URL + $(element).find('.name a').attr('href');
      const image = $(element).find('.poster img').attr('src');
      const description = $(element).find('.description').text().trim();
      const episodes = parseInt($(element).find('.meta span').last().text()) || 0;

      try {
        await Anime.create({ title, url: animeUrl, image, description, episodes });
        console.log(`✅ Saved: ${title}`);
      } catch (error) {
        console.warn(`⚠️ Duplicate Skipped: ${title}`);
      }
    });

    return true; // Page exists and was scraped
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`🚫 404 Error: ${url} does not exist. Stopping category.`);
      return false; // Stop scraping this category
    }
    console.error(`❌ Error fetching ${url}:`, error.message);
    return false;
  }
}

// Function to scrape all pages efficiently
async function scrapeAllPages() {
  for (const category of CATEGORIES) {
    let page = 1;
    let lastValidPage = 0;

    while (page <= 500) {
      const exists = await scrapePage(category, page);
      if (exists) {
        lastValidPage = page; // Update last valid page number
      } else if (page - lastValidPage > 5) {
        // If 5 consecutive pages are missing, assume category is done
        console.log(`🚫 Stopping ${category} at page ${lastValidPage}`);
        break;
      }

      page++; // Move to next page
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to prevent rate limiting
    }
  }
  console.log('✅ Scraping complete.');
  mongoose.connection.close();
}

// Start Scraping
scrapeAllPages();
      
