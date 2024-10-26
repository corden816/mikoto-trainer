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

// Play native speaker audio
function playNativeSpeaker() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    document.getElementById('status').textContent = 'Loading audio...';
    document.getElementById('playNative').disabled = true;

    currentAudio = new Audio(`audio/native-speaker${currentSample}.mp3?v=2`);
    
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
        
        updateVolumeIndicator(stream);

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
        };

        recognizer.recognized = (s, e) => {
            if (e.result.text) {
                const pronunciationResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
                analyzePronunciation(pronunciationResult);
            }
        };

        recognizer.startContinuousRecognitionAsync();
        setTimeout(stopRecording, 30000); // Auto-stop after 30 seconds
    } catch (error) {
        console.error('Error accessing microphone:', error);
        document.getElementById('status').textContent = `Error accessing microphone: ${error.name}`;
        if (error.name === "NotAllowedError") {
            alert("Please allow microphone access to use this feature.");
        } else if (error.name === "NotFoundError") {
            alert("No microphone found. Please check your device.");
        }
    }
}

// 통합된 DOMContentLoaded 이벤트 핸들러
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Checking if SpeechSDK is loaded:", window.SpeechSDK);
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

// Sample을 변경하는 함수 정의
function changeSample(sampleNumber) {
    const practiceText = document.querySelector('.practice-text');
    const sampleTexts = {
        1: "Sample text 1",
        2: "Sample text 2",
        3: "Sample text 3",
        4: "Sample text 4",
        5: "Sample text 5"
    };
    
    if (practiceText) {
        practiceText.textContent = sampleTexts[sampleNumber] || "Sample text not found";
    }
    
    document.querySelectorAll('.sample-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.sample) === sampleNumber);
    });
    
    currentSample = sampleNumber;
}
