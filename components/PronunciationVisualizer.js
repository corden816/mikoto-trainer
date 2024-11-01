// components/PronunciationVisualizer.js
// PronunciationVisualizer.js 상단
const PronunciationVisualizer = ({ assessmentData }) => {
    const [expandedWord, setExpandedWord] = React.useState(null);

    const getScoreColor = (score) => {
        if (score >= 80) return 'bg-green-500';
        if (score >= 60) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    if (!assessmentData) {
        return React.createElement("div", {
            className: "p-4 bg-yellow-100 rounded"
        }, "No pronunciation data available. Please try recording again.");
    }

    const { pronunciationScore, accuracyScore, fluencyScore, completenessScore, words = [] } = assessmentData;

    return React.createElement("div", {
        className: "w-full space-y-6"
    }, [
        // Overall Assessment Card
        React.createElement("div", {
            className: "bg-white p-6 rounded-lg shadow-sm",
            key: "overall"
        }, [
            React.createElement("h2", {
                className: "text-xl font-bold mb-4",
                key: "title"
            }, "Overall Assessment"),
            React.createElement("div", {
                className: "grid grid-cols-1 md:grid-cols-2 gap-4",
                key: "scores"
            }, [
                {
                    label: "Pronunciation",
                    score: pronunciationScore
                },
                {
                    label: "Accuracy",
                    score: accuracyScore
                },
                {
                    label: "Fluency",
                    score: fluencyScore
                },
                {
                    label: "Completeness",
                    score: completenessScore
                }
            ].map(({ label, score }, index) => (
                React.createElement("div", {
                    key: index,
                    className: "space-y-2"
                }, [
                    React.createElement("div", {
                        className: "flex justify-between"
                    }, [
                        React.createElement("span", {
                            className: "text-sm font-medium"
                        }, label),
                        React.createElement("span", {
                            className: "text-sm font-medium"
                        }, `${Number(score).toFixed(1)}%`)
                    ]),
                    React.createElement("div", {
                        className: "w-full bg-gray-200 rounded-full h-2"
                    }, React.createElement("div", {
                        className: `${getScoreColor(score)} rounded-full h-2 transition-all`,
                        style: {
                            width: `${score}%`
                        }
                    }))
                ])
            )))
        ]),

        // Word Analysis Card
        React.createElement("div", {
            className: "bg-white p-6 rounded-lg shadow-sm",
            key: "words"
        }, [
            React.createElement("h2", {
                className: "text-xl font-bold mb-4"
            }, "Word-by-Word Analysis"),
            React.createElement("div", {
                className: "space-y-4"
            }, words.map((word, index) => (
                React.createElement("div", {
                    key: index,
                    className: "p-4 rounded-lg border cursor-pointer hover:bg-gray-50",
                    onClick: () => setExpandedWord(expandedWord === index ? null : index)
                }, [
                    React.createElement("div", {
                        className: "flex justify-between items-center"
                    }, [
                        React.createElement("span", {
                            className: "text-lg font-semibold"
                        }, word.word),
                        React.createElement("span", {
                            className: "text-sm font-medium"
                        }, `Score: ${Number(word.accuracyScore).toFixed(1)}%`)
                    ]),
                    React.createElement("div", {
                        className: "mt-2 space-y-2"
                    }, [
                        React.createElement("div", null, [
                            React.createElement("div", {
                                className: "flex justify-between text-sm mb-1"
                            }, [
                                React.createElement("span", null, "Accuracy"),
                                React.createElement("span", null, `${Number(word.accuracyScore).toFixed(1)}%`)
                            ]),
                            React.createElement("div", {
                                className: "w-full bg-gray-200 rounded-full h-2"
                            }, React.createElement("div", {
                                className: `${getScoreColor(word.accuracyScore)} rounded-full h-2`,
                                style: {
                                    width: `${word.accuracyScore}%`
                                }
                            }))
                        ]),
                        React.createElement("div", null, [
                            React.createElement("div", {
                                className: "flex justify-between text-sm mb-1"
                            }, [
                                React.createElement("span", null, "Fluency"),
                                React.createElement("span", null, `${Number(word.fluencyScore).toFixed(1)}%`)
                            ]),
                            React.createElement("div", {
                                className: "w-full bg-gray-200 rounded-full h-2"
                            }, React.createElement("div", {
                                className: `${getScoreColor(word.fluencyScore)} rounded-full h-2`,
                                style: {
                                    width: `${word.fluencyScore}%`
                                }
                            }))
                        ])
                    ])
                ])
            )))
        ])
    ]);
};

// 전역 스코프에 추가
window.PronunciationVisualizer = PronunciationVisualizer;
