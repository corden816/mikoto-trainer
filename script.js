// Global variables
let audioContext;
let analyser;
let mediaStreamSource;
let speechConfig;
let audioConfig;
let recognizer;
let isRecording = false;
let currentAudio = null;
let currentSample = 1;

// Sample texts
const sampleTexts = {
    1: "Sample text 1",
    2: "Sample text 2",
    3: "Sample text 3",
    4: "Sample text 4",
    5: "Sample text 5"
};

// Initialize Azure Speech SDK
function initSpeechSDK() {
    if (window.SpeechSDK) {
        console.log("Speech SDK is available");
        speechConfig = SpeechSDK.SpeechConfig.fromSubscription(window.config.apiKey, window.config.region);
        speechConfig.speechRecognitionLanguage = "en-US";
        console.log('Speech SDK initialized successfully');
    } else {
        console.error('Speech SDK not found');
    }
}

// Wait until the Speech SDK is loaded
function waitForSDK() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.SpeechSDK) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// Initialize audio context
async function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    analyser = audioContext.createAnalyser();
}

// Play native speaker audio
function playNativeSpeaker() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    const statusElement = document.getElementById('status');
    const playButton = document.getElementById('playNative');
    
    statusElement.textContent = 'Loading audio...';
    playButton.disabled = true;

    // Create new Audio object with mobile optimizations
    currentAudio = new Audio();
    currentAudio.preload = 'auto';  // Ensure audio preloading
    
    // Add event listeners before setting src
    currentAudio.addEventListener('loadeddata', () => {
        console.log('Audio loaded successfully');
        statusElement.textContent = 'Playing audio...';
        
        // Play with user gesture handling
        const playPromise = currentAudio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('Audio playback started successfully');
            }).catch(error => {
                console.error('Playback error:', error);
                statusElement.textContent = 'Error playing audio. Tap to try again.';
                playButton.disabled = false;
                
                // For mobile browsers that require user interaction
                const resumeAudio = () => {
                    currentAudio.play().catch(e => console.error('Resume failed:', e));
                    statusElement.removeEventListener('click', resumeAudio);
                };
                statusElement.addEventListener('click', resumeAudio);
            });
        }
    });

    currentAudio.addEventListener('ended', () => {
        console.log('Audio playback completed');
        statusElement.textContent = 'Audio finished';
        playButton.disabled = false;
    });

    currentAudio.addEventListener('error', (e) => {
        console.error('Audio loading error:', e);
        statusElement.textContent = 'Error loading audio. Check your connection and try again.';
        playButton.disabled = false;
    });

    // Check if audio file exists before trying to play
    fetch(`audio/native-speaker${currentSample}.mp3?v=2`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Audio file not found');
            }
            return response.blob();
        })
        .then(blob => {
            const audioUrl = URL.createObjectURL(blob);
            currentAudio.src = audioUrl;
        })
        .catch(error => {
            console.error('Error fetching audio:', error);
            statusElement.textContent = 'Audio file not found or network error';
            playButton.disabled = false;
        });
}

// Add this function to initialize audio playback on first user interaction
function initAudioPlayback() {
    // Create and immediately play + pause a silent audio to initialize audio context
    const silentAudio = new Audio();
    silentAudio.play().then(() => {
        silentAudio.pause();
    }).catch(e => console.log('Silent audio initialization failed:', e));
    
    // Remove the event listener after first interaction
    document.removeEventListener('click', initAudioPlayback);
}

// Modify your DOMContentLoaded event listener to include audio initialization
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Checking if SpeechSDK is loaded:", window.SpeechSDK);
        await waitForSDK();
        initSpeechSDK();
        console.log("Speech SDK initialized successfully");

        const practiceText = document.querySelector('.practice-text');
        if (practiceText) {
            practiceText.textContent = sampleTexts[1];
        }

        // Add click listener for audio initialization
        document.addEventListener('click', initAudioPlayback);

        document.querySelectorAll('.sample-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sampleNumber = parseInt(e.target.dataset.sample);
                changeSample(sampleNumber);
            });
        });

        document.getElementById('playNative').addEventListener('click', playNativeSpeaker);
        document.getElementById('startRecording').addEventListener('click', startRecording);

        // Add mobile browser detection
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            console.log('Mobile browser detected, applying mobile-specific optimizations');
        }
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// Stop recording
function stopRecording() {
    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(
            () => {
                console.log('Recognition stopped');
                document.getElementById('status').textContent = 'Recording stopped';
                isRecording = false;
                document.getElementById('startRecording').disabled = false;
                
                if (audioConfig) {
                    audioConfig.close();
                }
                if (recognizer) {
                    recognizer.close();
                }
            },
            (err) => {
                console.error('Error stopping recognition:', err);
                document.getElementById('status').textContent = `Error stopping recognition: ${err}`;
            }
        );
    }
}

