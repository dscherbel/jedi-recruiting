import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables.
const {
    OPENAI_API_KEY,
    INTERVIEWEE_NAME,
    ENDORSER_NAME_1,
    ENDORSER_NAME_2,
    ENDORSER_NAME_3
} = process.env;

if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Constants
const SYSTEM_MESSAGE = `You are a recruiter for the Jedi Order, searching the galaxy for the next great Jedi. Your mission is to ask carefully crafted questions to potential Padawans to determine their worthiness to join the Order. Deeply attuned to the Force, you embody both its wisdom and its mysteries. Your tone should harmonize wisdom with playfulness and charm, prioritizing a thoughtful and balanced approach to the interview.
Below is a carefully crafted list of questions to guide the interview. Pose each question exactly as it is written to ensure clarity and consistency. There are two groups of questions: one for ${INTERVIEWEE_NAME} and another for ${INTERVIEWEE_NAME}’s family.

When interviewing ${INTERVIEWEE_NAME} and his family:
1. Ask each question listed below.
2. Ensure all interviewees answer each question fully before moving on.
3. Keep interviewees focused and avoid answering the questions for them.

When you have finished interviewing ${INTERVIEWEE_NAME} and his family:
1. Thank everyone for their invaluable responses.
2. Tell ${INTERVIEWEE_NAME} that you will now decide whether he qualifies to join the Order.

When making your final decision:
1. Attune yourself to the Force and judge whether ${INTERVIEWEE_NAME}’s answers lean toward the light side or the dark side of the Force. Light-side answers demonstrate compassion, humility, and selflessness, while dark-side answers reflect selfishness, ambition, or anger.
2. Based on your assessment, provide ${INTERVIEWEE_NAME} with a reasoned explanation for why he was or was not accepted into the Jedi Order.
3. If he is accepted, inform ${INTERVIEWEE_NAME} that you will be in touch and that you have sent him a gift that will help him prepare for his future training. If he is not accepted, lecture him about the fear that you sense in him and tell him that the Order has sent him a gift in hopes that he will reconsider his ways.

Closing the interview:
Conclude the interview by thanking ${INTERVIEWEE_NAME} for contacting the Jedi Order and in a loud, commanding voice say “may the force be with you, but if not, may your waffles never be soggy”.

Questions for ${INTERVIEWEE_NAME}:
1. "${INTERVIEWEE_NAME}, why do you want to become a Jedi?"
2. "Do you think you’d look good in robes, or are you just in it for the Force powers and lightsaber duels?"
3. "Suppose you are in the middle of a strategy meeting with the Jedi Council and Admiral Ackbar keeps shouting, ‘It’s a trap!’, even when it’s not. How do you respectfully ask him to tone it down?"
4. "Imagine Emperor Palpatine tries to turn you to the dark side for like the 50th time. How would you navigate this situation and let him down gently?"
5. "You’re tasked with convincing Darth Vader to switch to a more breathable helmet design. How do you pitch it to him without getting Force-choked?"

Questions for ${INTERVIEWEE_NAME}’s family:
1. "Thank you for answering these very important questions, ${INTERVIEWEE_NAME}. I would now like to speak with your family before I decide whether or not you qualify to become a Jedi. ${ENDORSER_NAME_1}, ${ENDORSER_NAME_2}, and ${ENDORSER_NAME_3}, please come closer to the phone, I would like to speak with each of you. ${ENDORSER_NAME_1}, as a former Jedi, what do you consider ${INTERVIEWEE_NAME}’s greatest qualities to be and how do you think those qualities will best serve the Jedi Order?"
2. "${ENDORSER_NAME_2}, before you respond, you should know that we are fully aware of your obsession with Jar Jar Binks but have chosen to overlook this matter for the time being and politely request that you channel your enthusiasm for Jar Jar in another direction. Now to the question. What accomplishments or actions of ${INTERVIEWEE_NAME} are you most proud of, and how will they help him become a better Jedi?"
3. "${ENDORSER_NAME_3}, as a person who looks up to ${INTERVIEWEE_NAME} both literally and figuratively, what do you admire most about ${INTERVIEWEE_NAME}?"
`;
const VOICE = 'verse'; // verse, coral, sage
const PORT = process.env.PORT || 5050; // Allow dynamic port assignment

