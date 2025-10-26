import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PredictionPage from './pages/PredictionPage';
import PredictionsListPage from './pages/PredictionsListPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/predictions" element={<PredictionsListPage />} />
      <Route path="/prediction" element={<PredictionPage />} />
      <Route path="/prediction/:id" element={<PredictionPage />} />
    </Routes>
  );
}