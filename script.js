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

    startRecordingButton.addEventListener('click', startRecording);
    playNativeButton.addEventListener('click', playNativeSpeaker);
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
            const confidenceLevel = e.result.confidence;
            const volumeBar = document.getElementById('volumeBar');
            if (confidenceLevel > 0.75) {
                volumeBar.style.backgroundColor = '#28a745';
            } else if (confidenceLevel > 0.5) {
                volumeBar.style.backgroundColor = '#ffc107';
            } else {
                volumeBar.style.backgroundColor = '#dc3545';
            }
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
        document.getElementById('status').textContent = 'Error accessing microphone on mobile';
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
