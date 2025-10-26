import { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  CardActions, 
  Button, 
  LinearProgress, 
  Box, 
  Paper,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  AlertTitle,
  IconButton,
  Menu,
  MenuItem,
  Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { Wallet } from 'xrpl';

type Option = 'yes' | 'no';

interface Transaction {
  hash: string;
  amount: number;
  timestamp: string;
}

interface Voter {
  address: string;
  amount: number;
  transactions: Transaction[];
}

interface PredictionOption {
  id: string;
  text: string;
  votes: number;
  amount: number;
  address: string;
  voters: Voter[];
  totalReceived: number;
}

interface Reward {
  to: string;
  amount: number;
  txHash: string;
  status: string;
}

interface Prediction {
  question: string;
  options: PredictionOption[];
  totalVotes: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  endTime: string;
  resolved: boolean;
  winningOption: Option | null;
  resolution?: {
    winningOption: Option;
    totalPool: number;
    winnerCount: number;
    rewards: Reward[];
    timestamp: string;
  };
}

export default function PredictionPage() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    fetchPrediction();
    const intervalId = setInterval(fetchPrediction, 5000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const savedSecret = localStorage.getItem('walletSecret');
    if (savedSecret) {
      try {
        const loadedWallet = Wallet.fromSeed(savedSecret);
        setWallet(loadedWallet);
      } catch (error) {
        console.error('Invalid saved wallet secret', error);
        localStorage.removeItem('walletSecret');
      }
    }
  }, []);

  const fetchPrediction = async () => {
    try {
      const apiUrl = 'http://localhost:5000/api/prediction';
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(`Failed to fetch prediction: ${response.statusText} - ${errorMessage}`);
      }
      
      const data = await response.json();
      setPrediction(data);
      setLoading(false);
      return data;
    } catch (error) {
      console.error('Error in fetchPrediction:', error);
      setLoading(false);
      return null;
    }
  };

  const connectWallet = async () => {
    const secret = window.prompt('Enter your wallet secret:');
    if (!secret) return;

    try {
      const newWallet = Wallet.fromSeed(secret);
      setWallet(newWallet);
      localStorage.setItem('walletSecret', secret);
      alert(`Wallet connected: ${newWallet.address}`);
    } catch (error) {
      console.error('Invalid wallet secret', error);
      alert('Invalid wallet secret. Please try again.');
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    localStorage.removeItem('walletSecret');
    setAnchorEl(null);
    alert('Wallet disconnected');
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleVote = async (optionId: Option) => {
    if (!prediction) return;
    
    const option = prediction.options.find(opt => opt.id === optionId);
    if (!option) return;

    // Check if wallet is connected
    if (!wallet) {
      alert('Please connect your wallet first.');
      connectWallet();
      return;
    }

    try {
      const amount = window.prompt(`How much XRP do you want to vote for ${optionId.toUpperCase()}?`);
      if (!amount) return;
      
      const xrpAmount = parseFloat(amount);
      if (isNaN(xrpAmount) || xrpAmount <= 0) {
        alert('Please enter a valid amount greater than 0');
        return;
      }

      alert(`Submitting your vote for ${xrpAmount} XRP...`);

      const response = await fetch('http://localhost:5000/api/process-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionId,
          amount: xrpAmount,
          walletSecret: wallet.seed,
          senderAddress: wallet.address,
          destinationAddress: option.address,
          destinationTag: optionId === 'yes' ? 1 : 2
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        const txExplorerUrl = `https://testnet.xrpl.org/transactions/${data.transactionHash}`;
        alert(`✅ Vote submitted successfully!\n\nView transaction: ${txExplorerUrl}`);
        console.log(txExplorerUrl);
        await fetchPrediction();
      } else {
        throw new Error(data.error || 'Failed to process vote');
      }
    } catch (error) {
      console.error('Error in handleVote:', error);
      alert(`Error processing vote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const calculatePercentage = (votes: number): number => {
    if (!prediction?.totalVotes) return 0;
    return Math.round((votes / prediction.totalVotes) * 100);
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Box textAlign="center">
          <CircularProgress size={60} thickness={5} sx={{ mb: 3 }} />
          <Typography variant="h5" color="textSecondary" component="div">
            Loading prediction...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (!prediction) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Failed to load prediction</AlertTitle>
          <Typography component="div" variant="body1">
            There was an issue loading the prediction data
          </Typography>
        </Alert>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={fetchPrediction}
          fullWidth
          size="large"
        >
          Retry
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      py: 4,
      background: 'linear-gradient(135deg, #f6f8fd 0%, #eef2f7 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <Container maxWidth="md">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          {prediction.question}
        </Typography>
        
        <Box>
          {wallet ? (
            <>
              <Tooltip title={wallet.address}>
                <IconButton
                  size="large"
                  aria-label="account of current user"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleMenu}
                  color="inherit"
                >
                  <AccountCircleIcon />
                </IconButton>
              </Tooltip>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem disabled>{wallet.address.slice(0, 10)}...{wallet.address.slice(-4)}</MenuItem>
                <MenuItem onClick={disconnectWallet}>Disconnect</MenuItem>
              </Menu>
            </>
          ) : (
            <Button 
              variant="outlined" 
              startIcon={<AccountCircleIcon />}
              onClick={connectWallet}
            >
              Connect Wallet
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {prediction.resolved ? (
          <Card sx={{ mb: 4, borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent sx={{ bgcolor: 'success.light' }}>
              <Box display="flex" alignItems="center" mb={2}>
                <EmojiEventsIcon color="success" sx={{ mr: 1, fontSize: '2rem' }} />
                <Typography variant="h5" component="h2" color="success.dark">
                  Prediction Resolved: {prediction.winningOption?.toUpperCase()} won!
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Resolved on {new Date(prediction.resolution?.timestamp || '').toLocaleString()}
                </Typography>
                <Chip 
                  label="Resolved" 
                  color="success" 
                  variant="outlined" 
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>
              
              <Typography variant="body1" sx={{ mt: 2, fontStyle: 'italic' }}>
                Thank you for participating!
              </Typography>
              
              {prediction.resolution?.rewards && prediction.resolution.rewards.length > 0 && (
                <Paper elevation={0} sx={{ p: 2, mt: 2, bgcolor: 'info.light' }}>
                  <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                    <EmojiEventsIcon sx={{ mr: 1, color: 'warning.main' }} />
                    Rewards Distributed
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Winners</Typography>
                    <Typography variant="h6">{prediction.resolution.winnerCount}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Total Pool</Typography>
                    <Typography variant="h6">{prediction.resolution.totalPool} XRP</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Reward per Winner</Typography>
                    <Typography variant="h6">
                      {prediction.resolution.rewards[0]?.amount?.toFixed(6)} XRP
                    </Typography>
                  </Box>
                </Paper>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card sx={{ mb: 4, boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 'bold' }} align="center">
                Cast Your Vote
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }} align="center">
                Choose your prediction and stake your XRP
              </Typography>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '24px',
                width: '100%'
              }}>
                {prediction.options?.map((option) => (
                  <div key={option.id}>
                    <Card 
                      variant="outlined"
                      sx={{ 
                        height: '100%', 
                        display: 'flex', 
                        flexDirection: 'column',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 6,
                          borderColor: option.id === 'yes' ? 'success.main' : 'error.main'
                        }
                      }}
                      onClick={() => handleVote(option.id as Option)}
                    >
                      <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                        <Box sx={{ mb: 2, color: option.id === 'yes' ? 'success.main' : 'error.main' }}>
                          {option.id === 'yes' ? (
                            <CheckCircleIcon sx={{ fontSize: 60 }} />
                          ) : (
                            <CancelIcon sx={{ fontSize: 60 }} />
                          )}
                        </Box>
                        
                        <Typography variant="h5" gutterBottom>
                          {option.id === 'yes' ? 'Yes' : 'No'}
                        </Typography>
                        
                        <Box sx={{ width: '100%', mb: 2 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={calculatePercentage(option.votes || 0)} 
                            sx={{ 
                              height: 10, 
                              borderRadius: 5,
                              backgroundColor: 'grey.200',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: option.id === 'yes' ? 'success.main' : 'error.main'
                              }
                            }}
                          />
                          <Box display="flex" justifyContent="space-between" mt={1}>
                            <Typography variant="body2" color="text.secondary">
                              {calculatePercentage(option.votes || 0)}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {option.votes || 0} votes
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {option.amount || 0} XRP staked
                        </Typography>
                      </CardContent>
                      <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                        <Button 
                          variant="contained" 
                          size="medium"
                          color={option.id === 'yes' ? 'success' : 'error'}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(option.id as Option);
                          }}
                        >
                          Vote {option.id === 'yes' ? 'Yes' : 'No'}
                        </Button>
                      </CardActions>
                    </Card>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card sx={{ boxShadow: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box display="flex" alignItems="center">
                <HowToVoteIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" component="div">
                  Total votes: <Chip label={prediction.totalVotes || 0} color="primary" sx={{ ml: 1 }} />
                </Typography>
              </Box>
              <Box display="flex" alignItems="center">
                <AccountBalanceWalletIcon sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="h6" component="div">
                  Total staked: <Chip label={`${prediction.totalAmount || 0} XRP`} color="secondary" sx={{ ml: 1 }} />
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
      </Container>
    </Box>
  );
}