// Start recording
async function startRecording() {
    console.log("Attempting to start recording...");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('status').textContent = 'Microphone access not supported on this device';
        console.error("Browser does not support getUserMedia");
        return;
    }

    try {
        await initAudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone access granted");
        
        const referenceText = document.querySelector('.practice-text').textContent;
        if (!referenceText) {
            console.error("Reference text not found");
            return;
        }

        const pronunciationAssessmentConfig = new SpeechSDK.PronunciationAssessmentConfig(
            referenceText,
            SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
            SpeechSDK.PronunciationAssessmentGranularity.Word,
            true
        );

        if (!speechConfig) {
            console.error("Speech SDK configuration is missing");
            return;
        }

        audioConfig = SpeechSDK.AudioConfig.fromStreamInput(stream);
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
        pronunciationAssessmentConfig.applyTo(recognizer);

        isRecording = true;
        document.getElementById('startRecording').disabled = true;
        document.getElementById('status').textContent = 'Recording... Speak now!';

        recognizer.recognizing = (s, e) => {
            console.log(`Recognizing: ${e.result.text}`);
            document.getElementById('status').textContent = `Recognizing: ${e.result.text}`;
        };

        recognizer.recognized = (s, e) => {
            if (e.result.text) {
                const pronunciationResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
                console.log("Pronunciation Result:", pronunciationResult);
                analyzePronunciation(pronunciationResult);
            }
        };

        recognizer.startContinuousRecognitionAsync();
        setTimeout(stopRecording, 30000); // Auto-stop after 30 seconds
    } catch (error) {
        console.error('Error accessing microphone:', error);
        document.getElementById('status').textContent = `Error accessing microphone: ${error.message}`;
    }
}

// Change sample
function changeSample(sampleNumber) {
    const practiceText = document.querySelector('.practice-text');
    
    if (practiceText) {
        practiceText.textContent = sampleTexts[sampleNumber] || "Sample text not found";
    }
    
    document.querySelectorAll('.sample-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.sample) === sampleNumber);
    });
    
    currentSample = sampleNumber;
}

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Checking if SpeechSDK is loaded:", window.SpeechSDK);
        await waitForSDK();
        initSpeechSDK();
        console.log("Speech SDK initialized successfully");

        const practiceText = document.querySelector('.practice-text');
        if (practiceText) {
            practiceText.textContent = sampleTexts[1];
        }

        document.querySelectorAll('.sample-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sampleNumber = parseInt(e.target.dataset.sample);
                changeSample(sampleNumber);
            });
        });

        document.getElementById('playNative').addEventListener('click', playNativeSpeaker);
        document.getElementById('startRecording').addEventListener('click', startRecording);
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// Add analyzePronunciation function if not defined elsewhere
function analyzePronunciation(pronunciationResult) {
    if (!pronunciationResult) {
        console.error('No pronunciation result to analyze');
        return;
    }

    // Display the pronunciation score
    const scoreElement = document.getElementById('pronunciationScore');
    if (scoreElement) {
        scoreElement.textContent = `Pronunciation Score: ${pronunciationResult.pronunciationScore}`;
    }

    // Display detailed feedback
    const feedbackElement = document.getElementById('feedback');
    if (feedbackElement) {
        feedbackElement.textContent = `Accuracy: ${pronunciationResult.accuracyScore}
            Fluency: ${pronunciationResult.fluencyScore}
            Completeness: ${pronunciationResult.completenessScore}`;
    }
}
