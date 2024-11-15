// 전역 변수
const React = window.React;
const ReactDOM = window.ReactDOM;
// React, ReactDOM 선언 후에 추가
let audioContext;
let visualizerAnalyser;
let speechConfig;
let audioConfig;
let recognizer;
let isRecording = false;
let currentAudio = null;
let currentSample = 1;
let audioVisualizerContext;
let animationFrameId;
let userDataInterval;

// 스타일 적용 함수 - analyzePronunciation 함수 밖으로 이동
//function applyStylesToFeedback() {
    //const feedbackElement = document.getElementById('feedback');
    //if (feedbackElement) {
        //feedbackElement.style.whiteSpace = 'pre-wrap';
        //feedbackElement.style.fontFamily = 'monospace';
        //feedbackElement.style.padding = '15px';
        //feedbackElement.style.borderRadius = '5px';
        //feedbackElement.style.backgroundColor = '#f8f9fa';
        //feedbackElement.style.border = '1px solid #dee2e6';
    //}
//}

let pitchAnalyzer = {
    nativePitchData: [],
    userPitchData: [],
    isRecording: false,
    audioContext: null,
    nativeAnalyzer: null,
    userAnalyzer: null,

    init() {
        this.audioContext = audioContext;
        this.nativeAnalyzer = this.audioContext.createAnalyser();
        this.userAnalyzer = this.audioContext.createAnalyser();
        this.nativeAnalyzer.fftSize = 2048;
        this.userAnalyzer.fftSize = 2048;
    },

    collectPitchData(audioData, isNative = false) {
        const pitch = this.calculatePitch(audioData);

        if (pitch > 0 && !isNaN(pitch) && isFinite(pitch)) {
            if (isNative) {
                this.nativePitchData.push(pitch);
            } else {
                this.userPitchData.push(pitch);
            }
        }
    },

    calculatePitch(buffer) {
        const sampleRate = this.audioContext.sampleRate;
        let correlation = new Array(buffer.length).fill(0);

        for (let i = 0; i < buffer.length; i++) {
            for (let j = 0; j < buffer.length - i; j++) {
                correlation[i] += buffer[j] * buffer[j + i];
            }
        }

        let peak = -1;
        let maxCorrelation = 0;

        for (let i = 1; i < correlation.length; i++) {
            if (correlation[i] > maxCorrelation) {
                maxCorrelation = correlation[i];
                peak = i;
            }
        }

        if (peak <= 0) {
            return 0;
        } else {
            return sampleRate / peak;
        }
    },

    normalizePitchData(data) {
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
        const std = Math.sqrt(variance);

        if (std === 0 || isNaN(std)) {
            return data.map(() => 0);
        }

        return data.map(x => (x - mean) / std);
    },

    calculateCorrelation(array1, array2) {
        const length = Math.min(array1.length, array2.length);
        let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;

        for (let i = 0; i < length; i++) {
            sum1 += array1[i];
            sum2 += array2[i];
            sum1Sq += array1[i] ** 2;
            sum2Sq += array2[i] ** 2;
            pSum += array1[i] * array2[i];
        }

        const num = pSum - (sum1 * sum2 / length);
        const den = Math.sqrt((sum1Sq - sum1 ** 2 / length) * (sum2Sq - sum2 ** 2 / length));

        if (den === 0 || isNaN(den)) {
            return 0;
        }

        return num / den;
    },

    calculateSimilarity() {
        if (this.nativePitchData.length === 0 || this.userPitchData.length === 0) {
            console.warn('Insufficient data for similarity calculation.');
            return 0;
        }

        const normalizedNative = this.normalizePitchData(this.nativePitchData);
        const normalizedUser = this.normalizePitchData(this.userPitchData);

        let similarity = this.calculateCorrelation(normalizedNative, normalizedUser);

        console.log('Calculated Similarity:', similarity);

        return Math.max(0, similarity) * 100;
    },

    displayResults() {
        console.log('Native Pitch Data Length:', this.nativePitchData.length);
        console.log('User Pitch Data Length:', this.userPitchData.length);

        const similarity = this.calculateSimilarity();
        //const feedbackElement = document.getElementById('feedback');

        //if (feedbackElement) {
            //let currentFeedback = feedbackElement.textContent;
            //feedbackElement.textContent = currentFeedback + `\n\n억양 유사도: ${similarity.toFixed(1)}%\n`;

            //if (similarity >= 80) {
                //feedbackElement.textContent += "훌륭합니다! 원어민과 매우 비슷한 억양입니다.";
            //} else if (similarity >= 60) {
                //feedbackElement.textContent += "좋습니다. 억양이 꽤 자연스럽습니다.";
            //} else {
                //feedbackElement.textContent += "원어민 음성을 다시 들어보고 억양에 더 신경써보세요.";
            //}
        //}
    },

    reset() {
        this.nativePitchData = [];
        this.userPitchData = [];
    }
};

