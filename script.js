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
let currentAudio = null;
let currentSample = 1;  // 기본값 설정

// 나머지 함수들은 그대로 유지...

// Play native speaker audio 함수만 수정
function playNativeSpeaker() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        currentAudio.onerror = (e) => {
        console.error('Audio error:', e);
        document.getElementById('status').textContent = `Error loading audio: ${audioUrl}`;
        document.getElementById('playNative').disabled = false;
    };
}
    }

    // GitHub Pages URL 사용
    const audioUrl = `./native-speaker${currentSample}.mp3`;
    currentAudio = new Audio(audioUrl);
    
    document.getElementById('playNative').disabled = true;
    
    currentAudio.play().catch(error => {
        console.error('Error playing audio:', error);
        document.getElementById('status').textContent = 'Error playing audio file';
        document.getElementById('playNative').disabled = false;
    });

    currentAudio.onended = () => {
        document.getElementById('playNative').disabled = false;
    };

    currentAudio.onloadstart = () => {
        document.getElementById('status').textContent = 'Loading audio...';
    };

    currentAudio.oncanplay = () => {
        document.getElementById('status').textContent = 'Playing audio...';
    };
}

// 이벤트 리스너 부분 수정
document.addEventListener('DOMContentLoaded', () => {
    initSpeechSDK();
    
    // 샘플 선택 버튼 이벤트 리스너 추가
    document.querySelectorAll('.sample-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentSample = parseInt(e.target.dataset.sample);
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
