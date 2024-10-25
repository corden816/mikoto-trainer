let audioContext;
let analyser;
let mediaStreamSource;
let speechConfig;
let audioConfig;
let recognizer;
let isRecording = false;
let currentAudio = null;
let currentSample = 1;

// 샘플 텍스트
const sampleTexts = {
    1: "Sample text 1",
    2: "Sample text 2",
    3: "Sample text 3",
    4: "Sample text 4",
    5: "Sample text 5"
};

// Initialize audio context
// Initialize audio context on first interaction
async function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    analyser = audioContext.createAnalyser();
}

// Mobile-friendly event listeners for buttons
document.addEventListener('DOMContentLoaded', () => {
    const startRecordingButton = document.getElementById('startRecording');
    const playNativeButton = document.getElementById('playNative');

    // Add touchstart event for mobile compatibility
    startRecordingButton.addEventListener('click', startRecording);
    startRecordingButton.addEventListener('touchstart', startRecording);

    playNativeButton.addEventListener('click', playNativeSpeaker);
    playNativeButton.addEventListener('touchstart', playNativeSpeaker);
});

// Check if getUserMedia is available
async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('status').textContent = 'Microphone access not supported on this device';
        return;
    }

    try {
        await initAudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        updateVolumeIndicator(stream); // Volume indicator
        
        const referenceText = document.querySelector('.practice-text').textContent;

        const pronunciationAssessmentConfig = new SpeechSDK.PronunciationAssessmentConfig(
            referenceText,
            SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
            SpeechSDK.PronunciationAssessmentGranularity.Word,
            true
        );

        audioConfig = SpeechSDK.AudioConfig.fromStreamInput(stream);
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
        pronunciationAssessmentConfig.applyTo(recognizer);

        isRecording = true;
        startRecordingButton.disabled = true;
        document.getElementById('status').textContent = 'Recording... Speak now!';

        recognizer.startContinuousRecognitionAsync();
        
        setTimeout(stopRecording, 30000); // 30초 후 자동 종료
    } catch (error) {
        console.error('Error starting recording:', error);
        document.getElementById('status').textContent = 'Error accessing microphone on mobile';
    }
}


    currentAudio.onended = () => {
        document.getElementById('status').textContent = 'Audio finished';
        document.getElementById('playNative').disabled = false;
    };

    currentAudio.onerror = () => {
        console.error('Audio loading error');
        document.getElementById('status').textContent = 'Error loading audio';
        document.getElementById('playNative').disabled = false;
    };

    currentAudio.load();
}

// Start recording
async function startRecording() {
    if (!audioContext) {
        await initAudioContext();
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        updateVolumeIndicator(stream); // Volume indicator to show real-time changes

        const referenceText = document.querySelector('.practice-text').textContent;
        
        const pronunciationAssessmentConfig = new SpeechSDK.PronunciationAssessmentConfig(
            referenceText,
            SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
            SpeechSDK.PronunciationAssessmentGranularity.Word,
            true
        );

        audioConfig = SpeechSDK.AudioConfig.fromStreamInput(stream);
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
        pronunciationAssessmentConfig.applyTo(recognizer);

        isRecording = true;
        document.getElementById('startRecording').disabled = true;
        document.getElementById('status').textContent = 'Recording... Speak now!';

        recognizer.recognizing = (s, e) => {
            document.getElementById('status').textContent = `Recognizing: ${e.result.text}`;
            
            // Adjust volume bar color based on recognition confidence level
            const confidenceLevel = e.result.confidence;
            const volumeBar = document.getElementById('volumeBar');
            if (confidenceLevel > 0.75) {
                volumeBar.style.backgroundColor = '#28a745'; // Green for high confidence
            } else if (confidenceLevel > 0.5) {
                volumeBar.style.backgroundColor = '#ffc107'; // Yellow for moderate confidence
            } else {
                volumeBar.style.backgroundColor = '#dc3545'; // Red for low confidence
            }
        };

        recognizer.recognized = (s, e) => {
            if (e.result.text) {
                const pronunciationResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
                analyzePronunciation(pronunciationResult);
            }
        };

        recognizer.startContinuousRecognitionAsync();
        
        // Set recording timeout to 30 seconds
        setTimeout(stopRecording, 30000);
    } catch (error) {
        console.error('Error starting recording:', error);
        document.getElementById('status').textContent = 'Error accessing microphone';
    }
}

// Stop recording
function stopRecording() {
    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync();
        isRecording = false;
        document.getElementById('startRecording').disabled = false;
        document.getElementById('status').textContent = 'Recording stopped';

        // Reset the volume bar color to its original state
        document.getElementById('volumeBar').style.backgroundColor = '#4CAF50';

        if (mediaStreamSource) {
            mediaStreamSource.disconnect();
        }
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded');
    
    try {
        await waitForSDK();
        initSpeechSDK();

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