// 샘플 텍스트
const sampleTexts = {
    "1": "Here's everything you need to know about the new McDonald's app. It's all the things you love about McDonald's at your fingertips.",
    
    "2": `Good morning! How are you!

Good. How are you?

I'm good.

There you go.

To toronto?

Yeah, Thank you.

Do you have any bags? You're checking in?

No, just my backpack.

Okay, All right. You're all set.

Perfect.

And you're flying out of E86

Thank you so much.

You're welcome.

Have a good one!`,
    
    "3": `Whenever you walk along the street of small town of Sasebo, Japan, you will notice the long waiting line in front of the hamburger house. And looking around, you will find so many more hamburger places along the street. Then you might be thinking, why hamburger is so popular here? It's even a Japan.

The hidden story of Sasebo hamburger is back to 1940's. During the World War 2, Sasebo was IJN's one of the biggest naval base. Several shipyards and factories for supply were located there. But after the war, the entire facilities were under controll of US navy, and Sasebo city becomes essential supply base for US navy pacific fleet. During the Korean War, more than 20,000 troops were sent to the base for operation.`
};

// Azure Speech SDK 초기화
function initSpeechSDK() {
    if (window.SpeechSDK) {
        console.log("Speech SDK is available");
        try {
            speechConfig = SpeechSDK.SpeechConfig.fromSubscription(window.config.apiKey, window.config.region);
            
            // 중요: 이 설정들이 제대로 적용되어야 합니다
            speechConfig.speechRecognitionLanguage = "en-US";
            speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
            
            console.log('Speech SDK initialized successfully with settings:', {
                language: speechConfig.speechRecognitionLanguage,
                outputFormat: speechConfig.outputFormat
            });
        } catch (error) {
            console.error('Error initializing Speech SDK:', error);
        }
    } else {
        console.error('Speech SDK not found');
    }
}

// SDK 로딩 대기
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

// AudioContext 초기화
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        pitchAnalyzer.init();
        initAudioVisualizer();
    }
}

// 오디오 시각화 초기화
function initAudioVisualizer() {
    const canvas = document.getElementById('audioVisualizer');
    audioVisualizerContext = canvas.getContext('2d');
    visualizerAnalyser = audioContext.createAnalyser();
    visualizerAnalyser.fftSize = 2048;
}

// 오디오 시각화 함수
function visualizeAudio(stream) {
    if (!audioContext) {
        initAudioContext();
    }
    const canvas = document.getElementById('audioVisualizer');
    const audioSource = audioContext.createMediaStreamSource(stream);
    audioSource.connect(visualizerAnalyser);

    const bufferLength = visualizerAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        animationFrameId = requestAnimationFrame(draw);
        visualizerAnalyser.getByteTimeDomainData(dataArray);

        audioVisualizerContext.fillStyle = 'rgb(200, 200, 200)';
        audioVisualizerContext.fillRect(0, 0, canvas.width, canvas.height);
        audioVisualizerContext.lineWidth = 2;
        audioVisualizerContext.strokeStyle = 'rgb(0, 0, 0)';
        audioVisualizerContext.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;

            if (i === 0) {
                audioVisualizerContext.moveTo(x, y);
            } else {
                audioVisualizerContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        audioVisualizerContext.lineTo(canvas.width, canvas.height / 2);
        audioVisualizerContext.stroke();
    }

    draw();
}

