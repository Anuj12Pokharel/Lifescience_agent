# LifeAI - n8n Integration Guide

## Overview
LifeAI is a life science AI chat application that integrates with n8n for handling AI responses. Users can chat via text or voice input, and responses are fetched from your n8n workflow.

## Setup Instructions

### 1. Configure Environment Variables

Add the following environment variable to your Vercel project or `.env.local` file:

```bash
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/lifeai
```

Replace `https://your-n8n-instance.com/webhook/lifeai` with your actual n8n webhook URL.

### 2. Set Up n8n Workflow

Create an n8n workflow with the following structure:

#### Webhook Trigger
- Set up a **Webhook** node as the trigger
- Method: POST
- The webhook will receive JSON with the following structure:
```json
{
  "message": "user's question here",
  "conversation_id": "default"
}
```

#### Process the Message
- Add any processing nodes (OpenAI, Claude, etc.) to generate responses
- The AI response should be stored in a field called `response`

#### Webhook Response
- Return JSON response in this format:
```json
{
  "response": "Your AI-generated response here"
}
```

### 3. Example n8n Workflow

Here's a simple example using OpenAI:

1. **Webhook Node**
   - Trigger on POST requests
   - Get `message` from request body

2. **OpenAI Node**
   - Use the received message as input
   - Set system prompt for life science context
   - Example prompt: "You are an expert life science AI assistant. Help with research, drug discovery, genetics, and molecular analysis."

3. **Respond to Webhook**
   - Return the generated response as JSON

### 4. Features

#### Text Chat
- Type messages directly in the input field
- Press Enter to send or click the Send button
- Messages are displayed with timestamps

#### Voice Input
- Click the microphone button to start voice recording
- Speak your question clearly
- Voice is automatically transcribed and sent
- Requires browser with Web Speech API support

#### Real-time Updates
- Chat history is maintained during the session
- Loading indicator shows when waiting for response
- Error handling for failed requests

### 5. Customization

#### Styling
The app uses a black and blue color scheme defined in `app/globals.css`. You can customize:
- Colors in the CSS variables
- Typography and spacing
- Responsive breakpoints

#### AI Behavior
Modify the system prompt or AI model in your n8n workflow to change response behavior.

#### UI Components
- Chat messages are in `components/chat-message.tsx`
- Voice input is in `components/voice-input.tsx`
- Main chat page is in `app/page.tsx`

### 6. Testing the Integration

1. Start the development server: `npm run dev`
2. Open the app in your browser
3. Type a test message or use voice input
4. Verify the response comes from n8n
5. Check browser console for any errors

### 7. Troubleshooting

#### No Response
- Verify the `NEXT_PUBLIC_N8N_WEBHOOK_URL` is set correctly
- Check n8n webhook is active and configured properly
- Look at browser console for error messages

#### Voice Not Working
- Ensure your browser supports Web Speech API
- Check microphone permissions are granted
- Try in a different browser if issues persist

#### CORS Issues
- Make sure your n8n instance allows requests from your domain
- Configure CORS headers in n8n if needed

## Deployment

When deploying to Vercel:
1. Add `NEXT_PUBLIC_N8N_WEBHOOK_URL` to environment variables in Vercel dashboard
2. Ensure n8n workflow is active and accessible
3. Test the integration after deployment

## Architecture

```
User Input (Text/Voice)
       ↓
   Chat Interface
       ↓
   n8n Webhook
       ↓
   AI Processing (OpenAI/Claude/etc)
       ↓
   Response
       ↓
   Display in Chat
```
