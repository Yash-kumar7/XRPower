import { Container, Typography, Box, Card, CardContent, CardActions, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const MOCK_QUESTIONS = [
  "Will the price of Bitcoin exceed $150,000 by the end of 2025?",
  "Will Ethereum transition to Proof of Stake by 2025?",
  "Will the total market cap of cryptocurrencies surpass $10 trillion in 2025?",
  "Will Solana's average transaction fee remain below $0.01 in 2025?",
  "Will Cardano implement smart contracts by Q2 2026?",
  "Will Polkadot win the parachain auction for the first 10 slots?",
  "Will Dogecoin be accepted by Tesla for car purchases by 2026?",
  "Will the NFT market volume exceed $500 billion in 2025?",
  "Will the DeFi total value locked surpass $1 trillion by 2026?",
  "Will the average gas fee on Ethereum layer 1 remain above $10 in 2026?",
  "Will the European Union implement a comprehensive crypto regulation framework by 2025?",
  "Will China reverse its cryptocurrency ban by 2026?",
  "Will the Federal Reserve launch a digital dollar by 2027?",
  "Will the total number of cryptocurrency users exceed 1 billion by 2025?",
  "Will Web3 become mainstream by 2030?",
  "Will the Metaverse market cap exceed $10 trillion by 2030?",
  "Will AI-generated NFTs become a significant market segment by 2025?",
];

// Generate predictions data
const generateDummyPredictions = () => {
  const predictions = [
    {
      id: 'xrp-2025',
      title: 'XRP Price Prediction',
      description: 'Will XRP reach $5 by the end of year?',
      endDate: '2025-12-31',
      totalStaked: 12500,
      participants: 342,
      isActive: true
    }
  ];

  // Add the mock questions
  MOCK_QUESTIONS.forEach((question, index) => {
    const randomDays = Math.floor(Math.random() * 365);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 180 + randomDays); // At least 6 months from now
    
    // Extract a short title from the question
    const title = question.split('?')[0].substring(0, 40) + (question.length > 40 ? '...' : '');
    
    predictions.push({
      id: `pred-${index + 1}`,
      title: title,
      description: question,
      endDate: endDate.toISOString().split('T')[0],
      totalStaked: Math.floor(Math.random() * 50000) + 5000,
      participants: Math.floor(Math.random() * 1000) + 100,
      isActive: Math.random() > 0.2 // 80% chance of being active
    });
  });

  return predictions;
};

export default function PredictionsListPage() {
  const navigate = useNavigate();
  const predictions = generateDummyPredictions();

  const handleViewDetails = (predictionId: string) => {
    navigate(`/prediction/${predictionId}`);
  };

  return (
    <Box sx={{ 
      py: 4, 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f6f8fd 0%, #eef2f7 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <Container maxWidth="lg">
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4, fontWeight: 'bold', color: 'primary.main' }}>
          Active Predictions
        </Typography>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '24px',
          width: '100%'
        }}>
          {predictions.map((prediction) => (
            <div key={prediction.id}>
              <Card sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
                }
              }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
                    {prediction.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: '40px' }}>
                    {prediction.description}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption">Ends:</Typography>
                    <Typography variant="caption" fontWeight="bold">
                      {new Date(prediction.endDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption">Total Staked:</Typography>
                    <Typography variant="caption" fontWeight="bold">
                      {prediction.totalStaked.toLocaleString()} XRP
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption">Participants:</Typography>
                    <Typography variant="caption" fontWeight="bold">
                      {prediction.participants}
                    </Typography>
                  </Box>
                </CardContent>
                <CardActions sx={{ p: 2, pt: 0 }}>
                  <Button 
                    size="small" 
                    color="primary"
                    variant="contained"
                    fullWidth
                    onClick={() => handleViewDetails(prediction.id)}
                    disabled={!prediction.isActive}
                  >
                    {prediction.isActive ? 'View Details' : 'Ended'}
                  </Button>
                </CardActions>
              </Card>
            </div>
          ))}
        </div>
      </Container>
    </Box>
  );
}
