import { Router } from 'express';

export const webhookRouter = Router();

/**
 * POST /api/webhooks/envio - Webhook for Envio indexer events
 */
webhookRouter.post('/envio', async (req, res) => {
  try {
    const event = req.body;
    
    console.log('📊 Envio event received:', event);
    
    // Process blockchain events from Envio indexer
    // This could be new trades, position updates, etc.
    
    res.json({ success: true, message: 'Event processed' });
  } catch (error) {
    console.error('Error processing Envio webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * POST /api/webhooks/avail - Webhook for Avail DA proofs
 */
webhookRouter.post('/avail', async (req, res) => {
  try {
    const proof = req.body;
    
    console.log('📜 Avail proof received:', proof);
    
    // Verify and store data availability proofs
    
    res.json({ success: true, message: 'Proof verified' });
  } catch (error) {
    console.error('Error processing Avail webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * POST /api/webhooks/paypal - Webhook for PayPal USD settlements
 */
webhookRouter.post('/paypal', async (req, res) => {
  try {
    const payment = req.body;
    
    console.log('💵 PayPal payment received:', payment);
    
    // Handle PayPal USD payment notifications
    
    res.json({ success: true, message: 'Payment processed' });
  } catch (error) {
    console.error('Error processing PayPal webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});
