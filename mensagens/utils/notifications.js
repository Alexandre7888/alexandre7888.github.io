class NotificationManager {
    constructor() {
        this.permission = null;
        this.audio = new Audio('https://resource.trickle.so/upload/users/1384073373539827712/audios/1738676900000-notification.mp3'); // Generic pleasant sound
        this.checkPermission();
        this.ringtoneInterval = null;
    }

    async checkPermission() {
        if (!("Notification" in window)) {
            console.warn("Este navegador não suporta notificações.");
            return;
        }
        
        if (Notification.permission === "granted") {
            this.permission = "granted";
        } else if (Notification.permission !== "denied") {
            this.permission = await Notification.requestPermission();
        }
    }

    playIncomingMessageSound() {
        // Short beep
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    }

    playRingtone() {
        // Use an oscillator pattern for calling
        if (this.ringtoneInterval) return;
        
        const playNote = () => {
             const ctx = new (window.AudioContext || window.webkitAudioContext)();
             const osc = ctx.createOscillator();
             const gain = ctx.createGain();
             osc.connect(gain);
             gain.connect(ctx.destination);
             osc.frequency.setValueAtTime(600, ctx.currentTime);
             osc.frequency.setValueAtTime(800, ctx.currentTime + 0.4);
             gain.gain.value = 0.1;
             osc.start();
             osc.stop(ctx.currentTime + 0.8);
        }
        
        playNote();
        this.ringtoneInterval = setInterval(playNote, 2000);
    }

    stopRingtone() {
        if (this.ringtoneInterval) {
            clearInterval(this.ringtoneInterval);
            this.ringtoneInterval = null;
        }
    }

    show(title, body, icon = null, tag = null) {
        if (this.permission === "granted") {
            // Check visibility state to determine if sound should play loudly or just alert
            const isHidden = document.hidden;

            if (isHidden) {
                this.playIncomingMessageSound();
            } else {
                 this.playIncomingMessageSound();
            }

            // Trigger Real Notification via Service Worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    try {
                        registration.showNotification(title, {
                            body: body,
                            icon: icon || 'https://resource.trickle.so/coding_trickle/trickle_avatar.png',
                            badge: 'https://resource.trickle.so/coding_trickle/trickle_avatar.png',
                            vibrate: [200, 100, 200],
                            tag: tag || 'chat-msg',
                            renotify: true,
                            data: {
                                url: window.location.href
                            }
                        });
                    } catch (e) {
                        console.error("Erro no SW Notification:", e);
                        // Fallback
                        this.fallbackNotification(title, body, icon, tag);
                    }
                });
            } else {
                this.fallbackNotification(title, body, icon, tag);
            }
        }
    }

    fallbackNotification(title, body, icon, tag) {
        try {
            const notif = new Notification(title, {
                body: body,
                icon: icon || 'https://resource.trickle.so/coding_trickle/trickle_avatar.png',
                tag: tag,
                silent: false
            });
            notif.onclick = function() {
                window.focus();
                notif.close();
            };
        } catch (e) {
            console.error("Erro no Fallback Notification:", e);
        }
    }
}

window.NotificationSystem = new NotificationManager();