// 네이티브 스피커 오디오 재생
async function playNativeSpeaker() {
    initAudioContext();
    const statusElement = document.getElementById('status');
    const playButton = document.getElementById('playNative');

    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    statusElement.textContent = 'Loading audio...';
    playButton.disabled = true;

    if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    const audioPath = `audio/native-speaker${currentSample}.mp3`;

    try {
        const audioElement = new Audio(audioPath);
        const source = audioContext.createMediaElementSource(audioElement);

        source.connect(pitchAnalyzer.nativeAnalyzer);
        source.connect(visualizerAnalyser);

        pitchAnalyzer.nativeAnalyzer.connect(audioContext.destination);

        audioElement.oncanplaythrough = () => {
            audioElement.play();
            const bufferLength = pitchAnalyzer.nativeAnalyzer.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);

            const dataCollectionInterval = setInterval(() => {
                pitchAnalyzer.nativeAnalyzer.getFloatTimeDomainData(dataArray);
                pitchAnalyzer.collectPitchData(dataArray, true);
            }, 100);

            audioElement.onended = () => {
                clearInterval(dataCollectionInterval);
                statusElement.textContent = 'Audio finished';
                playButton.disabled = false;
            };

            statusElement.textContent = 'Playing audio...';
            currentAudio = audioElement;
        };

        audioElement.load();

    } catch (error) {
        console.error('Audio playback error:', error);
        statusElement.textContent = 'Error loading audio';
        playButton.disabled = false;
    }
}

// 녹음 시작
// 녹음 시작
async function startRecording() {
    console.log("Attempting to start recording...");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('status').textContent = 'Microphone access not supported on this device';
        console.error("Browser does not support getUserMedia");
        return;
    }

    try {
        // Speech SDK 설정 확인 및 초기화
        if (!speechConfig) {
            speechConfig = SpeechSDK.SpeechConfig.fromSubscription(window.config.apiKey, window.config.region);
            speechConfig.speechRecognitionLanguage = "en-US";
            speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
        }

        // AudioContext 초기화
        initAudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone access granted");

        // 오디오 시각화 및 pitch 분석 설정
        visualizeAudio(stream);
        const audioSource = audioContext.createMediaStreamSource(stream);
        audioSource.connect(pitchAnalyzer.userAnalyzer);
        audioSource.connect(visualizerAnalyser);

        // Pitch 데이터 수집 설정
        const dataArray = new Float32Array(pitchAnalyzer.userAnalyzer.frequencyBinCount);
        function collectUserData() {
            pitchAnalyzer.userAnalyzer.getFloatTimeDomainData(dataArray);
            pitchAnalyzer.collectPitchData(dataArray, false);
        }
        userDataInterval = setInterval(collectUserData, 100);

        // 발음 평가 설정
        const referenceText = document.querySelector('.practice-text').textContent;
        console.log("Reference text:", referenceText); // 디버깅용

        if (!referenceText) {
            console.error("Reference text not found");
            return;
        }

        // 새로운 발음 평가 설정 생성 방식
        const pronunciationAssessmentConfig = new SpeechSDK.PronunciationAssessmentConfig(
            referenceText,
            SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
            SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
            true // Enable mispronunciation calculation
        );

        // 추가 설정
pronunciationAssessmentConfig.enableProsodyAssessment = true;
pronunciationAssessmentConfig.enableDetailedResultOutput = true;

// JSON 형식 설정
speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;

// 발음 평가 구성을 recognizer에 적용하기 전에 추가 설정
speechConfig.setProperty("pronunciation.phonemeAlphabet", "IPA");

        // 오디오 설정 및 recognizer 생성
        audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

        // 발음 평가 구성 적용
        pronunciationAssessmentConfig.applyTo(recognizer);

        // 이벤트 핸들러
        // `startRecording` 함수 내에서 수정
recognizer.recognized = (s, e) => {
    if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        console.log("Recognition result:", e.result);
        try {
            const pronunciationResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
            console.log("Pronunciation assessment result:", pronunciationResult);

            // 인식된 텍스트를 `pronunciationResult` 객체에 추가
            pronunciationResult.recognizedText = e.result.text;

            // JSON 결과 가져오기
            const jsonResult = e.result.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult);

            pronunciationResult.privJson = jsonResult;

            analyzePronunciation(pronunciationResult);
        } catch (error) {
            console.error("Error processing recognition result:", error);
        }
    } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
        console.log("No speech could be recognized.");
    }
};


        // UI 상태 업데이트
        isRecording = true;
        document.getElementById('startRecording').disabled = true;
        document.getElementById('stopRecording').disabled = false;
        document.getElementById('status').textContent = '녹음 중...지금 말하세요!';

        // 녹음 시작
        recognizer.startContinuousRecognitionAsync(
            () => {
                console.log("Recognition started successfully");
            },
            (error) => {
                console.error("Error starting recognition:", error);
            }
        );

    } catch (error) {
        console.error('Error in startRecording:', error);
        document.getElementById('status').textContent = `Error: ${error.message}`;
    }
}




