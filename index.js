const axios = require('axios');
const mongoose = require('mongoose');

// MongoDB Connection
mongoose.connect('mongodb+srv://eren:Narutoop9@cluster0.yuxdo.mongodb.net/RyuuApp?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB Error:', err));

// Define Anime and Episodes Schema
const animeSchema = new mongoose.Schema({
  title: String,
  url: String,
  image: String,
  description: String,
  episodes: Number
});
const Anime = mongoose.model('Anime', animeSchema);

const episodeSchema = new mongoose.Schema({
  anime_id: String,
  episode_no: Number,
  id: String,
  title: String,
  japanese_title: String,
  filler: Boolean
});
const Episode = mongoose.model('Episode', episodeSchema);

// Function to fetch and save episodes
async function fetchAndSaveEpisodes() {
  try {
    const animes = await Anime.find({}, 'url'); // Get all anime URLs
    for (const anime of animes) {
      const animeId = anime.url.replace('https://hianime.to/', '');
      const apiUrl = `https://anime-api-nu-jet.vercel.app/api/episodes/${animeId}`;

      try {
        const { data } = await axios.get(apiUrl);
        if (data.success && data.results.episodes.length > 0) {
          await Episode.deleteMany({ anime_id: animeId }); // Remove old episodes
          const episodesToInsert = data.results.episodes.map(ep => ({
            anime_id: animeId,
            episode_no: ep.episode_no,
            id: ep.id,
            title: ep.title,
            japanese_title: ep.japanese_title,
            filler: ep.filler
          }));
          await Episode.insertMany(episodesToInsert);
          console.log(`✅ Episodes saved for: ${animeId}`);
        }
      } catch (error) {
        console.error(`❌ Error fetching episodes for ${animeId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching anime data:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

// Start fetching episodes
fetchAndSaveEpisodes();
