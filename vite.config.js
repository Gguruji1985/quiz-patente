import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/quiz-patente/', // change 'quiz-patente' to match your GitHub repo name
  // Serve QuizPatenteB-main/ as the static root so /img_sign/*.png resolves correctly
  publicDir: 'QuizPatenteB-main',
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: 'http://quizpatente.local:5173'
  },
});