// List of Event Types to log to the console. See the OpenAI Realtime API Documentation: https://platform.openai.com/docs/api-reference/realtime
// "input_audio_buffer.speech_started" - when user starts speaking
// "input_audio_buffer.speech_stopped" - when user stops speaking
// "input_audio_buffer.committed" - commits user input audio buffer, which will create a new user message item in the conversation
const LOG_EVENT_TYPES = [
    'error',
    'response.content.done',
    'rate_limits.updated',
    'response.done',
    'input_audio_buffer.committed',
    'input_audio_buffer.speech_stopped',
    'input_audio_buffer.speech_started',
    'session.created'
];

// Show AI response elapsed timing calculations
const SHOW_TIMING_MATH = false;

// Root Route
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// Route for Twilio to handle incoming calls
// <Say> punctuation to improve text-to-speech translation
fastify.all('/incoming-call', async (request, reply) => {
    
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say voice="Google.en-US-Standard-G">Thank you for calling the Jedi Order. Please wait while we connect you with one of our representatives. For the best experience, we request that you put your phone on speaker so that you and your family can all participate.</Say>
                              <Pause length="1"/>
                              <Say voice="Google.en-US-Standard-G">Our representatives are currently assisting other Jedi WANNABES, across the galaxy. Please remain on the line, your transmission will be answered in the order it was received.</Say>
                              <Pause length="1"/>
                              <Say voice="Google.en-US-Standard-G">This call is powered by the Force. Did you know that the Force is an energy field that connects all living things? It surrounds us, penetrates us, and binds the galaxy together and has been at the core of Jedi philosophy for millennia.</Say>
                              <Pause length="1"/>
                              <Say voice="Google.en-US-Standard-G">Remember, the Force should be used for good and not for personal gain or selfish purposes. Please do not use the Force to microwave your leftovers, change traffic lights, convince your roommate to do the dishes, or force-lift your laundry into the hamper. Laziness is the path to the dark side. Laziness leads to putting off grocery shopping, putting off grocery shopping leads to an empty fridge, and an empty fridge leads to surviving solely on ramen for a week!</Say>
                              <Pause length="1"/>
                              <Say voice="Google.en-US-Standard-G">Thank you for your patience. Your call is being connected.</Say>
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;

    reply.type('text/xml').send(twimlResponse);
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        console.log('Client connected');

        // Connection-specific state
        let streamSid = null;
        let latestMediaTimestamp = 0;
        let lastAssistantItem = null;
        let markQueue = [];
        let responseStartTimestampTwilio = null;

        const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "OpenAI-Beta": "realtime=v1"
            }
        });

        // Control initial session with OpenAI
        const initializeSession = () => {
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    turn_detection: {
                        type: 'server_vad',
                        // Activation threshold for VAD (0.0 to 1.0), this defaults to 0.5. 
                        // A higher threshold will require louder audio to activate the model,
                        // and thus might perform better in noisy environments.
                        threshold: 0.5,
                        // Minimum duration of speech (in milliseconds) required to start a new speech chunk.
                        // This helps prevent very short sounds from triggering speech detection.
                        prefix_padding_ms: 500,
                        // Minimum duration of silence (in milliseconds) at the end of speech before ending the speech segment.
                        // This ensures brief pauses do not prematurely end a speech segment.
                        silence_duration_ms: 1000
                    },
                    input_audio_format: 'g711_ulaw',
                    output_audio_format: 'g711_ulaw',
                    voice: VOICE,
                    instructions: SYSTEM_MESSAGE,
                    modalities: ["text", "audio"],
                    temperature: 0.8,
                }
            };

            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));

            // Greet the user
            sendInitialConversationItem();
        };

        // Send initial conversation item
        const sendInitialConversationItem = () => {
            const initialConversationItem = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: `Greet the user with "Greetings ${INTERVIEWEE_NAME}!... Wow!... Unbelievable!... They told me the force was strong with you, but I didn't realize it would be this strong!! Hey Earl... come on over here! You gotta feel this! ${INTERVIEWEE_NAME} is really strong in the force!!!! So, ${INTERVIEWEE_NAME}, I take it you got our letter. You should know that Master Luke thinks very highly of you. He believes that you have the potential to play a vital role in the restoration of the Jedi Order. Are you ready to join the Jedi Order?"`
                        }
                    ]
                }
            };

            if (SHOW_TIMING_MATH) console.log('Sending initial conversation item:', JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify({ type: 'response.create' }));
        };

        // Handle interruption when the caller's speech starts
        const handleSpeechStartedEvent = () => {
            if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
                const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
                if (SHOW_TIMING_MATH) console.log(`Calculating elapsed time for truncation: ${latestMediaTimestamp} - ${responseStartTimestampTwilio} = ${elapsedTime}ms`);

                if (lastAssistantItem) {
                    const truncateEvent = {
                        type: 'conversation.item.truncate',
                        item_id: lastAssistantItem,
                        content_index: 0,
                        audio_end_ms: elapsedTime
                    };
                    if (SHOW_TIMING_MATH) console.log('Sending truncation event:', JSON.stringify(truncateEvent));
                    openAiWs.send(JSON.stringify(truncateEvent));
                }

                connection.send(JSON.stringify({
                    event: 'clear',
                    streamSid: streamSid
                }));

                // Reset
                markQueue = [];
                lastAssistantItem = null;
                responseStartTimestampTwilio = null;
            }
        };

        // Send mark messages to Media Streams so we know if and when AI response playback is finished
        const sendMark = (connection, streamSid) => {
            if (streamSid) {
                const markEvent = {
                    event: 'mark',
                    streamSid: streamSid,
                    mark: { name: 'responsePart' }
                };
                connection.send(JSON.stringify(markEvent));
                markQueue.push('responsePart');
            }
        };

        // You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.
        const handleResponseError = (error) => {
            console.log(`Response Error: `, error);

            // Use regular expression to match the time (a floating-point number followed by 's')
            const regex = /Please try again in (\d+\.\d+)s/;

            // Extract the match
            const match = error.message.match(regex);

            if (match) {
                const time = match[1];  // The first capturing group will contain the time
                console.log(`Time to wait: ${time} seconds`);
            }
        };

        // Open event for OpenAI WebSocket
        openAiWs.on('open', () => {
            console.log('Connected to the OpenAI Realtime API');
            setTimeout(initializeSession, 100);
        });

        // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
        openAiWs.on('message', (data) => {
            try {
                const event = JSON.parse(data);

                // Handle response failures due to limits being reached event
                if (event.response && event.response.status === 'failed') {
                    handleResponseError(event.response.status_details.error);
                }

                if (LOG_EVENT_TYPES.includes(event.type)) {
                    console.log(`Received event: ${event.type}`, event);
                }

                if (event.type === 'response.audio.delta' && event.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: Buffer.from(event.delta, 'base64').toString('base64') }
                    };
                    connection.send(JSON.stringify(audioDelta));

                    // First delta from a new response starts the elapsed time counter
                    if (!responseStartTimestampTwilio) {
                        responseStartTimestampTwilio = latestMediaTimestamp;
                        if (SHOW_TIMING_MATH) console.log(`Setting start timestamp for new response: ${responseStartTimestampTwilio}ms`);
                    }

                    if (event.item_id) {
                        lastAssistantItem = event.item_id;
                    }
                    
                    sendMark(connection, streamSid);
                }

                if (event.type === 'input_audio_buffer.speech_started') {
                    handleSpeechStartedEvent();
                }
            } catch (error) {
                console.error('Error processing OpenAI message:', error, 'Raw message:', data);
            }
        });

        // Handle incoming messages from Twilio
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case 'media':
                        // Only send client audio input when the response has finished playback
                        if (!markQueue.length) {
                            // Send client audio input received from the phone to openai
                            latestMediaTimestamp = data.media.timestamp;
                            if (SHOW_TIMING_MATH) console.log(`Received media message with timestamp: ${latestMediaTimestamp}ms`);
                            if (openAiWs.readyState === WebSocket.OPEN) {
                                const audioAppend = {
                                    type: 'input_audio_buffer.append',
                                    audio: data.media.payload
                                };
                                openAiWs.send(JSON.stringify(audioAppend));
                            }
                        }
                        break;
                    case 'start':
                        streamSid = data.start.streamSid;
                        console.log('Incoming stream has started', streamSid);

                        // Reset start and media timestamp on a new stream
                        responseStartTimestampTwilio = null; 
                        latestMediaTimestamp = 0;
                        break;
                    case 'mark':
                        if (markQueue.length > 0) {
                            markQueue.shift();
                        }
                        break;
                    default:
                        console.log('Received non-media event:', data.event);
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error, 'Message:', message);
            }
        });

        // Handle connection close
        connection.on('close', () => {
            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
            console.log('Client disconnected.');
        });

        // Handle WebSocket close and errors
        openAiWs.on('close', () => {
            console.log('Disconnected from the OpenAI Realtime API');
        });

        openAiWs.on('error', (error) => {
            console.error('Error in the OpenAI WebSocket:', error);
        });
    });
});

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server is listening on port ${PORT}`);
});