// 녹음 중지
function stopRecording() {
    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(
            () => {
                if (userDataInterval) {
                    clearInterval(userDataInterval);
                }
                console.log('Recognition stopped');
                document.getElementById('status').textContent = '녹음 중지됨';
                isRecording = false;
                document.getElementById('startRecording').disabled = false;
                document.getElementById('stopRecording').disabled = true;

                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }

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


// analyzePronunciation 함수를 다음과 같이 교체하세요
function analyzePronunciation(pronunciationResult) {
    console.log("Starting pronunciation analysis with:", pronunciationResult);

    if (!pronunciationResult) {
        console.error('No pronunciation result to analyze');
        return;
    }

    

    try {
        

        // JSON 파싱 시도
        if (pronunciationResult.privJson) {
            const assessmentJson = JSON.parse(pronunciationResult.privJson);
            console.log("Detailed assessment JSON:", {
                full: assessmentJson,
                words: assessmentJson.NBest?.[0]?.Words,
                wordDetails: assessmentJson.NBest?.[0]?.Words?.map(word => ({
                    word: word.Word,
                    assessment: word.PronunciationAssessment,
                    phonemes: word.Phonemes
                }))
            });

            if (assessmentJson.NBest && Array.isArray(assessmentJson.NBest)) {
                const nBest = assessmentJson.NBest[0];
                const PronunciationVisualizer = () => {
    const getScoreColor = (score) => {
        if (score >= 80) return 'bg-green-500';
        if (score >= 60) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const compareWords = (referenceText, recognizedWords) => {
        // 기준 텍스트를 단어 배열로 변환하고 전처리
        const referenceWords = referenceText
            .toLowerCase()
            .split(' ')
            .map(word => word.replace(/[.,!?]$/g, ''))
            .filter(word => word.length > 0);

        // 인식된 텍스트를 단어 배열로 변환하고 전처리
        const recognizedWordsList = recognizedWords.map(wordObj => 
            wordObj.Word.toLowerCase().replace(/[.,!?]$/g, '')
        );

        // 각 단어의 출현 횟수를 카운트
        const wordCount = {};
        const recognizedCount = {};

        // 기준 텍스트의 단어 출현 횟수 계산
        referenceWords.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });

        // 인식된 텍스트의 단어 출현 횟수 계산
        recognizedWordsList.forEach(word => {
            recognizedCount[word] = (recognizedCount[word] || 0) + 1;
        });

        // 각 단어의 상태를 저장할 객체 생성
        const referenceStatus = referenceWords.map((word, index) => {
            // 해당 단어가 이전에 몇 번 나왔는지 계산
            const previousOccurrences = referenceWords
                .slice(0, index)
                .filter(w => w === word).length;
            
            // 인식된 텍스트에서 해당 단어의 출현 횟수 확인
            const recognizedOccurrences = recognizedCount[word] || 0;
            
            // 이 위치의 단어가 생략되었는지 확인
            const isOmitted = previousOccurrences >= recognizedOccurrences;

            return {
                word,
                isOmitted
            };
        });

        const recognizedStatus = recognizedWords.map(wordObj => {
            const normalizedWord = wordObj.Word.toLowerCase().replace(/[.,!?]$/g, '');
            const isAdded = !wordCount[normalizedWord] || 
                           recognizedCount[normalizedWord] > wordCount[normalizedWord];

            return {
                ...wordObj,
                isAdded
            };
        });

        // 완결성 점수 계산
        const totalWords = referenceWords.length;
        const omittedWords = referenceStatus.filter(w => w.isOmitted).length;
        const completenessScore = Math.max(0, Math.min(100, ((totalWords - omittedWords) / totalWords) * 100));

        return { 
            referenceStatus, 
            recognizedStatus, 
            calculatedCompleteness: completenessScore 
        };
    };

    // 기준 텍스트와 인식된 단어 목록 가져오기
    const referenceText = document.querySelector('.practice-text')?.textContent || '';
    const { referenceStatus, recognizedStatus, calculatedCompleteness } = compareWords(
        referenceText,
        nBest.Words
    );

    // Azure의 완결성 점수와 계산된 완결성 점수 중 더 낮은 값 사용
    const azureCompleteness = pronunciationResult.completenessScore;
    const finalCompleteness = Math.min(calculatedCompleteness, azureCompleteness);

    console.log('Completeness Scores:', {
        calculated: calculatedCompleteness,
        azure: azureCompleteness,
        final: finalCompleteness
    });

    return React.createElement('div', {
                        className: 'w-full max-w-4xl mx-auto p-6 bg-white rounded-lg'
                    }, [
        // 1. 전체 점수 섹션
        React.createElement('div', { className: 'mb-8' }, [
            React.createElement('h2', { className: 'text-xl font-bold mb-4' }, '전체 평가'),
            React.createElement('div', { className: 'grid grid-cols-2 gap-4' },
                [
                    { label: '발음', score: pronunciationResult.pronunciationScore },
                    { label: '정확성', score: pronunciationResult.accuracyScore },
                    { label: '유창성', score: pronunciationResult.fluencyScore },
                    { 
                        label: '완결성', 
                        score: finalCompleteness,
                        detail: `(생략된 단어: ${referenceStatus.filter(w => w.isOmitted).length}개)`
                    }
                ].map(({ label, score, detail }, index) =>
                    React.createElement('div', { key: index, className: 'bg-gray-50 p-4 rounded-lg' }, [
                        React.createElement('div', { className: 'text-sm text-gray-600' }, label),
                        React.createElement('div', { className: 'text-2xl font-bold text-gray-800' }, score.toFixed(1)),
                        detail && React.createElement('div', { className: 'text-sm text-gray-500 mt-1' }, detail),
                        React.createElement('div', { className: 'w-full bg-gray-200 rounded-full h-2 mt-2' },
                            React.createElement('div', {
                                className: `${getScoreColor(score)} rounded-full h-2`,
                                style: { width: `${score}%` }
                            })
                        )
                    ])
                )
            )
        ]),

        // 2. 텍스트 비교 분석 섹션
        React.createElement('div', { className: 'mb-8 p-4 bg-gray-50 rounded-lg' }, [
            React.createElement('h3', { className: 'text-lg font-semibold mb-3' }, '텍스트 비교 분석'),
            React.createElement('div', { className: 'space-y-4' }, [
                React.createElement('table', { className: 'w-full border-collapse' }, [
                    React.createElement('thead', null, 
                        React.createElement('tr', null, [
                            React.createElement('th', { className: 'text-left pb-2 w-1/2 text-gray-600 text-sm font-medium' }, '예문'),
                            React.createElement('th', { className: 'text-left pb-2 w-1/2 text-gray-600 text-sm font-medium' }, '당신의 발음')
                        ])
                    ),
                    React.createElement('tbody', null, [
                        React.createElement('tr', null, [
                            React.createElement('td', { 
                                className: 'align-top pr-4 text-sm border-r border-gray-200',
                                style: { minHeight: '100px' }
                            }, 
                                referenceStatus.map((wordStatus, idx) => 
                                    React.createElement('span', {
                                        key: `ref-${idx}`,
                                        className: `inline-block mr-1 px-1 rounded ${
                                            wordStatus.isOmitted ? 'bg-red-100 text-red-800' : ''
                                        }`
                                    }, wordStatus.word)
                                )
                            ),
                            React.createElement('td', { 
                                className: 'align-top pl-4 text-sm',
                                style: { minHeight: '100px' }
                            }, 
                                recognizedStatus.map((wordStatus, idx) => 
                                    React.createElement('span', {
                                        key: `rec-${idx}`,
                                        className: `inline-block mr-1 px-1 rounded ${
                                            wordStatus.isAdded ? 'bg-yellow-100 text-yellow-800' : ''
                                        }`
                                    }, wordStatus.Word)
                                )
                            )
                        ])
                    ])
                ]),
                React.createElement('div', { className: 'flex gap-4 mt-3 text-sm' }, [
                    React.createElement('div', { className: 'flex items-center' }, [
                        React.createElement('span', { 
                            className: 'inline-block w-3 h-3 mr-2 bg-red-100 border border-red-200 rounded'
                        }),
                        React.createElement('span', { className: 'text-gray-600' }, '생략된 단어')
                    ]),
                    React.createElement('div', { className: 'flex items-center' }, [
                        React.createElement('span', { 
                            className: 'inline-block w-3 h-3 mr-2 bg-yellow-100 border border-yellow-200 rounded'
                        }),
                        React.createElement('span', { className: 'text-gray-600' }, '추가된 단어')
                    ])
                ])
            ])
        ]),

        // 3. 단어별 분석 섹션
        React.createElement('div', { className: 'mt-8' }, [
            React.createElement('h2', { className: 'text-xl font-bold mb-4' }, '단어별 분석'),
            React.createElement('div', { className: 'space-y-4' },
                nBest.Words.map((word, index) => {
                    const fluencyScore = word.PronunciationAssessment?.FluencyScore || 
                                      (word.PronunciationAssessment?.AccuracyScore * 0.7 + 
                                       pronunciationResult.fluencyScore * 0.3);
                    
                    return React.createElement('div', {
                        key: index,
                        className: 'bg-gray-50 p-4 rounded-lg'
                    }, [
                        React.createElement('div', { className: 'flex justify-between items-center mb-2' }, [
                            React.createElement('span', { className: 'text-lg font-semibold' }, word.Word),
                            React.createElement('div', { className: 'flex flex-col items-end' }, [
                                React.createElement('span', { className: 'text-sm font-medium text-gray-600' },
                                    `정확도: ${(word.PronunciationAssessment?.AccuracyScore || 0).toFixed(1)}`
                                ),
                                React.createElement('span', { className: 'text-sm font-medium text-gray-600' },
                                    `유창성: ${fluencyScore.toFixed(1)}`
                                )
                            ])
                        ]),
                        React.createElement('div', { className: 'flex items-center mb-2' }, [
                            React.createElement('span', { className: 'w-24 text-sm text-gray-600' }, '정확도'),
                            React.createElement('div', { className: 'flex-1 mx-2' },
                                React.createElement('div', { className: 'w-full bg-gray-200 rounded-full h-2' },
                                    React.createElement('div', {
                                        className: `${getScoreColor(word.PronunciationAssessment?.AccuracyScore || 0)} rounded-full h-2`,
                                        style: { width: `${word.PronunciationAssessment?.AccuracyScore || 0}%` }
                                    })
                                )
                            ),
                            React.createElement('span', { className: 'w-12 text-sm text-gray-600 text-right' },
                                `${(word.PronunciationAssessment?.AccuracyScore || 0).toFixed(1)}`
                            )
                        ]),
                        React.createElement('div', { className: 'flex items-center mb-2' }, [
                            React.createElement('span', { className: 'w-24 text-sm text-gray-600' }, '유창성'),
                            React.createElement('div', { className: 'flex-1 mx-2' },
                                React.createElement('div', { className: 'w-full bg-gray-200 rounded-full h-2' },
                                    React.createElement('div', {
                                        className: `${getScoreColor(fluencyScore)} rounded-full h-2`,
                                        style: { width: `${fluencyScore}%` }
                                    })
                                )
                            ),
                            React.createElement('span', { className: 'w-12 text-sm text-gray-600 text-right' },
                                `${fluencyScore.toFixed(1)}`
                            )
                        ]),
                        (word.PronunciationAssessment?.AccuracyScore < 80) && 
                        React.createElement('div', {
                            className: 'mt-2 p-2 bg-yellow-50 rounded border border-yellow-200'
                        },
                            React.createElement('p', {
                                className: 'text-sm text-yellow-700'
                            }, [
                                React.createElement('span', {
                                    className: 'font-medium'
                                }, 'Suggestion: '),
                                word.Phonemes && word.Phonemes.length > 0 ?
                                    `Work on the pronunciation of '${
                                        word.Phonemes
                                            .filter(p => p.PronunciationAssessment && 
                                                      p.PronunciationAssessment.AccuracyScore < 80)
                                            .map(p => p.Phoneme)
                                            .join(", ")
                                    }' sound${
                                        word.Phonemes.filter(p => p.PronunciationAssessment && 
                                                              p.PronunciationAssessment.AccuracyScore < 80).length > 1 ? 's' : ''
                                    }` :
                                    '전반적인 발음 개선이 필요합니다. 표시된 음소의 발음을 좀 더 신경써보세요.'
                            ])
                        )
                    ]);
                })
            )
        ])
    ]);
};

                    // React 컴포넌트 렌더링
                const root = document.getElementById('pronunciationVisualizer');
                if (root) {
                    ReactDOM.render(React.createElement(PronunciationVisualizer), root);
                }
            }
        }
    } catch (error) {
        console.error("Error analyzing pronunciation:", error);
        console.error("Error details:", error.stack);
    }

    // pitchAnalyzer 결과 표시
    //pitchAnalyzer.displayResults();
    pitchAnalyzer.reset();
} // analyzePronunciation 함수의 끝


function changeSample(sampleNumber) {
    const practiceText = document.querySelector('.practice-text');
    if (practiceText) {
        practiceText.textContent = sampleTexts[sampleNumber] || "Sample text not found";
        practiceText.style.whiteSpace = 'pre-line';
    }

    document.querySelectorAll('.sample-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.sample) === sampleNumber);
    });

    currentSample = sampleNumber;
    pitchAnalyzer.reset();
}

// 모바일 지원 초기화
function initMobileSupport() {
    const unlockAudioContext = async () => {
        if (audioContext && audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        document.removeEventListener('touchstart', unlockAudioContext);
        document.removeEventListener('click', unlockAudioContext);
    };

    document.addEventListener('touchstart', unlockAudioContext);
    document.addEventListener('click', unlockAudioContext);
}

// 초기화 부분을 다음과 같이 수정
document.addEventListener('DOMContentLoaded', async () => {
    const loadingScreen = document.getElementById('loadingScreen');
    
    // 3초 후에 로딩 화면 제거
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 3000);

    try {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

        await waitForSDK();
        initSpeechSDK();

        if (isMobile) {
            console.log('Mobile device detected:', isiOS ? 'iOS' : 'Android');
            initMobileSupport();
        }

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
        document.getElementById('stopRecording').addEventListener('click', stopRecording);
        
        // 피드백 스타일 적용
        applyStylesToFeedback();
    } catch (error) {
        console.error('Initialization error:', error);
    }
});
