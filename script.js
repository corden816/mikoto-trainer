// Initialize Azure Speech SDK
function initSpeechSDK() {
    if (window.SpeechSDK) {
        speechConfig = SpeechSDK.SpeechConfig.fromSubscription(window.config.apiKey, window.config.region);
        speechConfig.speechRecognitionLanguage = "en-US";
        console.log('Speech SDK initialized successfully');
    } else {
        console.error('Speech SDK not found');
    }
}

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

// Initialize audio context on first interaction
async function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    analyser = audioContext.createAnalyser();
}

// Mobile-friendly event listeners for buttons
document.addEventListener('DOMContentLoaded', () => {
    console.log("Checking if SpeechSDK is loaded:", window.SpeechSDK); // SDK 로드 확인
    const startRecordingButton = document.getElementById('startRecording');
    const playNativeButton = document.getElementById('playNative');

    startRecordingButton.addEventListener('click', startRecording);
    playNativeButton.addEventListener('click', playNativeSpeaker);
});

// Play native speaker audio
function playNativeSpeaker() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    document.getElementById('status').textContent = 'Loading audio...';
    document.getElementById('playNative').disabled = true;

    currentAudio = new Audio(`audio/native-speaker${currentSample}.mp3`);
    
    currentAudio.oncanplaythrough = () => {
        document.getElementById('status').textContent = 'Playing audio...';
        currentAudio.play().catch(error => {
            console.error('Play error:', error);
            document.getElementById('status').textContent = 'Error playing audio';
        });
    };

    currentAudio.onended = () => {
        document.getElementById('status').textContent = 'Audio finished';
        document.getElementById('playNative').disabled = false;
    };

    currentAudio.onerror = () => {
        console.error('Audio loading error');
        document.getElementById('status').textContent = 'Error loading audio';
        document.getElementById('playNative').disabled = false;
    };
}

// Start recording with microphone access check
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
        document.getElementById('startRecording').disabled = true;
        document.getElementById('status').textContent = 'Recording... Speak now!';

        recognizer.recognizing = (s, e) => {
            document.getElementById('status').textContent = `Recognizing: ${e.result.text}`;
            const confidenceLevel = e.result.confidence;
            const volumeBar = document.getElementById('volumeBar');
            volumeBar.style.backgroundColor = confidenceLevel > 0.75 ? '#28a745' :
                                               confidenceLevel > 0.5 ? '#ffc107' : '#dc3545';
        };

        recognizer.recognized = (s, e) => {
            if (e.result.text) {
                const pronunciationResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
                analyzePronunciation(pronunciationResult);
            }
        };

        recognizer.startContinuousRecognitionAsync();
        setTimeout(stopRecording, 30000); // 30초 후 자동 종료
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

        document.getElementById('volumeBar').style.backgroundColor = '#4CAF50';

        if (mediaStreamSource) {
            mediaStreamSource.disconnect();
        }
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
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
