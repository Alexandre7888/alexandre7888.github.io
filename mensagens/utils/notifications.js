// utils/notifications.js
class NotificationManager {
    constructor() {
        this.permission = null;
        this.audio = null;
        this.ringtoneInterval = null;
        this.notificationBlacklist = new Set();
        this.loadBlacklist();
        this.checkPermission();
    }

    loadBlacklist() {
        try {
            const saved = localStorage.getItem("notification_blacklist");
            if (saved) {
                this.notificationBlacklist = new Set(JSON.parse(saved));
            }
        } catch(e) {
            this.notificationBlacklist = new Set();
        }
    }

    saveBlacklist() {
        localStorage.setItem("notification_blacklist", JSON.stringify([...this.notificationBlacklist]));
    }

    isBlocked(chatId) {
        return this.notificationBlacklist.has(chatId);
    }

    addToBlacklist(chatId) {
        this.notificationBlacklist.add(chatId);
        this.saveBlacklist();
    }

    removeFromBlacklist(chatId) {
        this.notificationBlacklist.delete(chatId);
        this.saveBlacklist();
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
        try {
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
        } catch(e) {}
    }

    playRingtone() {
        if (this.ringtoneInterval) return;
        
        const playNote = () => {
            try {
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
            } catch(e) {}
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

    show(title, body, icon = null, tag = null, chatId = null) {
        if (chatId && this.isBlocked(chatId)) {
            console.log("Notificação bloqueada para:", chatId);
            return;
        }

        if (this.permission === "granted") {
            this.playIncomingMessageSound();

            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then(registration => {
                    try {
                        registration.showNotification(title, {
                            body: body,
                            icon: icon || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
                            badge: 'https://api.dicebear.com/7.x/avataaars/svg?seed=badge',
                            vibrate: [200, 100, 200],
                            tag: tag || 'chat-msg',
                            renotify: true,
                            requireInteraction: true,
                            data: {
                                url: window.location.href,
                                chatId: chatId
                            }
                        });
                    } catch (e) {
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
                icon: icon || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
                tag: tag,
                silent: false,
                requireInteraction: true
            });
            notif.onclick = function() {
                window.focus();
                notif.close();
            };
        } catch (e) {}
    }
}

window.NotificationSystem = new NotificationManager();
