import app from './src/app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`PocketPOS Backend Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} for API information`);
});
