import { Container, Typography, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundImage: 'url(/image.jpg)', 
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: 'white',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at center, transparent, rgba(0,0,0,0.7))',
          zIndex: 1,
        },
      }}
    >
      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 2, py: 10 }}>
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Welcome to XRPower
        </Typography>
        <Typography variant="h5" sx={{ mb: 4, fontWeight: 500 }}>
          Predict outcomes. Stake XRP. Earn rewards.
        </Typography>
        <Box>
          <Button 
            variant="contained" 
            size="large" 
            onClick={() => navigate('/prediction')}
            sx={{
              backgroundColor: '#0088cc',
              '&:hover': {
                backgroundColor: '#006699',
              },
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
            }}
          >
            Get Started
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
