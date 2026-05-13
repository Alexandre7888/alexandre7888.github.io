function AudioRecorder({ onSendAudio, onCancel }) {
    const [isRecording, setIsRecording] = React.useState(false);
    const [mediaRecorder, setMediaRecorder] = React.useState(null);
    const [recordingTime, setRecordingTime] = React.useState(0);
    const timerRef = React.useRef(null);
    const chunksRef = React.useRef([]);

    React.useEffect(() => {
        startRecording();
        return () => {
            stopTimer();
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        };
    }, []);

    const startTimer = () => {
        timerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64Audio = reader.result;
                    // Don't send automatically on stop unless confirmed, but here we just pass it back
                    // We need a separate confirm step usually, but for simplicity let's assume check icon sends it
                };
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            startTimer();
        } catch (err) {
            console.error("Error accessing microphone:", err);
            onCancel();
            alert("Não foi possível acessar o microfone.");
        }
    };

    const handleSend = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            // We need to wait for onstop to fire. 
            // A bit tricky with the closure, let's redefine onstop behavior slightly or wait a tick
            setTimeout(() => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    onSendAudio(reader.result, formatDuration(recordingTime));
                };
            }, 100);
        }
    };

    return (
        <div className="flex items-center gap-4 w-full bg-white p-2 rounded-lg animate-fade-in">
            <div className="text-red-500 animate-pulse">
                <div className="icon-mic text-xl"></div>
            </div>
            <div className="flex-1 font-mono text-gray-700">
                {formatDuration(recordingTime)}
            </div>
            <button 
                onClick={onCancel}
                className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                title="Cancelar"
            >
                <div className="icon-trash text-xl"></div>
            </button>
            <button 
                onClick={handleSend}
                className="p-2 text-green-500 hover:bg-green-50 rounded-full"
                title="Enviar"
            >
                <div className="icon-send text-xl"></div>
            </button>
        </div>
    );
}