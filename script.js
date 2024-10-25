const config = {
    apiKey: "fad4e222a3854bb99ed337f837a4e21c",
    region: "koreacentral"
};

// Global variables
let audioContext;
let analyser;
let mediaStreamSource;
let speechConfig;
let audioConfig;
let recognizer;
let isRecording = false;
let currentAudio = null;  // 변수 추가
let currentSample = 1;    // 변수 추가

// Initialize audio context
async function initAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.85;
}

// Initialize Azure Speech SDK
function initSpeechSDK() {
    speechConfig = SpeechSDK.SpeechConfig.fromSubscription(config.apiKey, config.region);
    speechConfig.speechRecognitionLanguage = "en-US";
}

// Play native speaker audio - 이 함수를 완전히 수정
function playNativeSpeaker() {
    // 이전 오디오가 있다면 정지
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // 상태 업데이트
    document.getElementById('status').textContent = 'Loading audio...';
    document.getElementById('playNative').disabled = true;

    // 새 오디오 생성
    currentAudio = new Audio();
    
    // 오디오 이벤트 핸들러 설정
    currentAudio.oncanplaythrough = () => {
        document.getElementById('status').textContent = 'Playing audio...';
        currentAudio.play()
            .catch(error => {
                console.error('Play error:', error);
                document.getElementById('status').textContent = 'Error playing audio';
                document.getElementById('playNative').disabled = false;
            });
    };

    currentAudio.onended = () => {
        document.getElementById('status').textContent = 'Audio finished';
        document.getElementById('playNative').disabled = false;
    };

    currentAudio.onerror = (e) => {
        console.error('Audio loading error for:', currentAudio.src);
        document.getElementById('status').textContent = 'Error loading audio';
        document.getElementById('playNative').disabled = false;
    };

    // 수정된 오디오 소스 경로
    // GitHub Pages의 정확한 경로 사용
    currentAudio.src = `https://corden816.github.io/mikoto-trainer/native-speaker${currentSample}.mp3`;
    // 또는 상대 경로 사용
    // currentAudio.src = `native-speaker${currentSample}.mp3`;
    
    console.log('Attempting to load:', currentAudio.src); // 디버깅용
    currentAudio.load();
}

// 나머지 함수들은 그대로 유지...

// Event listeners - 이 부분 수정
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded'); // 디버깅용
    initSpeechSDK();
    
    // 초기 텍스트 설정을 명시적으로 수행
    const practiceText = document.querySelector('.practice-text');
    if (practiceText) {
        console.log('Setting initial text'); // 디버깅용
        practiceText.textContent = sampleTexts[1];
    } else {
        console.error('Practice text element not found'); // 디버깅용
    }
    
    // 버튼 이벤트 리스너 설정
    document.querySelectorAll('.sample-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            console.log('Sample button clicked:', e.target.dataset.sample); // 디버깅용
            const sampleNumber = parseInt(e.target.dataset.sample);
            currentSample = sampleNumber;
            practiceText.textContent = sampleTexts[sampleNumber];
            
            // 버튼 스타일 업데이트
            document.querySelectorAll('.sample-btn').forEach(b => {
                b.classList.remove('active');
            });
            e.target.classList.add('active');
        });
    });
    
    document.getElementById('playNative').addEventListener('click', playNativeSpeaker);
    document.getElementById('startRecording').addEventListener('click', startRecording);
});
