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

// Base URL for scraping and categories to target
const BASE_URL = 'https://hianime.to';
const CATEGORIES = ['/tv', '/movie', '/home'];

// Function to scrape a page from a given category
async function scrapePage(category, page) {
  const url = `${BASE_URL}${category}?page=${page}`;
  console.log(`🔍 Scraping: ${url}`);

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Use the selectors from the provided HTML for TV/Movies:
    // The anime items are within ".film_list-wrap .flw-item"
    if ($('.film_list-wrap .flw-item').length === 0) {
      console.log(`⚠️ No anime found on page ${page}. Skipping...`);
      return false;
    }

    // Extract anime details for each item
    $('.film_list-wrap .flw-item').each(async (_, element) => {
      const title = $(element).find('.film-detail .film-name a').text().trim();
      const relativeUrl = $(element).find('.film-detail .film-name a').attr('href');
      const animeUrl = BASE_URL + relativeUrl;
      const image = $(element).find('.film-poster img').attr('data-src'); // lazyload image attribute
      const description = $(element).find('.film-detail .descr').text().trim();
      // Episode count is in the tick element; extract the first tick-item text and convert to number
      const episodesText = $(element).find('.tick .tick-item').first().text().trim();
      const episodes = parseInt(episodesText) || 0;

      try {
        await Anime.create({ title, url: animeUrl, image, description, episodes });
        console.log(`✅ Saved: ${title}`);
      } catch (error) {
        console.warn(`⚠️ Duplicate or error saving ${title}: ${error.message}`);
      }
    });

    return true; // Page exists and was scraped
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`🚫 404 Error: ${url} does not exist. Stopping category.`);
      return false; // Stop scraping this category on a 404
    }
    console.error(`❌ Error fetching ${url}:`, error.message);
    return false;
  }
}

// Function to scrape all pages for each category
async function scrapeAllPages() {
  for (const category of CATEGORIES) {
    let page = 1;
    let lastValidPage = 0;

    while (page <= 500) {
      const exists = await scrapePage(category, page);
      if (exists) {
        lastValidPage = page; // Update last valid page number
      } else if (page - lastValidPage > 5) {
        // If 5 consecutive pages yield no results, assume the category is finished
        console.log(`🚫 Stopping ${category} at page ${lastValidPage}`);
        break;
      }
      page++; // Move to the next page
      // Delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  console.log('✅ Scraping complete.');
  mongoose.connection.close();
}

// Start Scraping
scrapeAllPages();
          
